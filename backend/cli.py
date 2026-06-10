"""Orchestrateur CLI — cœur génératif Phase 1 (sans interface).

Boucle sur un dossier de photos d'un véhicule :
    classify -> prompt_builder.build -> generate
Écrit les candidats générés + un manifest.json, et affiche un résumé.

Pas de QC automatique ni de livraison Drive : ces étapes vivent dans l'app.

Exemple :
    OPENROUTER_API_KEY=... python -m backend.cli ./photos \
        --marque Peugeot --modele "208 GT-Line" \
        --showroom assets/showroom.png --logo assets/logo.png --plate assets/plate.png
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from backend.config.loader import load_config
from backend.pipeline import classify as classify_mod
from backend.pipeline import generate as generate_mod
from backend.pipeline import naming, prompt_builder

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_CONFIG_DIR = Path(__file__).parent / "config"


def list_images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS)


def process_folder(args: argparse.Namespace) -> dict[str, Any]:
    config = load_config(str(args.config_dir))
    options = config["options"]

    input_dir = Path(args.input)
    photos = list_images(input_dir)
    if not photos:
        raise SystemExit(f"Aucune image trouvée dans {input_dir}")

    out_dir = Path(args.output) / naming.slugify(f"{args.marque}-{args.modele}")
    candidates_dir = out_dir / "candidates"
    candidates_dir.mkdir(parents=True, exist_ok=True)

    base_references = {
        "showroom": args.showroom,
        "logo": args.logo,
        "plate": args.plate,
    }

    results: list[dict[str, Any]] = []
    for photo in photos:
        entry: dict[str, Any] = {"source": photo.name, "errors": []}
        try:
            cls = classify_mod.classify(str(photo), config)
            entry["angle"] = cls["angle"]
            entry["confidence"] = cls["confidence"]
        except Exception as exc:  # noqa: BLE001 - on isole chaque photo
            entry["errors"].append(f"classify: {exc}")
            results.append(entry)
            continue

        if cls["angle"] is None:
            entry["errors"].append("angle non reconnu — à classer manuellement")
            results.append(entry)
            continue

        if args.classify_only:
            results.append(entry)
            continue

        try:
            built = prompt_builder.build(cls["angle"], options, config)
            references = {**base_references, "vehicle": str(photo)}
            images = generate_mod.generate(built, references, config)
        except Exception as exc:  # noqa: BLE001
            entry["errors"].append(f"generate: {exc}")
            results.append(entry)
            continue

        entry["candidates"] = []
        for i, img in enumerate(images, start=1):
            cand_path = candidates_dir / f"{photo.stem}_cand{i:02d}.png"
            cand_path.write_bytes(img)
            entry["candidates"].append({"path": str(cand_path)})
        results.append(entry)

    # Nomenclature lue depuis la config (éditable dans l'app).
    nomen = config["nomenclature"]
    folder_tpl = nomen.get("dossier", naming.DEFAULT_FOLDER_TEMPLATE)
    file_tpl = nomen.get("fichier", naming.DEFAULT_FILE_TEMPLATE)
    always_indexed = set(nomen.get("toujours_numerotes", naming.ALWAYS_INDEXED))

    # Noms de livraison (ordre d'entrée) pour les photos correctement classées.
    classified = [e for e in results if e.get("angle")]
    angles = [e["angle"] for e in classified]
    target_names = naming.assign_names(
        args.marque, args.modele, angles, file_template=file_tpl, always_indexed=always_indexed
    )
    for entry, name in zip(classified, target_names):
        entry["target_filename"] = name

    manifest = {
        "vehicle": {"marque": args.marque, "modele": args.modele, "infos": args.infos},
        "drive_folder": naming.folder_name(args.marque, args.modele, args.infos, template=folder_tpl),
        "photos": results,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    manifest["_out_dir"] = str(out_dir)
    return manifest


def print_summary(manifest: dict[str, Any]) -> None:
    print(f"\nDossier véhicule : {manifest['drive_folder']}")
    print(f"Sortie           : {manifest['_out_dir']}\n")
    for e in manifest["photos"]:
        angle = e.get("angle") or "?"
        conf = e.get("confidence")
        conf_s = f"{conf:.2f}" if isinstance(conf, float) else "—"
        target = e.get("target_filename", "—")
        n_cand = len(e.get("candidates", []))
        line = f"  {e['source']:<28} angle={angle:<18} conf={conf_s:<5} -> {target}"
        if n_cand:
            line += f"  [{n_cand} cand]"
        if e["errors"]:
            line += f"  ⚠ {'; '.join(e['errors'])}"
        print(line)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Showroom IA — orchestrateur CLI (Phase 1).")
    p.add_argument("input", help="Dossier des photos du véhicule.")
    p.add_argument("--marque", required=True)
    p.add_argument("--modele", required=True)
    p.add_argument("--infos", default="")
    p.add_argument("--showroom", help="Asset showroom actif (image).")
    p.add_argument("--logo", help="Asset logo actif (image).")
    p.add_argument("--plate", help="Asset plaque actif (image).")
    p.add_argument("--output", default="outputs", help="Dossier de sortie (défaut: outputs).")
    p.add_argument("--config-dir", default=DEFAULT_CONFIG_DIR, type=Path)
    p.add_argument("--classify-only", action="store_true", help="Classer seulement (pas de génération).")
    return p


def _load_env() -> None:
    """Charge le .env si python-dotenv est dispo (best-effort, silencieux sinon)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv()


def main(argv: list[str] | None = None) -> int:
    _load_env()
    args = build_parser().parse_args(argv)
    manifest = process_folder(args)
    print_summary(manifest)
    return 0


if __name__ == "__main__":
    sys.exit(main())
