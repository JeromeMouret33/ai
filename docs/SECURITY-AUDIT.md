# Audit de sécurité — Showroom IA (GOODCAR)

Date : 2026-06-03. Portée : backend FastAPI, pipeline, stockage Supabase/Drive,
frontend Next.js/PWA, authentification. Légende statut : ✅ corrigé · 🟡 recommandé · ℹ️ noté.

## Synthèse
3 problèmes **élevés** corrigés (RLS, path traversal, auth fail-open), validation
des uploads ajoutée. Reste des recommandations de durcissement prod (buckets privés,
CORS, rate limiting). Aucune faille critique d'exécution de code identifiée.

---

## Élevé — corrigés

### H1 · Tables Supabase sans RLS → exposées via la clé anon publique ✅
La clé `anon` est publique (front). Sans Row Level Security, les tables
`jobs`/`photos`/`reference_assets` étaient lisibles/modifiables via l'API PostgREST
par quiconque possède cette clé.
**Correctif** : `alter table … enable row level security` sur les 3 tables, sans
policy anon/authenticated → accès direct refusé. Le backend passe par la clé
`service_role` (contourne RLS), seul chemin autorisé. *(supabase/migrations/0001_init.sql)*

### H2 · Path traversal sur les noms de fichiers uploadés ✅
`job_dir / f.filename` et les clés de bucket utilisaient le nom brut du client :
un `filename` type `../../etc/x` permettait d'écrire/nommer hors du dossier prévu.
**Correctif** : `naming.safe_filename()` (basename + whitelist `[A-Za-z0-9._-]`,
suppression des `..`/séparateurs) appliqué à tous les uploads et clés de stockage.
Testé (`test_security.py`).

### H3 · Authentification « fail-open » si mal configurée ✅
Si `SUPABASE_JWT_SECRET` était absent, l'auth se désactivait — pratique en dev,
mais une mauvaise config en prod ouvrait toute l'app.
**Correctif** : avec `ENVIRONMENT=production`, l'absence de secret **refuse** les
requêtes (503) au lieu d'ouvrir. Bypass conservé hors production. Testé.

---

## Moyen

### M3 · Pas de validation des uploads (type/taille) ✅
**Correctif** : refus des fichiers non-image (`content-type` ≠ `image/*`) et
plafond de taille (`MAX_UPLOAD_BYTES`, défaut 25 Mo) → 400 / 413.

### M1 · Buckets de stockage publics ✅
`outputs` (rendus) et `uploads` (sources) sont désormais **privés** ; les rendus
sont servis via **URLs signées** (`create_signed_url`, TTL 7 j) et livrés sur Drive
par téléchargement authentifié. `references` (assets de marque) reste public.

### M2 · CORS permissif par défaut 🟡
`ALLOWED_ORIGINS=*` par défaut. **Reco** : en prod, restreindre à l'URL Vercel.
(Déjà configurable via la variable.)

### M4 · Pas de limitation de débit / coûts ✅
**Correctif** : rate limiting par utilisateur (`JOBS_PER_MINUTE`) sur création de
job et retry + **suivi des coûts** (usage OpenRouter agrégé par photo/job).

### M5 · `npm audit` : 2 vulnérabilités modérées 🟡
`postcss` (XSS) embarqué par Next, **build-time uniquement** (non exploitable au
runtime de l'app). **Reco** : suivre les mises à jour de Next, ne pas downgrader.

---

## Faible / noté

- **L1 · Divulgation d'erreurs** 🟡 — certains messages d'API renvoient le détail
  d'exceptions (ex. erreurs Supabase). Reco : messages génériques en prod.
- **L2 · Filtres PostgREST** ℹ️ — les valeurs (`eq.<val>`) sont URL-encodées par
  httpx → injection de filtres non exploitable. OK.
- **L3 · JWT en localStorage** ✅ — défaut Supabase ; un XSS exposerait le token.
  **Atténué** : CSP + en-têtes de sécurité ajoutés (`next.config.ts` :
  `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- **L4 · `PUT /config` global** ℹ️ — tout utilisateur invité peut modifier prompts,
  modèles et dossier Drive (config globale). Acceptable dans le modèle « équipe de
  confiance » ; ajouter un rôle admin si besoin de cloisonner.
- **L5 · Service worker** ℹ️ — ne met en cache que le shell/navigations, **pas** les
  réponses API → aucune fuite de données inter-utilisateurs. OK.

---

## Bonnes pratiques constatées
- Secrets hors git (`.env` gitignoré, vérifié) ; `service_role` côté serveur, `anon`
  côté client (usage conforme) ; clé OpenRouter jamais exposée au front.
- Vérification JWT durcie : **algorithme épinglé HS256** (pas de `alg:none` ni de
  confusion RS/HS), contrôle `aud` (`authenticated`) et `exp`.
- Invite-only au niveau Supabase + liste blanche d'emails optionnelle (backend).
- Toutes les routes API authentifiées sauf `/api/health`.
- TLS fourni par Vercel/Railway (HTTPS de bout en bout).

## À faire avant la mise en production (checklist)
1. Définir `ENVIRONMENT=production` + `SUPABASE_JWT_SECRET` (auth fail-closed).
2. Restreindre `ALLOWED_ORIGINS` à l'URL Vercel.
3. Appliquer la migration (RLS + buckets privés inclus) sur le projet Supabase.
4. ✅ `outputs`/`uploads` privés + URLs signées (fait).
5. ✅ CSP + en-têtes de sécurité + rate limiting (fait).
6. (Reco restante) Messages d'erreur génériques en prod (L1) ; durcir la CSP (nonces).
