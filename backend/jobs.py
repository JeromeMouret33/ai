"""Traitement d'un job en tâche de fond (Phase 3 + robustesse Phase 4).

Pour chaque photo : classify -> build prompt -> generate -> upload candidat (bucket
privé `outputs`, servi via URL signée) -> qc, avec persistance Supabase et **suivi
des coûts** (usage OpenRouter agrégé). PAS d'auto-relance : le verdict QC est
enregistré, la relance est déclenchée par l'UI (`retry_photo`).

Dépendances réseau (OpenRouter + Supabase) : non testable hors environnement ouvert.
"""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Any

from backend.config.loader import load_config
from backend.env import env_int
from backend.pipeline import classify as classify_mod
from backend.pipeline import cost as cost_mod
from backend.pipeline import generate as generate_mod
from backend.pipeline import naming, prompt_builder
from backend.pipeline import qc as qc_mod
from backend.storage import supabase as sb

logger = logging.getLogger("showroom.jobs")

# Durée de validité des URLs signées des candidats (défaut 30 jours : les vignettes
# de Validation restent visibles si un job est repris tardivement).
SIGNED_URL_TTL = env_int("SIGNED_URL_TTL", 30 * 24 * 3600)


def _is_cancelled(job_id: str) -> bool:
    rows = sb.select("jobs", {"id": job_id})
    return bool(rows and rows[0].get("cancel_requested"))


def _active_reference_urls() -> dict[str, str]:
    """URLs publiques des assets actifs (showroom / logo / plaque)."""
    refs: dict[str, str] = {}
    for role in ("showroom", "logo", "plate"):
        asset = sb.get_active_asset(role)
        if asset and asset.get("url"):
            refs[role] = asset["url"]
    return refs


def _target_names(job: dict[str, Any], angles: list[str], nomen: dict[str, Any]) -> list[str]:
    return naming.assign_names(
        job["marque"], job["modele"], angles,
        file_template=nomen.get("fichier", naming.DEFAULT_FILE_TEMPLATE),
        always_indexed=set(nomen.get("toujours_numerotes", naming.ALWAYS_INDEXED)),
    )


def _refresh_job_names(job: dict[str, Any], nomen: dict[str, Any]) -> None:
    """Recalcule les noms de TOUTES les photos classées du job (ordre d'upload).

    Indispensable après une régénération : nommer une photo isolément ferait
    perdre les suffixes -01/-02 et créerait des collisions de noms dans le zip.
    """
    photos = sb.select("photos", {"job_id": job["id"]}, order="created_at.asc")
    classified = [p for p in photos if p.get("angle")]
    names = _target_names(job, [p["angle"] for p in classified], nomen)
    for p, name in zip(classified, names):
        if p.get("target_filename") != name:
            sb.update("photos", {"id": p["id"]}, {"target_filename": name})


def process_one(
    config: dict[str, Any],
    options: dict[str, Any],
    base_refs: dict[str, str],
    job_id: str,
    photo: dict[str, Any],
) -> tuple[str | None, float]:
    """Traite une photo. Renvoie (angle | None, coût)."""
    pid = photo["photo_id"]
    source = photo["source"]
    usage: dict[str, Any] = {}
    try:
        cls, u = classify_mod.classify_usage(photo["path"], config)
        usage = cost_mod.merge_usage(usage, u)
        sb.update("photos", {"id": pid},
                  {"angle": cls["angle"], "confidence": cls["confidence"], "status": "classified"})
        if cls["angle"] is None:
            sb.update("photos", {"id": pid},
                      {"status": "error", "cost": usage.get("cost", 0.0), "usage": usage})
            logger.info("photo %s : angle non reconnu", source)
            return None, float(usage.get("cost", 0.0))

        built = prompt_builder.build(cls["angle"], options, config)
        references = {**base_refs, "vehicle": photo["path"]}
        images, gu = generate_mod.generate_usage(built, references, config)
        usage = cost_mod.merge_usage(usage, gu)

        obj_path = f"{job_id}/{naming.safe_filename(source)}_cand01.png"
        sb.upload(sb.BUCKET_OUTPUTS, obj_path, images[0], content_type="image/png")
        signed = sb.create_signed_url(sb.BUCKET_OUTPUTS, obj_path, SIGNED_URL_TTL)

        # QC avec la photo SOURCE en 2e image : il peut réellement comparer la fidélité.
        verdict, qu = qc_mod.qc_usage(signed, config, source_path=photo["path"])
        usage = cost_mod.merge_usage(usage, qu)

        sb.update("photos", {"id": pid}, {
            "candidate_url": signed, "candidate_path": obj_path,
            "qc_verdict": verdict["verdict"], "qc_reasons": verdict["reasons"],
            "attempts": int(photo.get("attempts", 0)) + 1,
            "cost": float(usage.get("cost", 0.0)), "usage": usage, "status": "qc",
        })
        logger.info("photo %s : angle=%s qc=%s coût=%.4f",
                    source, cls["angle"], verdict["verdict"], usage.get("cost", 0.0))
        return cls["angle"], float(usage.get("cost", 0.0))
    except Exception as exc:  # noqa: BLE001 - on isole chaque photo
        logger.exception("photo %s : échec", source)
        sb.update("photos", {"id": pid},
                  {"status": "error", "qc_reasons": [f"erreur: {exc}"],
                   "cost": float(usage.get("cost", 0.0)), "usage": usage})
        return None, float(usage.get("cost", 0.0))


