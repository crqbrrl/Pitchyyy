# 📁 BRIEF — Poker entre potes

Document unique pour reprendre le projet dans une nouvelle session (nouveau
sandbox) sans perdre le contexte. Quatre parties : le projet, l'architecture,
l'historique des décisions, l'état exact + TODO.

## Démarrage express dans un nouveau sandbox

```bash
npm install && npm run lint          # typecheck
npx tsx scripts/mock-poker-server.ts # API miroir (port 8787), puis :
VITE_POKER_API_URL=http://127.0.0.1:8787 npm run dev   # appli sur :3000
```

**Première action recommandée : la TODO n°1 de la partie 4** (redéployer
l'edge function `poker` — le code corrigé est dans le repo mais la version
déployée est en retard).

---

# 1. Le projet — « Poker entre potes »

## Objectif

Cyriaque veut jouer au **Texas Hold'em No-Limit** avec ses 3 potes. L'appli
doit être **gratuite, sans inscription, en français**, et jouable depuis un
téléphone. Le repo GitHub d'origine (`crqbrrl/Pitchyyy`, public) contenait une
appli d'analyse de pitch VC ("Pitchyyy") ; elle est conservée dans
`src/App.tsx` + `src/lib/gemini.ts` mais n'est plus branchée sur le point
d'entrée.

## Les deux modes de jeu

1. **« Chacun son téléphone » (en ligne)** — le mode principal demandé.
   L'hôte crée une table (pseudo + tapis de départ + blindes), reçoit un
   **code à 4 lettres** (alphabet sans caractères ambigus : pas de O/0/I/1).
   Les potes ouvrent la même URL, choisissent « Rejoindre avec un code »,
   entrent le code et leur pseudo. Lobby avec liste des joueurs (2 à 8),
   l'hôte lance la partie. Chacun ne voit que **ses propres cartes** ; le
   moteur tourne côté serveur (anti-triche réelle, voir partie 2).

2. **« Un seul téléphone » (pass & play / hot seat)** — on se passe
   l'appareil à chaque tour de parole. Écran de transition « Passe
   l'appareil à X » qui cache les cartes, puis « Voir mes cartes » révèle la
   main et les boutons d'action. Sauvegarde automatique dans localStorage
   (reprise après rechargement, en re-cachant les cartes).

## Règles de poker implémentées

- Texas Hold'em No-Limit, 2 à 8 joueurs, blindes fixes (pas de montée
  automatique — amélioration possible).
- Cas tête-à-tête : le donneur est petite blinde, parle en premier pré-flop
  et en dernier post-flop.
- Blindes partielles (tapis < blinde), tapis, **pots annexes** (algorithme par
  paliers de mise totale, argent mort des couchés inclus).
- Relance minimum = taille de la dernière relance complète ; une **relance
  incomplète à tapis ne rouvre pas les enchères** pour ceux qui ont déjà
  parlé (suivre ou se coucher uniquement) — corrigé suite à la revue.
- Partage des pots en cas d'égalité ; **jeton impair au premier joueur à
  gauche du donneur** — corrigé suite à la revue.
- Tapis généralisé → le tableau se déroule automatiquement jusqu'à la river.
- Tout le monde se couche → le dernier remporte le pot sans montrer.
- Élimination à 0 jeton, rotation du donneur entre joueurs vivants, partie
  terminée quand il ne reste qu'un joueur (écran de victoire).
- Évaluation des mains : meilleure main de 5 cartes parmi 7 (21 combinaisons),
  quinte flush royale → hauteur, roue A-2-3-4-5 gérée, noms en français
  (« Full aux As par les 8 », « Double paire, Roi et 9 », etc.).

## UX / design

- Mobile-first, largeur max ~28rem centrée.
- Thème « tapis de poker » : dégradé emerald-950 → 900, cartes blanches
  (rouge pour ♥♦), accents ambre (amber-400) pour les actions principales,
  boutons arrondis 2xl, polices Inter + Space Grotesk (importées dans
  `src/index.css`).
- Pendant une main : tableau (5 emplacements), pot, dernière action, ses
  cartes en grand, indication de la main en cours dès le flop (« Ta main
  actuelle : Paire de Dames »), curseur de relance avec boutons Min / Pot /
  Tapis, badge D pour le donneur, statuts couché/tapis/éliminé par joueur.
- Résultats de main : cartes révélées de chaque joueur en lice + nom de la
  main, détail des pots (« Pot principal », « Pot annexe 1 »), gains,
  éliminations, bouton « Main suivante » / « Voir le vainqueur ».
- En ligne : « En attente de X… » quand ce n'est pas son tour, bouton
  « Revenir à ma table » (session localStorage), « Quitter la table » avec
  confirmation.

