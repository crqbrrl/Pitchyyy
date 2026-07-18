# 2. Architecture technique

## Stack

React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4 (`@tailwindcss/vite`),
`motion` (animations), `lucide-react` (icônes), `clsx`/`tailwind-merge`
(`cn()` dans `src/lib/utils.ts`). Scripts npm : `dev` (port 3000), `build`,
`lint` (= `tsc --noEmit`). `@types/react`/`@types/react-dom` ajoutés en
devDependencies (indispensables au lint).

## Arborescence utile

```
src/poker/
  types.ts       Carte {rank 2..14, suit s/h/d/c}, symboles, labels FR
  deck.ts        paquet mélangé (Fisher-Yates)
  handEval.ts    évaluation 5-7 cartes → {score: number[], name}, compareScore
  engine.ts      LE moteur de jeu (pur, sans UI ni I/O) — voir ci-dessous
  ui.tsx         composants partagés : PlayingCard, CardBack, EmptySlot,
                 Board, PlayersOverview, TableHeader, ActionControls
  PokerApp.tsx   mode local pass & play (setup → handoff → acting → results
                 → gameover), sauvegarde localStorage 'poker_local_save'
  OnlineApp.tsx  mode en ligne (menu → create/join → room : lobby/jeu/fin)
  online.ts      client API + types RoomState/OnlineSession + session
                 localStorage 'poker_online_session'
  AppRoot.tsx    écran d'accueil, choix du mode (rendu par src/main.tsx)
supabase/
  functions/poker/   l'API de jeu (index.ts + COPIES de engine/handEval/
                     deck/types — voir « copies » ci-dessous)
scripts/
  mock-poker-server.ts  miroir Express en mémoire de l'API (tests locaux)
.github/workflows/deploy-pages.yml  build + publication gh-pages
docs/brief/    ce dossier
```

## Le moteur (`engine.ts`)

Fonctions pures sur un `GameState` sérialisable JSON (clonage par
`JSON.parse(JSON.stringify())`, pas de classes, pas de Date/Math.random hors
`newShuffledDeck`/choix du donneur initial) :

- `createGame(names, chips, sb, bb)` → état initial + première main.
- `startHand(state)` — reset joueurs, avance le donneur, poste les blindes,
  distribue, `toAct` = premier à parler après la BB.
- `applyAction(state, action)` avec `action` ∈ fold / check / call /
  raise{amount = mise totale visée sur le tour}. Avance automatiquement :
  joueur suivant, fin de tour d'enchères (flop/turn/river), run-out si tapis
  généralisé, showdown, victoire par abandon général.
- `legalActions(state)` → {canCheck, callAmount, canRaise, minRaiseTo,
  maxRaiseTo, isOpeningBet}. **Source de vérité unique** : utilisée par l'UI
  (affichage des boutons/curseur) ET par le serveur (validation).
- Flag `acted` par joueur : remis à zéro uniquement par une relance
  complète → `acted && bet < currentBet` ⇔ « face à une relance incomplète »
  (ne peut que suivre/se coucher).
