# ♠️ Poker entre potes

Appli de **Texas Hold'em No-Limit** pour jouer entre amis (2 à 8 joueurs), deux
modes :

- **Chacun son téléphone** : l'hôte crée une table, partage un code à 4
  lettres, et chacun joue depuis son propre appareil. Le moteur de jeu tourne
  côté serveur (Supabase Edge Function) — personne ne peut voir les cartes des
  autres, même en inspectant le réseau.
- **Un seul téléphone** (pass & play) : on se passe l'appareil à chaque tour de
  parole, avec un écran de transition qui cache les cartes.

## Lancer l'appli

**Prérequis :** Node.js

```bash
npm install
npm run dev
```

Puis ouvre http://localhost:3000 — et fais tourner le téléphone !

## Fonctionnalités

- Texas Hold'em No-Limit complet : blindes, pré-flop / flop / turn / river, showdown
- Mode « hot seat » : écran de transition entre chaque joueur pour que personne ne voie tes cartes
- Tapis (all-in) et **pots annexes** gérés correctement
- Évaluation automatique des mains (quinte flush → hauteur), partage des pots en cas d'égalité
- Indication de ta main en cours à partir du flop
- Bouton du donneur qui tourne, éliminations, écran de victoire
- Partie sauvegardée automatiquement dans le navigateur : recharge la page et reprends où vous en étiez

## Config de la partie

Sur l'écran d'accueil : noms des joueurs, tapis de départ (1000 par défaut) et
blindes (10/20 par défaut).

## Notes techniques

- React 19 + TypeScript + Vite + Tailwind CSS 4
- Moteur de jeu pur (sans dépendance UI) dans `src/poker/engine.ts`,
  évaluation des mains dans `src/poker/handEval.ts` — le même code tourne dans
  le navigateur (mode local) et dans l'edge function Deno (mode en ligne)
- Backend du mode en ligne : Supabase (projet `poker-entre-potes`)
  - `supabase/functions/poker/` : l'API de jeu (create/join/start/act/…),
    seule détentrice du paquet et des cartes privées
  - Table `rooms` (état public, lisible par tous) + `room_secrets` (cartes et
    tokens, RLS sans policy = accessible uniquement au service role)
  - Les clients sondent l'état toutes les 2 s (pas de websocket : plus robuste
    sur mobile)
  - La clef `anon` embarquée dans le client est publique par conception
- Tests locaux du mode en ligne : `npx tsx scripts/mock-poker-server.ts`
  (API miroir en mémoire) puis `VITE_POKER_API_URL=http://127.0.0.1:8787 npm run dev`
- L'ancienne appli Pitchyyy (analyse de pitch VC) est conservée dans
  `src/App.tsx` mais n'est plus branchée sur le point d'entrée