## Utilisateur

- Email : cyriaquebarral@gmail.com — GitHub : crqbrrl — org Supabase : 41bis.
- Non-développeur : communiquer en français, simple, sans jargon inutile.

---

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
docs/brief/    ce document
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
  **vestiges d'une tentative d'hébergement abandonnée** (voir partie 3) — à nettoyer.
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
dans la liste des chantiers (partie 4).

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
URL attendue : **https://crqbrrl.github.io/Pitchyyy/** — voir l'état réel dans la partie 4 (pas encore vérifié en ligne au moment de ce brief).

---

# 3. Historique de la session et décisions prises

Session du 17-18 juillet 2026, sandbox Claude Code distant sur le repo
`crqbrrl/Pitchyyy`, branche de travail `claude/poker-local-app-3z7i82`.

## Chronologie

1. **Demande initiale** : « une appli où je peux jouer en local au poker avec
   mes 3 potes ». → Construction du mode pass & play complet (moteur +
   évaluateur + UI FR), testé (simulation massive + Playwright), poussé,
   **PR #3** créée en draft.

2. **« Push sur Vercel supabase et rends ça accessible en ligne »** puis
   **« j'aimerais que mes potes et moi puissent utiliser l'appli depuis leur
   tel »** → pivot vers le multijoueur en ligne. Décisions :
   - Supabase comme backend (la connexion Claude de l'utilisateur donne un
     accès MCP complet, 0 €/mois) ; projet `poker-entre-potes` créé dans
     l'org 41bis, région eu-west-3 (Paris).
   - **Serveur autoritaire** (anti-triche demandé : « Fais en sorte que ce
     soit sécurisé ») : moteur exécuté dans une edge function, cartes jamais
     envoyées aux clients, tokens par joueur, RLS verrouillé (vérifié en SQL :
     anon lit `rooms` mais 0 ligne de `room_secrets` ; advisors OK).
   - **Polling 2 s plutôt que websockets/realtime** : plus robuste sur mobile,
     moins de dépendances, et testable dans le sandbox (websockets bloqués).
   - Miroir Express de l'API pour développer/tester sans réseau Supabase.

3. **Épisode clefs API** (important) :
   - L'utilisateur a collé une **clef API Anthropic** (`sk-ant-...`) en clair
     dans le chat en pensant donner accès à Vercel. Elle n'a **jamais été
     utilisée ni stockée** ; il lui a été demandé de la **révoquer** sur
     console.anthropic.com → à re-vérifier avec lui.
   - Il a ensuite fourni un **token Vercel** (`vcp_...`), lui aussi exposé en
     clair dans la conversation → **à révoquer également** (et inutilisable
     depuis le sandbox de toute façon, voir ci-dessous). Ne JAMAIS recopier
     ces secrets dans le repo ou les logs.

4. **Contraintes réseau du sandbox** (politique d'egress de l'environnement) :
   - `*.supabase.co` et `api.vercel.com` **bloqués** (CONNECT 403 du proxy) →
     impossible d'appeler l'API déployée ou la CLI Vercel depuis le sandbox.
   - `api.github.com` accessible ; git push passe par un proxy git local.
   - **Contournement trouvé pour tester la prod** : faire émettre les
     requêtes HTTP par la base elle-même via l'extension `pg_net`
     (`select net.http_post(...)` puis lecture de `net._http_response`).
     La partie de test « CD82 » a validé create/join/start en production.

5. **Saga de l'hébergement du front** :
   - MCP Vercel de l'utilisateur : outils de facturation/observabilité
     uniquement, pas de déploiement.
   - Tentative d'hébergement **sur Supabase** (table static_assets + edge
     function `app`, puis bucket Storage public) : échec — Supabase force
     `Content-Type: text/plain` + CSP `sandbox` sur tout HTML servi depuis
     son domaine (anti-abus), pour les edge functions ET le Storage. JS/CSS
     passent, la page HTML ne s'affichera jamais. **Vestiges à nettoyer**
     (voir partie 4).
   - Bascule sur **GitHub Pages** (repo public). Premier workflow avec
     `actions/configure-pages` + `enablement: true` : échec « Resource not
     accessible by integration » (le GITHUB_TOKEN du workflow ne peut pas
     créer le site Pages). Correction : publication de `dist/` sur la
     branche **gh-pages** via `peaceiris/actions-gh-pages@v4` (auto-active
     Pages, ne demande que contents:write). Ce correctif est sur la branche,
     PAS encore mergé dans main au moment du brief.
   - La **PR #3 a été mergée dans main** (nécessaire pour déclencher le
     workflow qui ne tourne que sur main).

