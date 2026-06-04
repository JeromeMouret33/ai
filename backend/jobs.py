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
from backend.pipeline import classify as classify_mod
from backend.pipeline import cost as cost_mod
from backend.pipeline import generate as generate_mod
from backend.pipeline import naming, prompt_builder
from backend.pipeline import qc as qc_mod
from backend.storage import supabase as sb

logger = logging.getLogger("showroom.jobs")

# Durée de validité des URLs signées des candidats (défaut 7 jours).
SIGNED_URL_TTL = int(os.environ.get("SIGNED_URL_TTL", str(7 * 24 * 3600)))


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

        verdict, qu = qc_mod.qc_usage(signed, config)
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
        angle, c = process_one(config, options, base_refs, job_id, photo)
        total_cost += c
        if angle:
            classified.append({"photo_id": photo["photo_id"], "angle": angle})

    job = sb.select("jobs", {"id": job_id})[0]
    angles = [c["angle"] for c in classified]
    for c, name in zip(classified, _target_names(job, angles, nomen)):
        sb.update("photos", {"id": c["photo_id"]}, {"target_filename": name})

    sb.update("jobs", {"id": job_id}, {"status": "done", "cost_total": total_cost})
    logger.info("job %s : terminé, coût total=%.4f", job_id, total_cost)


def retry_photo(photo_id: str) -> dict[str, Any]:
    """Relance ciblée d'une photo : re-télécharge la source (bucket uploads) et reprocess."""
    config = load_config()
    options, nomen = config["options"], config["nomenclature"]
    photo = sb.select("photos", {"id": photo_id})[0]
    job = sb.select("jobs", {"id": photo["job_id"]})[0]

    if not photo.get("source_url"):
        raise ValueError("Source indisponible pour la relance (source_url manquant).")

    data = sb.download(sb.BUCKET_UPLOADS, photo["source_url"])
    tmp = tempfile.NamedTemporaryFile(suffix=".img", delete=False)
    try:
        tmp.write(data)
        tmp.close()
        pdict = {"photo_id": photo_id, "source": photo["source_name"], "path": tmp.name,
                 "attempts": int(photo.get("attempts", 0))}
        angle, _ = process_one(config, options, _active_reference_urls(), job["id"], pdict)
        if angle:
            names = _target_names(job, [angle], nomen)
            sb.update("photos", {"id": photo_id}, {"target_filename": names[0]})
    finally:
        os.unlink(tmp.name)
    return sb.select("photos", {"id": photo_id})[0]
