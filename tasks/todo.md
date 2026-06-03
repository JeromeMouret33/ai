# TODO — Showroom virtuel IA pour véhicules (GOODCAR)

> Objectif : upload ~15 photos d'un véhicule → détection d'angle → génération IA du
> véhicule dans un showroom de marque fixe → renommage → livraison Google Drive.
> Rendu 100 % génératif, régularité par garde-fous, **tout réglable via une config éditable dans l'app**.

## Décisions verrouillées
- 100 % génératif via OpenRouter + Nano Banana Pro (`google/gemini-3-pro-image-preview`).
- 4 références : showroom, logo, véhicule, plaque d'immatriculation (option).
- Logo poussé en référence, fidélité max (mur du fond, haut gauche par défaut).
- Relighting version A (surfaces lisses + vitres latérales/arrière ; lumineux & détails verrouillés). Activable.
- Ratio = 3:2 (configurable). Résolution = 1K (configurable).
- 3 modèles distincts (classification / génération / QC), réglables dans l'app.
- QC à validation humaine : aperçu + confirmation avant relance (pas d'auto-relance silencieuse).
- Galerie de validation : on coche les photos à livrer avant envoi Drive.
- Historique des générations (source Drive) + suppression app ↔ dossier Drive.
- Dossiers véhicule créés dans un répertoire Drive parent configurable.
- Une plaque showroom par défaut ; bibliothèque extensible.
- Inpaint écarté pour l'instant (recours).
- Hébergement : frontend Vercel, backend Railway (ou Render), jobs en tâche de fond.
- Nb de candidats par photo configurable, défaut 1.

## Nomenclature
- Dossier Drive : `{Marque} {Modèle} {infos}` (ex. `Peugeot 208 GT-Line`).
- Fichiers : `{marque}-{modele}_{angle}.jpg`.
- Slugs d'angle : `face-avant`, `3-4-avant-gauche`, `3-4-avant-droit`, `profil-gauche`,
  `profil-droit`, `3-4-arriere-gauche`, `3-4-arriere-droit`, `arriere`, `interieur-01`, `detail-01`…
- Même angle ×N → suffixe `-01`, `-02`.

---

## Phase 0 — Scaffolding ✅
- [x] Plan consigné dans `tasks/todo.md` + spec verbatim dans `docs/SPEC.md`.
- [x] Arborescence de repo (backend / frontend / assets) + stubs documentés.
- [x] `.env.example`, `requirements.txt`, `.gitignore`, README projet.
- [x] Pack de prompts validé (version A) gravé : `prompts-config-goodcar.md`.
- [x] `prompt_fragments.yaml` + `params.yaml` remplis avec le contenu réel (fragments, presets d'angle, params).
- [x] Logique d'assemblage documentée dans `pipeline/prompt_builder.py`.

## Phase 1 — Config + cœur génératif (CLI, sans interface)
- [x] Schéma de config + chargeur (`config/loader.py`) : fragments + paramètres + 3 modèles + toggles + Drive.
- [x] Assembleur de prompt (`prompt_builder.py`) : concatène les fragments selon angle + options (logique §3) + substitution des variables.
- [x] Intégration OpenRouter (`pipeline/openrouter.py`) : `vision_json()` (classify/qc) + `generate_image()` — 1 clé, modèle par appel.
- [x] Classification (`classify.py`) → angle + confiance ; nomenclature (`naming.py`) → nom de fichier + dossier véhicule.
- [x] QC (`qc.py`) → verdict + raisons (relance laissée à l'UI) ; instructions classify/qc éditables dans la config.
- [x] Orchestrateur CLI (`cli.py`) : boucle sur un dossier, isole les erreurs par photo, écrit `manifest.json` + résumé.
- [x] Tests unitaires des parties pures (naming, prompt_builder, loader, parsing OpenRouter) — 19 tests verts.
- [x] Modèles choisis : classification + qc = `openai/gpt-4o-mini` (dans `params.yaml`, éditables dans l'app).
- [x] Nomenclature pilotée par la config (templates `dossier`/`fichier` + `toujours_numerotes` lus par `naming.py`).
- [ ] **Test end-to-end sur ~30 photos** — BLOQUÉ dans l'env web : politique réseau interdit `openrouter.ai`
      (403 "Host not in allowlist"). À lancer en local OU dans un env dont l'allowlist autorise openrouter.ai.
      Nécessite aussi de vraies photos + assets (showroom/logo/plaque), pas encore fournis.
- [x] Bug corrigé : en-têtes HTTP assainis en ASCII (`_ascii_header`) — voir lessons.md.

## Phase 2 — Stockage, nommage, livraison
- [x] Supabase : migration SQL (`supabase/migrations/0001_init.sql`) — buckets `references`/`uploads`/`outputs`.
- [x] Tables `jobs`, `photos` (statut, angle, tentatives, URLs, `kept`).
- [x] Table `reference_assets` (type showroom/logo/plaque, nom, URL, vignette, actif) + index « un actif par type ».
- [x] Client Supabase REST (`storage/supabase.py`) : insert/update/select, upload bucket, get/set asset actif.
- [x] Renommage selon nomenclature (`naming.py`, Phase 1) consommé par la livraison.
- [x] Livraison Google Drive (`storage/drive.py`) : `create_vehicle_folder` + `upload_file` + `delete_folder` + `list_history`.
- [x] Orchestration livraison (`storage/delivery.py`) : manifest + sélection → dossier + upload (mode `--dry-run`).
- [x] Tests parties pures stockage (URLs/headers Supabase, métadonnées Drive, plan de livraison) — total 25 tests verts.
- [ ] **Vérif live (Supabase + Drive)** — bloquée réseau (env web) ; à faire en local/env ouvert avec `SUPABASE_*` + `GOOGLE_*`.

## Phase 3 — Interface web (génération, validation, config, historique)
- [x] Scaffolding Next.js 16 (App Router, TS strict, Tailwind v4) + client API typé `frontend/src/lib/api.ts`.
- [x] Layout + barre de navigation entre les 5 écrans.
- [x] Front : drag-drop photos + champs (marque/modèle/infos) + lancer + progression par photo (polling 3s).
- [x] QC interactif : aperçu de la photo signalée (verdict ko) + choix relancer / garder.
- [x] Galerie de validation : aperçus + cases à cocher → livrer la sélection sur le Drive.
- [x] Écran de config : fragments, 3 modèles, options, paramètres, nomenclature + bibliothèque de références.
- [x] Historique : liste Drive + suppression.
- [x] `npm run build` vert + ESLint propre.
- [ ] Câblage front ↔ backend live + déploiement (Vercel + Railway/Render).

## Phase 4 — Robustesse & finitions
- [ ] Relance ciblée d'une photo, ajustements.
- [ ] Logs, gestion d'erreurs, suivi des coûts par job.
- [ ] Affinage des presets par angle.

---

## Garde-fous de régularité
- Références désignées par rôle (showroom / logo / véhicule / plaque), pas par numéro.
- Fragments figés en config ; seules variables = angle, cadrage, paramètres.
- Clauses de préservation : décor inchangé, voiture fidèle.
- Relight A limité aux surfaces lisses + vitres ; lumineux & détails fins verrouillés.
- Format de sortie constant (ratio + résolution). Presets de cadrage par angle.
- QC avec validation humaine avant relance.

## Prérequis externes (à fournir)
- `OPENROUTER_API_KEY`.
- Modèles OpenRouter pour `classification` et `qc` (le modèle `generation` est fixé : Nano Banana Pro).
- Identifiants Supabase (`SUPABASE_URL`, `SUPABASE_KEY`).
- Identifiants Google Drive (`GOOGLE_*`) + ID du répertoire parent.
- Assets : plaque showroom de référence, logo GOODCAR HD, image plaque d'immatriculation.

## Décisions encore ouvertes (cf. `prompts-config-goodcar.md` §8)
- Une seule plaque showroom, ou 2-3 selon l'angle (meilleur ancrage au sol).
- Hébergement backend : toujours actif (Railway/Render) vs serverless (jobs de plusieurs minutes).

## Décisions tranchées récemment
- Nb de candidats par photo = **1** par défaut (configurable dans l'app).
