"""Chargement de la configuration (fragments + paramètres).

Lit les deux YAML éditables et renvoie une vue unifiée consommée par le
pipeline. Aucune logique métier ici : juste de la lecture + un découpage clair.
"""

from __future__ import annotations

import os
from typing import Any

import yaml

CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))
FRAGMENTS_FILE = "prompt_fragments.yaml"
PARAMS_FILE = "params.yaml"


def load_config(config_dir: str = CONFIG_DIR) -> dict[str, Any]:
    """Charge la config et renvoie un dict à plat.

    Clés renvoyées :
        fragments    : contenu de prompt_fragments.yaml (role, vehicle_lock, …, angle_presets).
        params       : params.yaml -> parametres (models, ratio, resolution, candidates…).
        nomenclature : params.yaml -> nomenclature (dossier, fichier, angles…).
        options      : params.yaml -> options (relight_enabled, plate_enabled…).
        references   : params.yaml -> references_actives (ids des assets actifs).
    """
    fragments = _read_yaml(os.path.join(config_dir, FRAGMENTS_FILE))
    raw = _read_yaml(os.path.join(config_dir, PARAMS_FILE))

    return {
        "fragments": fragments,
        "params": raw.get("parametres", {}),
        "nomenclature": raw.get("nomenclature", {}),
        "options": raw.get("options", {}),
        "references": raw.get("references_actives", {}),
    }


def known_angles(config: dict[str, Any]) -> list[str]:
    """Liste des slugs d'angle valides (clés de angle_presets)."""
    return list(config["fragments"].get("angle_presets", {}).keys())


def _read_yaml(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