def process_job(job_id: str, photos: list[dict[str, Any]]) -> None:
    """Traite toutes les photos d'un job."""
    config = load_config()
    options, nomen = config["options"], config["nomenclature"]
    base_refs = _active_reference_urls()

    sb.update("jobs", {"id": job_id}, {"status": "processing"})
    logger.info("job %s : démarrage (%d photos)", job_id, len(photos))

    classified: list[dict[str, Any]] = []
    total_cost = 0.0
    for photo in photos:
        # Annulation demandée -> on stoppe AVANT la prochaine génération payante.
        if _is_cancelled(job_id):
            sb.update("jobs", {"id": job_id},
                      {"status": "cancelled", "cost_total": total_cost})
            logger.info("job %s : ANNULÉ (%.4f déjà dépensé)", job_id, total_cost)
            return
        angle, c = process_one(config, options, base_refs, job_id, photo)
        total_cost += c
        if angle:
            classified.append({"photo_id": photo["photo_id"], "angle": angle})

    job = sb.select("jobs", {"id": job_id})[0]
    if classified:
        _refresh_job_names(job, nomen)

    final = "cancelled" if _is_cancelled(job_id) else "done"
    sb.update("jobs", {"id": job_id}, {"status": final, "cost_total": total_cost})
    logger.info("job %s : %s, coût total=%.4f", job_id, final, total_cost)


def retry_photo(photo_id: str) -> dict[str, Any]:
    """Relance ciblée d'une photo : re-télécharge la source (bucket uploads) et reprocess.

    Tourne en tâche de fond : toute erreur est PERSISTÉE sur la photo (statut error
    + raison) pour ne jamais la laisser coincée en « pending ».
    """
    config = load_config()
    options, nomen = config["options"], config["nomenclature"]
    photo = sb.select("photos", {"id": photo_id})[0]
    job = sb.select("jobs", {"id": photo["job_id"]})[0]

    if not photo.get("source_url"):
        sb.update("photos", {"id": photo_id}, {
            "status": "error",
            "qc_reasons": ["Relance impossible : photo source introuvable (job antérieur)."],
        })
        return sb.select("photos", {"id": photo_id})[0]

    try:
        data = sb.download(sb.BUCKET_UPLOADS, photo["source_url"])
    except Exception as exc:  # noqa: BLE001 - on persiste l'échec pour l'UI
        logger.exception("retry %s : téléchargement source impossible", photo_id)
        sb.update("photos", {"id": photo_id},
                  {"status": "error", "qc_reasons": [f"Relance impossible : {exc}"]})
        return sb.select("photos", {"id": photo_id})[0]

    tmp = tempfile.NamedTemporaryFile(suffix=".img", delete=False)
    try:
        tmp.write(data)
        tmp.close()
        pdict = {"photo_id": photo_id, "source": photo["source_name"], "path": tmp.name,
                 "attempts": int(photo.get("attempts", 0))}
        angle, retry_cost = process_one(config, options, _active_reference_urls(),
                                        job["id"], pdict)
        if angle:
            # Recalcul GLOBAL des noms (garde les suffixes -01/-02 cohérents).
            _refresh_job_names(job, nomen)
        # Le coût de la relance s'ajoute au coût total du job.
        if retry_cost:
            sb.update("jobs", {"id": job["id"]},
                      {"cost_total": float(job.get("cost_total") or 0.0) + retry_cost})
    finally:
        os.unlink(tmp.name)
    return sb.select("photos", {"id": photo_id})[0]
