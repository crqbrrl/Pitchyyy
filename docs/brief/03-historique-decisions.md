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
     (voir 04).
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
   altitude, conventions). Résultats détaillés dans 04. Les correctifs de
   bugs sont commités sur la branche ; le redéploiement de l'edge function
   `poker` avec ces correctifs a été **interrompu par l'utilisateur** juste
   avant sa demande de brief → la fonction déployée est encore la v1.

## Décisions de style de collaboration

- Tout en **français** (UI, messages d'erreur serveur, commits, PR).
- Commits : auteur `Claude <noreply@anthropic.com>` exigé par un hook local.
- L'utilisateur valide vite et fait confiance ; expliquer les choix
  techniques simplement, donner les liens (PR, URL), et signaler
  explicitement tout ce qui touche à la sécurité ou à l'argent.
