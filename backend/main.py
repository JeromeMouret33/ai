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

import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import (
    APIRouter, BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.config import editor
from backend.config.loader import load_config
from backend.env import env_int, env_str
from backend.rate_limit import RateLimiter

logging.basicConfig(
    level=env_str("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("showroom.api")

app = FastAPI(title="Showroom IA — GOODCAR")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    logger.info("%s %s -> %s (%.0f ms)", request.method, request.url.path,
                response.status_code, (time.monotonic() - start) * 1000)
    return response


# Rate limiting des opérations coûteuses (génération OpenRouter payante), par utilisateur.
_job_limiter = RateLimiter(max_calls=env_int("JOBS_PER_MINUTE", 10), window_seconds=60)


def rate_limit_jobs(user: dict[str, Any] = Depends(get_current_user)) -> None:
    if not _job_limiter.allow(str(user.get("sub", "anon"))):
        raise HTTPException(429, "Trop de requêtes, réessayez dans un instant.")

# CORS : "*" en dev ; en prod, définir ALLOWED_ORIGINS (URLs séparées par des virgules,
# ex. l'URL Vercel du frontend). Vide -> "*" (évite de bloquer tout par mégarde).
_origins_env = env_str("ALLOWED_ORIGINS", "*")
_allow_origins = ["*"] if _origins_env == "*" else [o.strip() for o in _origins_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes protégées par l'authentification (toutes sauf /api/health).
protected = APIRouter(dependencies=[Depends(get_current_user)])

JOB_STORAGE = Path(env_str("JOB_STORAGE_DIR", "outputs"))
MAX_UPLOAD_BYTES = env_int("MAX_UPLOAD_BYTES", 25 * 1024 * 1024)  # 25 Mo/fichier


def _require_image(file: UploadFile) -> None:
    """Refuse tout fichier dont le type déclaré n'est pas une image."""
    if not (file.content_type or "").lower().startswith("image/"):
        raise HTTPException(400, f"Type de fichier non autorisé : {file.content_type}")


def _read_capped(data: bytes) -> bytes:
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Fichier trop volumineux.")
    return data


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
    _require_image(file)
    from backend.pipeline import naming
    from backend.storage import supabase as sb

    data = _read_capped(await file.read())
    path = f"{type}/{uuid.uuid4().hex}-{naming.safe_filename(file.filename or 'asset')}"
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
@protected.post("/api/jobs", dependencies=[Depends(rate_limit_jobs)])
async def create_job(
    background: BackgroundTasks,
    marque: str = Form(...),
    modele: str = Form(...),
    infos: str = Form(""),
    client_nom: str = Form(...),
    client_prenom: str = Form(""),
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    from backend.pipeline import naming
    from backend.storage import supabase as sb

    # Garde : un showroom ET un logo ACTIFS sont requis (rendus extérieurs).
    for role in ("showroom", "logo"):
        if not sb.get_active_asset(role):
            raise HTTPException(
                400,
                f"Aucun {role} actif. Sélectionne un {role} dans l'écran Configuration avant de générer.",
            )

    config = load_config()
    folder = naming.folder_name(
        marque, modele, infos,
        template=config["nomenclature"].get("dossier", naming.DEFAULT_FOLDER_TEMPLATE),
        client_nom=client_nom, client_prenom=client_prenom,
    )
    job = sb.insert("jobs", {"marque": marque, "modele": modele, "infos": infos,
                             "client_nom": client_nom, "client_prenom": client_prenom,
                             "drive_folder": folder, "status": "pending"})
    job_id = job["id"]

    job_dir = JOB_STORAGE / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    photos: list[dict[str, str]] = []
    for f in files:
        _require_image(f)
        source = naming.safe_filename(f.filename or "photo")
        data = _read_capped(await f.read())
        (job_dir / source).write_bytes(data)
        # Source persistée dans le bucket `uploads` (privé) → indispensable au retry.
        src_path = f"{job_id}/{source}"
        sb.upload(sb.BUCKET_UPLOADS, src_path, data, content_type=f.content_type or "image/jpeg")
        photo = sb.insert("photos", {"job_id": job_id, "source_name": source,
                                      "source_url": src_path, "status": "pending"})
        photos.append({"photo_id": photo["id"], "source": source, "path": str(job_dir / source)})

    from backend.jobs import process_job
    background.add_task(process_job, job_id, photos)
    logger.info("job %s créé (%d photos) : %s", job_id, len(photos), folder)
    return {"job_id": job_id, "drive_folder": folder, "photos": len(photos)}


@protected.get("/api/jobs")
def list_jobs() -> list[dict[str, Any]]:
    """Historique de l'app : jobs récents (plus récent d'abord) + nb de photos."""
    from backend.storage import supabase as sb
    rows = sb.select("jobs", columns="*,photos(count)", order="created_at.desc", limit=200)
    out: list[dict[str, Any]] = []
    for j in rows:
        photos = j.pop("photos", None)
        count = (
            photos[0].get("count")
            if isinstance(photos, list) and photos and isinstance(photos[0], dict)
            else None
        )
        out.append({**j, "photo_count": count})
    return out


@protected.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    from backend.storage import supabase as sb
    jobs = sb.select("jobs", {"id": job_id})
    if not jobs:
        raise HTTPException(404, "job introuvable")
    return {"job": jobs[0], "photos": sb.select("photos", {"job_id": job_id})}


@protected.delete("/api/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, str]:
    """Supprime un job de l'historique app : rendus + sources + enregistrements."""
    from backend.storage import supabase as sb
    for p in sb.select("photos", {"job_id": job_id}):
        if p.get("candidate_path"):
            sb.remove(sb.BUCKET_OUTPUTS, p["candidate_path"])
        if p.get("source_url"):
            sb.remove(sb.BUCKET_UPLOADS, p["source_url"])
    sb.delete("jobs", {"id": job_id})  # cascade -> supprime les photos
    logger.info("job %s supprimé (historique app)", job_id)
    return {"deleted": job_id}


@protected.post("/api/jobs/{job_id}/deliver")
def deliver_job(job_id: str, body: DeliverBody) -> dict[str, Any]:
    from backend.storage import delivery, drive, supabase as sb

    jobs = sb.select("jobs", {"id": job_id})
    if not jobs:
        raise HTTPException(404, "job introuvable")
    rows = sb.select("photos", {"job_id": job_id})
    # Candidats stockés dans le bucket privé `outputs` : on les télécharge puis on
    # les pousse sur Drive (renommés). On réutilise build_plan (pur, testé).
    manifest = {
        "drive_folder": jobs[0]["drive_folder"],
        "photos": [
            {"source": p["source_name"], "target_filename": p.get("target_filename"),
             "candidates": [{"path": p["candidate_path"]}] if p.get("candidate_path") else []}
            for p in rows
        ],
    }
    config = load_config()
    plan = delivery.build_plan(manifest, set(body.sources))
    parent_id = drive.parent_folder_id(config)
    folder_id = drive.create_vehicle_folder(jobs[0]["drive_folder"], parent_id)
    uploads: list[dict[str, Any]] = []
    for item in plan:
        data = sb.download(sb.BUCKET_OUTPUTS, item["candidate_path"])
        file_id = drive.upload_bytes(folder_id, data, item["target_filename"])
        uploads.append({"target_filename": item["target_filename"], "drive_file_id": file_id})

    sb.update("jobs", {"id": job_id}, {
        "status": "delivered", "drive_folder_id": folder_id,
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    })
    for src in body.sources:
        sb.update("photos", {"job_id": job_id, "source_name": src}, {"kept": True})

    # Purge optionnelle des rendus du stockage app après export (option Config).
    if config["options"].get("purge_apres_export"):
        for item in plan:
            sb.remove(sb.BUCKET_OUTPUTS, item["candidate_path"])
        for src in body.sources:
            sb.update("photos", {"job_id": job_id, "source_name": src},
                      {"candidate_url": None, "candidate_path": None})

    logger.info("job %s exporté : %d fichiers -> dossier %s", job_id, len(uploads), folder_id)
    return {"folder_name": jobs[0]["drive_folder"], "folder_id": folder_id, "uploads": uploads}


@protected.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict[str, str]:
    """Demande l'annulation : le traitement stoppe avant la prochaine photo."""
    from backend.storage import supabase as sb
    sb.update("jobs", {"id": job_id}, {"cancel_requested": True})
    logger.info("annulation demandée pour le job %s", job_id)
    return {"cancel_requested": job_id}


@protected.post("/api/photos/{photo_id}/retry", dependencies=[Depends(rate_limit_jobs)])
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
