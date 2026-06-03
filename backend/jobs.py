"""Traitement d'un job en tâche de fond (Phase 3).

Pour chaque photo : classify -> build prompt -> generate -> upload candidat -> qc,
avec persistance dans Supabase (tables jobs/photos, bucket outputs). PAS d'auto-
relance : le verdict QC est enregistré, la relance est déclenchée par l'UI.

Dépendances réseau (OpenRouter + Supabase) : non testable hors environnement ouvert.
"""

from __future__ import annotations

from typing import Any

from backend.config.loader import load_config
from backend.pipeline import classify as classify_mod
from backend.pipeline import generate as generate_mod
from backend.pipeline import naming, prompt_builder
from backend.pipeline import qc as qc_mod
from backend.storage import supabase as sb


def _active_reference_urls() -> dict[str, str]:
    """URLs publiques des assets actifs (showroom / logo / plaque)."""
    refs: dict[str, str] = {}
    for role in ("showroom", "logo", "plate"):
        asset = sb.get_active_asset(role)
        if asset and asset.get("url"):
            refs[role] = asset["url"]
    return refs


def process_job(job_id: str, photos: list[dict[str, str]]) -> None:
    """Traite toutes les photos d'un job.

    Args:
        job_id: id du job (table jobs).
        photos: liste de {"photo_id": ..., "source": ..., "path": <fichier local>}.
    """
    config = load_config()
    options = config["options"]
    nomen = config["nomenclature"]
    base_refs = _active_reference_urls()

    sb.update("jobs", {"id": job_id}, {"status": "processing"})

    classified: list[dict[str, Any]] = []
    for photo in photos:
        pid = photo["photo_id"]
        try:
            cls = classify_mod.classify(photo["path"], config)
            sb.update("photos", {"id": pid},
                      {"angle": cls["angle"], "confidence": cls["confidence"],
                       "status": "classified"})
            if cls["angle"] is None:
                sb.update("photos", {"id": pid}, {"status": "error"})
                continue

            built = prompt_builder.build(cls["angle"], options, config)
            references = {**base_refs, "vehicle": photo["path"]}
            images = generate_mod.generate(built, references, config)

            # 1er candidat (candidates_per_photo défaut = 1) -> bucket outputs.
            obj_path = f"{job_id}/{naming.safe_filename(photo['source'])}_cand01.png"
            sb.upload(sb.BUCKET_OUTPUTS, obj_path, images[0], content_type="image/png")
            url = sb.public_url(sb.BUCKET_OUTPUTS, obj_path)

            verdict = qc_mod.qc(url, config)
            sb.update("photos", {"id": pid},
                      {"candidate_url": url, "qc_verdict": verdict["verdict"],
                       "qc_reasons": verdict["reasons"],
                       "attempts": photo.get("attempts", 0) + 1, "status": "qc"})
            classified.append({"photo_id": pid, "angle": cls["angle"]})
        except Exception as exc:  # noqa: BLE001 - on isole chaque photo
            sb.update("photos", {"id": pid},
                      {"status": "error", "qc_reasons": [f"erreur: {exc}"]})

    # Noms de livraison selon la nomenclature (config).
    job = sb.select("jobs", {"id": job_id})[0]
    angles = [c["angle"] for c in classified]
    names = naming.assign_names(
        job["marque"], job["modele"], angles,
        file_template=nomen.get("fichier", naming.DEFAULT_FILE_TEMPLATE),
        always_indexed=set(nomen.get("toujours_numerotes", naming.ALWAYS_INDEXED)),
    )
    for c, name in zip(classified, names):
        sb.update("photos", {"id": c["photo_id"]}, {"target_filename": name})

    sb.update("jobs", {"id": job_id}, {"status": "done"})


def retry_photo(photo_id: str) -> dict[str, Any]:
    """Relance ciblée d'une photo (QC interactif / Phase 4)."""
    photo = sb.select("photos", {"id": photo_id})[0]
    job = sb.select("jobs", {"id": photo["job_id"]})[0]
    # La photo source d'origine doit être re-téléchargée par l'appelant ; ici on
    # suppose que candidate_url/source restent valides et on re-traite depuis le bucket uploads.
    process_job(job["id"], [{"photo_id": photo_id, "source": photo["source_name"],
                             "path": photo.get("candidate_url") or photo["source_name"],
                             "attempts": photo.get("attempts", 0)}])
    return sb.select("photos", {"id": photo_id})[0]
