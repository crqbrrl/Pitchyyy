# Dossier de brief — Poker entre potes

Ce dossier permet de reprendre le projet dans une nouvelle session (nouveau
sandbox) sans perdre le contexte. À lire dans l'ordre :

1. **[01-projet.md](01-projet.md)** — ce qu'est l'appli, les deux modes de
   jeu, les règles de poker implémentées, l'UX, l'utilisateur.
2. **[02-architecture.md](02-architecture.md)** — stack, arborescence,
   moteur de jeu, backend Supabase (tables, RLS, RPC, edge function API),
   client en ligne, miroir de test, déploiement GitHub Pages.
3. **[03-historique-decisions.md](03-historique-decisions.md)** — tout ce qui
   s'est passé et pourquoi : pivots, contraintes réseau du sandbox, saga de
   l'hébergement, épisode des clefs API exposées (⚠️ à révoquer).
4. **[04-etat-et-reste-a-faire.md](04-etat-et-reste-a-faire.md)** — l'état
   exact (git, Supabase, revue de code) et la **TODO ordonnée**, avec les
   recettes pratiques pour travailler malgré l'egress restreint du sandbox.

## Démarrage express dans un nouveau sandbox

```bash
npm install && npm run lint          # typecheck
npx tsx scripts/mock-poker-server.ts # API miroir (port 8787), puis :
VITE_POKER_API_URL=http://127.0.0.1:8787 npm run dev   # appli sur :3000
```

**Première action recommandée : la TODO n°1 de 04-etat-et-reste-a-faire.md**
(redéployer l'edge function `poker` — le code corrigé est dans le repo mais
la version déployée est en retard).