6. **Revue de code complète** (demande : « Check toutes les erreurs possibles
   et améliorations et test toutes les fonctionnalités succinctement ») :
   8 agents en parallèle (scan ligne à ligne, comportements supprimés,
   traçage inter-fichiers, réutilisation, simplification, efficacité,
   altitude, conventions). Résultats détaillés dans la partie 4. Les correctifs de
   bugs sont commités sur la branche ; le redéploiement de l'edge function
   `poker` avec ces correctifs a été **interrompu par l'utilisateur** juste
   avant sa demande de brief → la fonction déployée est encore la v1.

## Décisions de style de collaboration

- Tout en **français** (UI, messages d'erreur serveur, commits, PR).
- Commits : auteur `Claude <noreply@anthropic.com>` exigé par un hook local.
- L'utilisateur valide vite et fait confiance ; expliquer les choix
  techniques simplement, donner les liens (PR, URL), et signaler
  explicitement tout ce qui touche à la sécurité ou à l'argent.

---

# 4. État exact au moment du brief, et reste à faire

## État git / GitHub

- **main** : contient tout le jeu (PR #3 mergée) + le PREMIER workflow Pages
  (celui qui échoue avec configure-pages). Le run n°1 du workflow sur main a
  échoué à l'étape d'activation de Pages (build OK).
- **Branche `claude/poker-local-app-3z7i82`** (repartie de main après merge),
  poussée, en avance sur main de 3 commits :
  1. `Corrige le déploiement Pages : publication sur la branche gh-pages`
  2. `Corrections issues de la revue de code` (perf/simplifications client +
     op state direct + fix boucle infinie pseudos)
  3. `Correctifs de la revue de code (règles du poker + robustesse réseau)`
     (relance incomplète, jeton impair, RPC atomiques, version d'état,
     retries client)
- **Pas de PR ouverte pour ces 3 commits** au moment du brief → en créer une
  et la merger pour (a) déployer le site via gh-pages et (b) aligner main.
- Tests au vert sur la branche : `npm run lint`, `vite build`, simulation
  moteur (300 parties / ~2 300 mains, conservation des jetons), e2e
  Playwright 4 joueurs contre le miroir (4 mains complètes, 0 fuite de
  cartes, reconnexion OK).

## État Supabase (projet qfnekrdmwkpoedamwxaf, org 41bis, eu-west-3, 0 €/mois)

- Migrations appliquées : `poker_rooms` (tables + RLS + realtime + index),
  `static_assets` (obsolète), `atomic_room_writes` (RPC save_room /
  create_room, service-role only).
- **Edge function `poker` : version 1 déployée** = code AVANT les correctifs
  de revue (anciennes écritures non atomiques en 2 requêtes, pas de champ
  version, boucle infinie possible sur pseudos dupliqués longs, moteur avec
  les 2 bugs de règles). ⚠️ **Le code corrigé est dans le repo
  (`supabase/functions/poker/`) mais PAS déployé** — le redéploiement a été
  interrompu par l'utilisateur. Les RPC SQL sont déjà en place, donc le
  nouveau code peut être déployé tel quel via l'outil MCP
  `deploy_edge_function` (name: poker, verify_jwt: true, entrypoint
  index.ts, fichiers = contenu exact de supabase/functions/poker/*).
- Fonctions `app` (verify_jwt false) et `deploy-app` : **obsolètes**
  (hébergement abandonné) — à supprimer via le dashboard (le MCP ne sait pas
  supprimer une fonction), avec la table `static_assets` et le bucket `app`.
- Clef anon (publique, embarquée en fallback dans src/poker/online.ts) :
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbmVrcmRtd2twb2VkYW13eGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTE4MzQsImV4cCI6MjA5OTg4NzgzNH0.wsnkVzbiawLTkgcuL_ppbhGUOCAkC2-hS1sOy7i_6E4`
- URL API : `https://qfnekrdmwkpoedamwxaf.supabase.co/functions/v1/poker`.

## Revue de code — synthèse des findings

### Corrigé (commits sur la branche)
- 🐛 Relance incomplète à tapis rouvrait illégalement les enchères
  (legalActions : `acted && bet < currentBet` → suivre/coucher seulement).
- 🐛 Jeton impair d'un pot partagé attribué au donneur au lieu du premier
  joueur à sa gauche.
- 🐛 Boucle infinie sur déduplication de pseudos identiques ≥ 17 caractères
  (join) — serveur + miroir.
- 🐛 Écritures rooms/room_secrets non atomiques (désynchronisation possible
  de la table en cas d'erreur transitoire) → RPC transactionnelles.
- 🐛 Réponse de sondage périmée pouvant écraser l'état frais post-action →
  champ `version` + `mergeState`.
- 🐛 Échec réseau unique sur `my_cards` = cartes invisibles toute la main →
  retry/backoff (+ re-fetch si le serveur répond sur l'ancienne main).
- ⚡ op `state` (chemin chaud) : 1 requête au lieu de 2 + clone, sans lire
  les secrets ; identité d'objet conservée côté client (pas de re-render
  2 s) ; loadRoom en 1 requête (jointure) ; retry auto sur 409 ;
  `useMemo` sur l'indice de main ; import mort supprimé.

### Restant (améliorations connues, non bloquantes)
- **Copies du moteur** src/poker ↔ supabase/functions/poker sans
  synchronisation automatique → script de sync ou vérif CI (diff) à ajouter.
- **Miroir de test** duplique les handlers de l'edge function (~150 lignes) →
  extraire un module de handlers partagé paramétré par le stockage.
- Duplications UI : bloc résultats de main (PokerApp/OnlineApp), en-tête de
  table réimplémenté dans OnlineApp (avec pot recalculé à la main au lieu de
  `potTotal`), 3 maps de tailles de cartes dans ui.tsx, styles d'inputs.
- `isHost = playerId === 0` et union `phase` re-déclarée à 3 endroits →
  exposer hostId dans l'état public / partager les types.
- `sbIndex`/`bbIndex` stockés dans GameState mais jamais lus hors startHand.
- Fallbacks URL/clef codés en dur dans online.ts (assumé pour simplifier le
  déploiement ; alternative : exiger les VITE_* et échouer clairement).
- Le sondage renvoie tout l'état même inchangé → possible court-circuit
  `{unchanged:true}` avec `sinceVersion` (le champ version existe déjà).
- Limitation assumée du mode local : la sauvegarde localStorage contient
  cartes + paquet en clair (triche possible via devtools sur le téléphone
  partagé — accepté pour un jeu entre amis).
- Nice-to-have produit : montée automatique des blindes, timer de tour,
  gestion des déconnexions/kick, lien de partage direct (`?code=XXXX`),
  PWA/installable, sons.

## TODO ordonnée pour le nouveau sandbox

1. **Redéployer l'edge function `poker`** avec le contenu actuel de
   `supabase/functions/poker/` (MCP Supabase, verify_jwt: true). Puis
   smoke-test en prod via pg_net (voir recette ci-dessous).
2. **Créer la PR de la branche → main et la merger** (elle contient le fix
   gh-pages + tous les correctifs de revue). Le push sur main déclenche le
   workflow → vérifier le run, puis que
   **https://crqbrrl.github.io/Pitchyyy/** répond (compter ~1-2 min après le
   premier déploiement Pages ; vérifier dans Settings → Pages si besoin).
3. Tester l'appli en ligne de bout en bout depuis un vrai navigateur
   (créer une table, rejoindre à 2+, jouer une main).
4. Nettoyage Supabase : drop `static_assets`, vider/supprimer le bucket
   `app`, supprimer les fonctions `app` et `deploy-app` (dashboard).
5. Rappeler à l'utilisateur de **révoquer** la clef Anthropic ET le token
   Vercel exposés dans la conversation précédente.
6. (Optionnel) chantiers de la liste « Restant » ci-dessus, en commençant
   par la synchronisation des copies du moteur.

## Recettes utiles (sandbox avec egress restreint)

- Le sandbox bloque `*.supabase.co` et `api.vercel.com` (CONNECT 403).
  Tester la prod via SQL (MCP execute_sql) :
  `select net.http_post(url := 'https://qfnekrdmwkpoedamwxaf.supabase.co/functions/v1/poker', body := '{"op":"state","code":"XXXX"}'::jsonb, headers := '{"Content-Type":"application/json","Authorization":"Bearer <clef anon>"}'::jsonb);`
  puis `select status_code, content from net._http_response where id = <id>;`
- Tests locaux complets sans réseau : miroir `npx tsx
  scripts/mock-poker-server.ts` + `VITE_POKER_API_URL=http://127.0.0.1:8787
  npm run dev` + Playwright (chromium préinstallé :
  `executablePath: '/opt/pw-browsers/chromium'`, playwright global dans
  `/opt/node22/lib/node_modules/playwright/index.mjs`).
- Simulation moteur : script de test à recréer au besoin (invariant clef :
  somme des jetons constante, `bet`/`total` remis à 0 après distribution).
- Hook local : commits avec `git config user.email noreply@anthropic.com`,
  `user.name Claude`, sinon le stop-hook demande un `--reset-author`.