- `potTotal(state)` = somme des `total` ; les `bet`/`total` sont remis à 0
  après distribution (les tests d'invariants comptent dessus).

## Mode en ligne — serveur autoritaire

**Principe anti-triche : le paquet et les cartes privées ne quittent jamais
le serveur.** L'état public envoyé aux clients a `deck: []` et `hole: []`
pour tous (les mains révélées au showdown passent par `results.revealed`).
Chaque joueur possède un token secret (UUID) retourné à la création/au join ;
le serveur vérifie token + tour de jeu + légalité de l'action.

### Base de données (projet Supabase `qfnekrdmwkpoedamwxaf`)

- `rooms` (id uuid, code text unique, state jsonb, version int,
  created_at, updated_at) — RLS : policy SELECT publique, **aucune** policy
  d'écriture (service role uniquement). Publication realtime activée
  (non utilisée par le client actuel — polling choisi).
- `room_secrets` (room_id → rooms, secret jsonb) — RLS activé **sans aucune
  policy** = volontairement inaccessible aux clients (l'advisor Supabase
  affiche une INFO à ce sujet : c'est voulu).
- Fonctions SQL (migration `atomic_room_writes`, security definer,
  execute révoqué pour anon/authenticated) :
  - `save_room(p_room_id, p_expected_version, p_state, p_secret) → bool` :
    verrou optimiste sur version + écriture des DEUX tables dans une seule
    transaction. `false` = conflit (→ 409 côté API).
  - `create_room(p_code, p_state, p_secret) → uuid` : insertion atomique.
- `static_assets` + bucket Storage `app` + fonctions `app`/`deploy-app` :
  **vestiges d'une tentative d'hébergement abandonnée** (voir
  03-historique) — à nettoyer.
- Extension `pg_net` activée (sert à tester l'API depuis SQL, voir 04).

### L'API (`supabase/functions/poker/index.ts`, edge function Deno)

POST JSON unique, routage par `body.op` :

| op | entrée | rôle |
|---|---|---|
| create | name, chips, sb, bb | crée la salle → {code, playerId:0, token, state} |
| join | code, name | rejoint le lobby (dédup pseudo, max 8) → {playerId, token, state} |
| start | code, token | hôte uniquement, ≥2 joueurs → lance la partie |
| act | code, token, action | valide tour + légalité via legalActions → applique |
| my_cards | code, token | {handNumber, hole} du joueur (seul canal des cartes privées) |
| next_hand | code, token | main suivante (idempotent) ou phase 'over' |
| state | code | état public seul — **chemin chaud** : lit directement rooms.state matérialisé |

Réponses `{ok:true, ...}` / `{ok:false, error}` (messages en français),
CORS ouvert, `verify_jwt: true` → les clients envoient la clef `anon` en
Bearer. Secret shape : `{phase: lobby|playing|over, hostToken, config,
members:[{id,name,token}], game: GameState|null}`. L'état public inclut
`version` (croissante à chaque écriture) pour que le client ignore les
réponses de sondage périmées.

### Client en ligne (`online.ts` + `OnlineApp.tsx`)

- **Polling toutes les 2 s** (choix délibéré vs websockets : robustesse
  mobile + testable dans le sandbox qui bloque les websockets) +
  rafraîchissement sur `visibilitychange` + mise à jour immédiate avec la
  réponse de chaque action.
- `mergeState` : ignore les états de version inférieure, conserve
  l'identité de l'objet si JSON identique (pas de re-render toutes les 2 s).
- Retry automatique unique sur 409 (`ApiCallError.status`), récupération des
  cartes par main avec retry/backoff.
- Session {code, playerId, token, name} en localStorage → « Revenir à ma
  table » après fermeture/rechargement.
- URL API et clef anon : constantes avec fallback dans `online.ts`,
  surchargeables par `VITE_POKER_API_URL` / `VITE_SUPABASE_ANON_KEY`.
  La clef anon est **publique par conception** (RLS verrouille tout).

### Copies du moteur — ATTENTION

`supabase/functions/poker/{engine,handEval,deck,types}.ts` sont des **copies
conformes** de `src/poker/*` (imports avec extension `.ts` pour être valides
à la fois sous Vite et Deno). Toute modif du moteur doit être recopiée
(`cp src/poker/{engine,handEval,deck,types}.ts supabase/functions/poker/`)
puis la fonction redéployée. Améliorer ça (script de sync ou vérif CI) est
dans la liste des chantiers (04).

### Miroir de test (`scripts/mock-poker-server.ts`)

Express, port 8787, mêmes handlers/messages, stockage en Map mémoire, même
champ `version`. Différence assumée : pas de chemin 409 (pas de concurrence
en mémoire synchrone). Usage :
`npx tsx scripts/mock-poker-server.ts` puis
`VITE_POKER_API_URL=http://127.0.0.1:8787 npm run dev`.

## Déploiement du front

GitHub Pages via `.github/workflows/deploy-pages.yml` : sur push `main`,
`npm ci` + `npx vite build --base=./` (base relative car servi sous
`/Pitchyyy/`) + publication de `dist/` sur la branche `gh-pages`
(`peaceiris/actions-gh-pages@v4`, ne requiert que `contents: write`).
URL attendue : **https://crqbrrl.github.io/Pitchyyy/** — voir l'état réel
dans 04 (pas encore vérifié en ligne au moment de ce brief).
