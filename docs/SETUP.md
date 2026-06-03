# Guide de setup — Showroom IA (GOODCAR)

Configuration des services externes pour faire tourner la chaîne complète en ligne.
3 services à configurer : **OpenRouter** (IA), **Supabase** (stockage + base), **Google Drive** (livraison).
Puis 2 hébergements : **Railway/Render** (backend) et **Vercel** (frontend).

> Astuce : tu n'as pas besoin de tout d'un coup. Voir « Tester par paliers » en bas.

---

## 1. OpenRouter (indispensable)

1. Compte sur https://openrouter.ai → **Keys** → créer une clé.
2. Crédits : ajouter un peu de crédit (la génération Nano Banana Pro est payante).
3. Garde la clé pour `OPENROUTER_API_KEY`.

Modèles utilisés (déjà dans `backend/config/params.yaml`, éditables dans l'app) :
- classification : `openai/gpt-4o-mini`
- génération : `google/gemini-3-pro-image-preview` (Nano Banana Pro)
- QC : `openai/gpt-4o-mini`

---

## 2. Supabase (indispensable)

1. Créer un projet sur https://supabase.com.
2. **Schéma** : SQL Editor → coller le contenu de `supabase/migrations/0001_init.sql` → **Run**.
   Ça crée les tables `jobs`, `photos`, `reference_assets` **et** les buckets `references`, `uploads`, `outputs`.
3. Vérifier les buckets : Storage → `references` et `outputs` doivent être **publics**, `uploads` privé
   (le SQL les crée déjà ainsi ; ajuster si besoin).
4. Settings → **API** :
   - Project URL → `SUPABASE_URL`
   - clé **`service_role`** (secrète, backend uniquement) → `SUPABASE_KEY`

> ⚠️ Ne jamais exposer la clé `service_role` côté frontend.

---

## 2bis. Authentification (Supabase Auth — Google OAuth, invite-only)

L'app est protégée : seuls les utilisateurs autorisés peuvent y accéder.

### Côté Supabase
1. **Authentication → Providers → Google** : activer, coller le `Client ID` / `Client secret`
   d'identifiants OAuth Google (peuvent être les mêmes que pour Drive, ou dédiés).
   Ajouter l'URL de callback indiquée par Supabase dans la console Google.
2. **Authentication → Providers → Email** : désactiver les inscriptions publiques
   (« Allow new users to sign up » = OFF) → mode **invite-only**.
3. **Authentication → Users** : inviter manuellement les emails autorisés
   (ou ils se connectent via Google s'ils sont dans la liste).
4. **Settings → API → JWT Secret** : copier → `SUPABASE_JWT_SECRET` (backend).

### Côté backend
- `SUPABASE_JWT_SECRET` : active la vérification du token sur toutes les routes (sauf `/health`).
  ⚠️ Si non défini, l'auth est **désactivée** (dev uniquement).
- `AUTH_ALLOWED_EMAILS` (optionnel) : liste blanche d'emails, défense en profondeur.

### Côté frontend (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API → anon public)
  pour l'écran de connexion `@supabase/supabase-js`. Le front envoie ensuite le JWT
  dans l'en-tête `Authorization: Bearer <token>` à chaque appel API.

### Sign in with Apple (Face ID / Touch ID sur iPhone)
Sur les appareils Apple, « Se connecter avec Apple » authentifie via l'Apple ID
(donc **Face ID / Touch ID**). À configurer en plus de Google :

1. **Apple Developer** (compte payant ~99 $/an requis) :
   - Crée un **App ID** puis un **Services ID** (c'est le « client_id » web).
   - Active « Sign In with Apple », déclare le **domaine** et l'**URL de retour**
     fournie par Supabase (`https://<projet>.supabase.co/auth/v1/callback`).
   - Crée une **clé privée** Sign In with Apple (.p8) + note Key ID et Team ID ;
     Supabase génère le `client_secret` à partir de ces éléments.
2. **Supabase → Authentication → Providers → Apple** : activer, renseigner le
   Services ID + le secret. Aucun changement backend (le JWT reste un JWT Supabase,
   déjà vérifié par `backend/auth.py`).
3. **Frontend** : ajouter le bouton « Apple » (même flux que Google via
   `signInWithOAuth({ provider: 'apple' })`).

> Note : Sign in with Apple impose l'inscription au Apple Developer Program. Si tu
> ne l'as pas encore, Google OAuth suffit pour démarrer ; Apple s'ajoute ensuite
> sans rien casser.

---

## 3. Google Drive (nécessaire seulement pour la livraison + l'historique)

### 3.1 Projet & API
1. https://console.cloud.google.com → nouveau projet.
2. **APIs & Services → Library** → activer **Google Drive API**.

### 3.2 Identifiants OAuth
3. **APIs & Services → OAuth consent screen** : type « External », ajoute ton email en *test user*.
4. **Credentials → Create credentials → OAuth client ID** → type **Web application**.
   - Ajoute `https://developers.google.com/oauthplayground` dans *Authorized redirect URIs*.
   - Note `client_id` → `GOOGLE_CLIENT_ID` et `client_secret` → `GOOGLE_CLIENT_SECRET`.

### 3.3 Refresh token (via OAuth Playground)
5. https://developers.google.com/oauthplayground
6. Roue crantée (⚙, en haut à droite) → coche **Use your own OAuth credentials** → colle client_id / client_secret.
7. Étape 1 (gauche) : dans « Input your own scopes », saisis :
   ```
   https://www.googleapis.com/auth/drive
   ```
   → **Authorize APIs** → connecte-toi avec le compte propriétaire du Drive.
8. Étape 2 : **Exchange authorization code for tokens**.
9. Copie le **Refresh token** → `GOOGLE_REFRESH_TOKEN`.

> Le refresh token n'expire pas tant que l'app reste en mode test/validée et que l'accès n'est pas révoqué.

### 3.4 Dossier parent
10. Dans Google Drive, crée (ou choisis) le dossier où seront créés les dossiers véhicule.
11. Ouvre-le : l'**ID** est dans l'URL `https://drive.google.com/drive/folders/<ID>`.
12. → `GOOGLE_DRIVE_PARENT_FOLDER_ID` (ou renseigne `drive_parent_folder` dans la config de l'app).

---

## 4. Variables d'environnement

Copie `.env.example` → `.env` (en local) et renseigne. En prod, déclare-les comme secrets de la plateforme.

```
OPENROUTER_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_PARENT_FOLDER_ID=
```

Frontend (Vercel) : une seule variable —
```
NEXT_PUBLIC_API_BASE=https://<ton-backend>.up.railway.app
```

---

## 5. Hébergement backend (Railway ou Render)

Service **toujours actif** (les jobs tournent en tâche de fond).

1. Connecte le repo à Railway/Render.
2. Build : `pip install -r backend/requirements.txt`
3. Start : `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Déclare toutes les variables de la section 4.
5. Note l'URL publique du service (pour `NEXT_PUBLIC_API_BASE`).

> Le backend écrit les uploads dans un dossier temporaire pendant le traitement
> (`JOB_STORAGE_DIR`, défaut `outputs`) ; la persistance réelle est dans Supabase.

---

## 6. Hébergement frontend (Vercel)

1. Importe le repo, **Root Directory = `frontend`**.
2. Framework détecté : Next.js (build auto).
3. Variable d'env : `NEXT_PUBLIC_API_BASE` = URL du backend.
4. Deploy.

> CORS : le backend autorise toutes les origines en dev (`allow_origins=["*"]`).
> En prod, restreindre à l'URL Vercel dans `backend/main.py`.

---

## 7. Tester par paliers (recommandé)

1. **OpenRouter seul** (ni Supabase ni Drive) — valide le cœur génératif en local :
   ```bash
   cp .env.example .env        # renseigner OPENROUTER_API_KEY
   pip install -r backend/requirements.txt
   python -m backend.cli ./photos --marque Peugeot --modele "208 GT-Line" \
       --showroom assets/showroom.png --logo assets/logo.png --plate assets/plate.png
   ```
   → vérifie classification + génération + QC + nomenclature (sorties dans `outputs/`).

2. **+ Supabase** — lance backend + frontend : upload, génération, galerie de validation,
   config et bibliothèque de références fonctionnent (livraison Drive encore inactive).
   ```bash
   uvicorn backend.main:app --reload      # terminal 1
   cd frontend && npm install && npm run dev   # terminal 2
   ```

3. **+ Google Drive** — la livraison (galerie → « Livrer ») et l'historique s'activent.

---

## Récap des fichiers du projet liés au setup
- `.env.example` — gabarit des variables.
- `supabase/migrations/0001_init.sql` — schéma + buckets.
- `backend/config/params.yaml` — modèles, ratio, nomenclature, options, dossier Drive (éditable dans l'app).
- `backend/config/prompt_fragments.yaml` — fragments de prompt (éditable dans l'app).
