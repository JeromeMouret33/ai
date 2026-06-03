"""Livraison d'un job sur Google Drive (Phase 2).

À partir d'un manifest (produit par l'orchestrateur CLI) et d'une sélection de
photos à garder (galerie de validation), crée le dossier véhicule et y téléverse
les candidats retenus, renommés selon la nomenclature.

`dry_run=True` renvoie le plan d'upload sans toucher au réseau (testable).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from backend.config.loader import load_config
from backend.storage import drive


def build_plan(manifest: dict[str, Any], selected_sources: set[str]) -> list[dict[str, Any]]:
    """Plan d'upload (pur) : un item par photo retenue ayant un candidat.

    Pour l'instant on retient le 1er candidat (candidates_per_photo défaut = 1) ;
    la sélection fine du candidat viendra de l'UI (Phase 3).
    """
    plan: list[dict[str, Any]] = []
    for photo in manifest.get("photos", []):
        if photo["source"] not in selected_sources:
            continue
        candidates = photo.get("candidates") or []
        if not candidates:
            continue
        plan.append(
            {
                "source": photo["source"],
                "target_filename": photo.get("target_filename") or photo["source"],
                "candidate_path": candidates[0]["path"],
            }
        )
    return plan


def deliver(
    manifest: dict[str, Any],
    selected_sources: set[str],
    config: dict[str, Any],
    *,
    service=None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Crée le dossier véhicule et téléverse les photos retenues."""
    parent_id = drive.parent_folder_id(config)
    folder_name = manifest.get("drive_folder") or "vehicule"
    plan = build_plan(manifest, selected_sources)

    if dry_run:
        return {"folder_name": folder_name, "parent_id": parent_id, "uploads": plan}

    service = service or drive._service()
    folder_id = drive.create_vehicle_folder(folder_name, parent_id, service=service)
    uploaded: list[dict[str, Any]] = []
    for item in plan:
        file_id = drive.upload_file(
            folder_id, item["candidate_path"], item["target_filename"], service=service
        )
        uploaded.append({**item, "drive_file_id": file_id})
    return {"folder_name": folder_name, "folder_id": folder_id, "uploads": uploaded}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Livraison Drive d'un job (Phase 2).")
    parser.add_argument("out_dir", help="Dossier de sortie du job (contient manifest.json).")
    parser.add_argument("--keep", nargs="*", default=None,
                        help="Noms des photos sources à livrer (défaut : toutes celles avec candidat).")
    parser.add_argument("--dry-run", action="store_true", help="Afficher le plan sans livrer.")
    args = parser.parse_args(argv)

    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    manifest = json.loads((Path(args.out_dir) / "manifest.json").read_text(encoding="utf-8"))
    config = load_config()

    if args.keep is None:
        selected = {p["source"] for p in manifest.get("photos", []) if p.get("candidates")}
    else:
        selected = set(args.keep)

    result = deliver(manifest, selected, config, dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
