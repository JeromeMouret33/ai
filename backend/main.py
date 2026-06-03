"""API FastAPI — Showroom IA (GOODCAR).

Routes (préfixe /api) :
    GET  /health
    GET  /config                      lecture config (fragments + params)
    PUT  /config                      édition config (round-trip YAML)
    GET  /reference-assets            bibliothèque de références
    POST /reference-assets            upload d'un asset (showroom/logo/plaque)
    PUT  /reference-assets/{id}/active  choix de l'asset actif
    POST /jobs                        crée un job + upload photos + traitement en tâche de fond
    GET  /jobs/{id}                   statut + progression par photo
    POST /jobs/{id}/deliver           livraison Drive de la sélection cochée
    POST /photos/{id}/retry           relance ciblée d'une photo (QC interactif)
    GET  /history                     générations passées (source Drive)
    DELETE /history/{folder_id}       suppression app + dossier Drive

Les handlers réseau (Supabase/Drive) importent leurs modules paresseusement :
l'app et les endpoints de config restent testables hors-ligne.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

from fastapi import (
    APIRouter, BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.config import editor
from backend.config.loader import load_config

app = FastAPI(title="Showroom IA — GOODCAR")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev : à restreindre en prod
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes protégées par l'authentification (toutes sauf /api/health).
protected = APIRouter(dependencies=[Depends(get_current_user)])

JOB_STORAGE = Path(os.environ.get("JOB_STORAGE_DIR", "outputs"))


# --------------------------------------------------------------------------- #
# Modèles de requête
# --------------------------------------------------------------------------- #
class ConfigPatch(BaseModel):
    params: dict[str, Any] | None = None      # patch params.yaml (parametres/options/nomenclature/...)
    fragments: dict[str, Any] | None = None   # patch prompt_fragments.yaml


class DeliverBody(BaseModel):
    sources: list[str]  # noms des photos sources à livrer


# --------------------------------------------------------------------------- #
# Santé & configuration
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@protected.get("/api/config")
def get_config() -> dict[str, Any]:
    return load_config()


@protected.put("/api/config")
def put_config(patch: ConfigPatch) -> dict[str, Any]:
    if patch.params:
        editor.update_params(patch.params)
    if patch.fragments:
        editor.update_fragments(patch.fragments)
    return load_config()


# --------------------------------------------------------------------------- #
# Bibliothèque de références
# --------------------------------------------------------------------------- #
@protected.get("/api/reference-assets")
def list_reference_assets(type: str | None = None) -> list[dict[str, Any]]:
    from backend.storage import supabase as sb
    return sb.list_reference_assets(type)


@protected.post("/api/reference-assets")
async def upload_reference_asset(
    type: str = Form(...), name: str = Form(...), file: UploadFile = File(...)
) -> dict[str, Any]:
    if type not in ("showroom", "logo", "plate"):
        raise HTTPException(400, "type invalide (showroom/logo/plate)")
    from backend.storage import supabase as sb

    data = await file.read()
    path = f"{type}/{uuid.uuid4().hex}-{file.filename}"
    sb.upload(sb.BUCKET_REFERENCES, path, data, content_type=file.content_type or "image/png")
    url = sb.public_url(sb.BUCKET_REFERENCES, path)
    return sb.insert("reference_assets", {"type": type, "name": name, "url": url})


@protected.put("/api/reference-assets/{asset_id}/active")
def activate_reference_asset(asset_id: str, type: str = Form(...)) -> dict[str, Any]:
    from backend.storage import supabase as sb
    return sb.set_active_asset(asset_id, type)


# --------------------------------------------------------------------------- #
# Jobs
# --------------------------------------------------------------------------- #
@protected.post("/api/jobs")
async def create_job(
    background: BackgroundTasks,
    marque: str = Form(...),
    modele: str = Form(...),
    infos: str = Form(""),
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    from backend.pipeline import naming
    from backend.storage import supabase as sb

    config = load_config()
    folder = naming.folder_name(
        marque, modele, infos,
        template=config["nomenclature"].get("dossier", naming.DEFAULT_FOLDER_TEMPLATE),
    )
    job = sb.insert("jobs", {"marque": marque, "modele": modele, "infos": infos,
                             "drive_folder": folder, "status": "pending"})
    job_id = job["id"]

    job_dir = JOB_STORAGE / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    photos: list[dict[str, str]] = []
    for f in files:
        local = job_dir / f.filename
        local.write_bytes(await f.read())
        photo = sb.insert("photos", {"job_id": job_id, "source_name": f.filename,
                                      "status": "pending"})
        photos.append({"photo_id": photo["id"], "source": f.filename, "path": str(local)})

    from backend.jobs import process_job
    background.add_task(process_job, job_id, photos)
    return {"job_id": job_id, "drive_folder": folder, "photos": len(photos)}


@protected.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    from backend.storage import supabase as sb
    jobs = sb.select("jobs", {"id": job_id})
    if not jobs:
        raise HTTPException(404, "job introuvable")
    return {"job": jobs[0], "photos": sb.select("photos", {"job_id": job_id})}


@protected.post("/api/jobs/{job_id}/deliver")
def deliver_job(job_id: str, body: DeliverBody) -> dict[str, Any]:
    from backend.storage import delivery, supabase as sb

    jobs = sb.select("jobs", {"id": job_id})
    if not jobs:
        raise HTTPException(404, "job introuvable")
    rows = sb.select("photos", {"job_id": job_id})
    manifest = {
        "drive_folder": jobs[0]["drive_folder"],
        "photos": [
            {"source": p["source_name"], "target_filename": p.get("target_filename"),
             "candidates": [{"path": p["candidate_url"]}] if p.get("candidate_url") else []}
            for p in rows
        ],
    }
    result = delivery.deliver(manifest, set(body.sources), load_config())
    sb.update("jobs", {"id": job_id},
              {"status": "delivered", "drive_folder_id": result.get("folder_id")})
    for src in body.sources:
        sb.update("photos", {"job_id": job_id, "source_name": src}, {"kept": True})
    return result


@protected.post("/api/photos/{photo_id}/retry")
def retry(photo_id: str) -> dict[str, Any]:
    from backend.jobs import retry_photo
    return retry_photo(photo_id)


# --------------------------------------------------------------------------- #
# Historique (source Drive)
# --------------------------------------------------------------------------- #
@protected.get("/api/history")
def history() -> list[dict[str, Any]]:
    from backend.storage import drive
    return drive.list_history(drive.parent_folder_id(load_config()))


@protected.delete("/api/history/{folder_id}")
def delete_history(folder_id: str) -> dict[str, str]:
    from backend.storage import drive, supabase as sb
    drive.delete_folder(folder_id)
    sb.update("jobs", {"drive_folder_id": folder_id}, {"status": "error"})
    return {"deleted": folder_id}


# Montage des routes protégées.
app.include_router(protected)
