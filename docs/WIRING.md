# Carte de câblage — Showroom IA (qui reçoit quoi)

4 briques : **Supabase** (BDD/auth/stockage), **Google** (login OAuth), **Railway**
(backend), **Vercel** (frontend) — + **OpenRouter** (IA, fournit juste une clé).

## Les valeurs en circulation (source → destination)

| Valeur | Se reconnaît à | Où la PRENDRE | Où la METTRE |
|---|---|---|---|
| **URL Supabase** | `…supabase.co` | Supabase → Settings → API → *Project URL* | Railway `SUPABASE_URL` + Vercel `NEXT_PUBLIC_SUPABASE_URL` |
| **Clé `service_role`** | long `eyJ…` (secret) | Supabase → Settings → API | Railway `SUPABASE_KEY` |
| **Clé `anon`** | long `eyJ…` (public) | Supabase → Settings → API | Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Callback Supabase** | `…supabase.co/auth/v1/callback` | Supabase → Auth → Providers → Google | Google → OAuth → *Authorized redirect URIs* |
| **Clé OpenRouter** | `sk-or-…` | openrouter.ai → Keys | Railway `OPENROUTER_API_KEY` |
| **Google client_id + secret** | `…apps.googleusercontent.com` | Google Cloud → Credentials → client "ShowroomAI" | Supabase → Auth → Providers → Google |
| **URL Railway (backend)** | `…up.railway.app` | Railway → Settings → Networking → **Generate Domain** | Vercel `NEXT_PUBLIC_API_BASE` |
| **URL Vercel (front)** | `…vercel.app` | Vercel → projet (page d'accueil / Domains) | Railway `ALLOWED_ORIGINS` + Supabase (Auth → URL Config) + Google (JS origins) |

> Règle d'or : un secret (`service_role`, OpenRouter, Google secret) ne va **jamais**
> côté navigateur (jamais en `NEXT_PUBLIC_…` ni dans Vercel). Seul l'`anon` est public.

---

## Par brique — checklist

### 🟩 Supabase (dashboard)
1. SQL Editor → coller `supabase/migrations/0001_init.sql` → Run (tables + buckets + RLS).
2. Storage → `references` public ; `uploads` et `outputs` **privés**.
3. Auth → Providers → **Google** : Enable + coller **client_id / client_secret** (de Google).
4. Auth → **URL Configuration** :
   - *Site URL* = URL **Vercel**.
   - *Redirect URLs* = URL **Vercel** (+ `http://localhost:3000` pour le dev).
5. Récupérer pour les autres briques : **Project URL**, clé **anon**, clé **service_role**.

### 🟦 Google Cloud (client OAuth du login)
1. Credentials → client OAuth **Web** "ShowroomAI".
2. *Authorized redirect URIs* = **Callback Supabase** (`…supabase.co/auth/v1/callback`).
3. *Authorized JavaScript origins* = URL **Vercel** (+ `http://localhost:3000`).
4. Donne **client_id + secret** → à coller **dans Supabase** (pas ailleurs).

### 🟧 Railway (backend) — onglet Variables
```
OPENROUTER_API_KEY   = sk-or-…              (OpenRouter)
SUPABASE_URL         = https://xxxx.supabase.co
SUPABASE_KEY         = eyJ…                  (service_role)
ENVIRONMENT          = production
AUTH_ALLOWED_EMAILS  = ton@email.com
ALLOWED_ORIGINS      = https://…vercel.app   (URL Vercel)
```
Puis Settings → Networking → **Generate Domain** → récupère l'URL `…up.railway.app`.
*(Drive plus tard : `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN/DRIVE_PARENT_FOLDER_ID`.)*

### 🟪 Vercel (frontend) — Settings → Environment Variables
```
NEXT_PUBLIC_API_BASE         = https://…up.railway.app   (URL Railway, sans / final)
NEXT_PUBLIC_SUPABASE_URL     = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY= eyJ…                       (anon)
```
Puis **Redeploy**.

---

## Ordre de branchement (évite le poulet-œuf)
1. **Supabase** : migration + Google provider + Project URL/clés en main.
2. **Railway** : colle les variables (sauf `ALLOWED_ORIGINS`) → **Generate Domain** → URL backend.
3. **Vercel** : `NEXT_PUBLIC_API_BASE` = URL Railway + les 2 Supabase → **Redeploy** → URL front.
4. **Railway** : `ALLOWED_ORIGINS` = URL Vercel.
5. **Supabase + Google** : vérifier que l'URL Vercel est bien dans Auth→URL Config et JS origins.
6. Tester **« Se connecter avec Google »**.

## Schéma des appels
```
Navigateur ──(login)──> Supabase Auth ──(redirige vers)──> Google ──(retour token)──> Navigateur
Navigateur (front Vercel) ──(API + Bearer token)──> Backend Railway ──> Supabase (BDD/stockage) / OpenRouter / Drive
```
Chaque brique doit connaître l'adresse de l'autre : c'est tout ce que font ces variables.
