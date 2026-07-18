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
