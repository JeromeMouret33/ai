"""Point d'entrée FastAPI.

Expose (Phase 3) les routes :
    - POST /upload      : dépôt des photos d'un véhicule + métadonnées (marque/modèle/infos).
    - POST /process     : lance un job (classification → génération → QC) en tâche de fond.
    - GET  /status/{id} : progression par photo d'un job.
    - POST /deliver     : renomme + envoie les photos cochées sur Google Drive.
    - GET/PUT /config   : lecture/édition des fragments de prompt et des paramètres.
    - GET  /history      : générations passées (source Drive) + suppression.

STUB — aucune logique implémentée. Sera câblé en Phase 1 (cœur) puis Phase 3 (API).
"""

# from fastapi import FastAPI
#
# app = FastAPI(title="Showroom IA — GOODCAR")
#
# TODO Phase 3 : déclarer les routes ci-dessus et brancher le pipeline.
