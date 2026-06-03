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
Scaffolding posé (Phase 0). Suite du plan détaillé dans [`tasks/todo.md`](tasks/todo.md).

## Démarrage (à venir, Phase 1)
```bash
cp .env.example .env        # renseigner OPENROUTER_API_KEY
pip install -r backend/requirements.txt
# orchestrateur CLI : à implémenter en Phase 1
```
