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
   moteur tourne côté serveur (anti-triche réelle, voir 02-architecture).

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
