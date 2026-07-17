# ♠️ Poker entre potes

Appli de **Texas Hold'em No-Limit en local** : une seule machine (téléphone ou
ordi), on se passe l'appareil entre joueurs à chaque tour de parole. Parfait
pour jouer à 4 (2 à 8 joueurs supportés).

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
  évaluation des mains dans `src/poker/handEval.ts`
- L'ancienne appli Pitchyyy (analyse de pitch VC) est conservée dans
  `src/App.tsx` mais n'est plus branchée sur le point d'entrée
