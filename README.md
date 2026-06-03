# Showroom virtuel IA pour véhicules — GOODCAR

Automatise la chaîne : **upload de ~15 photos d'un véhicule → détection de l'angle →
génération IA du véhicule intégré dans un showroom de marque fixe → renommage →
livraison sur Google Drive**. Rendu 100 % génératif, régularité obtenue par garde-fous,
**tout réglable via une config éditable dans l'app**.

## Stack
- **IA** : OpenRouter (1 clé, API compatible OpenAI) — classification, génération, QC.
- **Modèle image** : Nano Banana Pro (`google/gemini-3-pro-image-preview`).
- **Backend** : Python / FastAPI (Railway ou Render), jobs longs en tâche de fond.
- **Frontend** : Next.js (Vercel).
- **Stockage** : Supabase (buckets + base).
- **Livraison** : Google Drive (dossier au nom du véhicule).

## Trois rôles IA (modèles distincts, configurables)
1. **Classification** (vision) → angle + confiance → renommage + dossier véhicule.
2. **Génération** (image, défaut Nano Banana Pro) → 4 références + prompt assemblé + preset d'angle.
3. **Contrôle qualité** (vision) → verdict + raisons, vérif zoomée des zones sensibles.
   En cas de souci : **validation humaine** avant relance (pas d'auto-relance silencieuse).

## Structure
```
backend/
├── main.py            # FastAPI : upload / process / status / deliver / config / history
├── config/            # prompt_fragments.yaml + params.yaml (éditables dans l'app)
├── pipeline/          # prompt_builder, classify, generate, qc, naming
└── storage/           # supabase.py, drive.py
frontend/              # Next.js (Phase 3)
assets/                # showroom, logo, plaque
.env.example           # OPENROUTER / SUPABASE / GOOGLE
```

## État
Phase 1 (cœur génératif CLI) implémentée — voir [`tasks/todo.md`](tasks/todo.md).
Reste le test end-to-end (nécessite la clé OpenRouter + les modèles classification/QC).

## Démarrage (Phase 1 — CLI)
```bash
cp .env.example .env        # renseigner OPENROUTER_API_KEY
pip install -r backend/requirements.txt

# Renseigner les modèles classification/qc dans backend/config/params.yaml,
# puis lancer l'orchestrateur depuis la racine du repo :
python -m backend.cli ./photos \
    --marque Peugeot --modele "208 GT-Line" \
    --showroom assets/showroom.png --logo assets/logo.png --plate assets/plate.png

# Variantes utiles :
python -m backend.cli ./photos --marque Peugeot --modele 208 --classify-only  # classer sans générer
python -m backend.cli ./photos --marque Peugeot --modele 208 --no-qc          # générer sans QC

# Tests (parties pures, sans réseau) :
python -m pytest backend/tests -q
```
Sorties : `outputs/<vehicule>/candidates/*.png` + `outputs/<vehicule>/manifest.json`.
