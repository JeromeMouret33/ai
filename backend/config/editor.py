"""Édition de la configuration depuis l'app (round-trip YAML, commentaires préservés).

Les écrans de config (Phase 3) modifient `params.yaml` et `prompt_fragments.yaml`.
On utilise ruamel.yaml pour ne PAS détruire les commentaires explicatifs des fichiers.

- params.yaml : clés racine `parametres`, `nomenclature`, `options`, `references_actives`.
- prompt_fragments.yaml : fragments à plat + `angle_presets` + instructions vision.
"""

from __future__ import annotations

import os
from typing import Any

from ruamel.yaml import YAML

from .loader import CONFIG_DIR, FRAGMENTS_FILE, PARAMS_FILE

_yaml = YAML()
_yaml.preserve_quotes = True
_yaml.width = 4096  # évite les retours à la ligne intempestifs


def _path(name: str, config_dir: str) -> str:
    return os.path.join(config_dir, name)


def _load(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return _yaml.load(f)


def _dump(data: Any, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        _yaml.dump(data, f)


def deep_merge(target: Any, patch: dict[str, Any]) -> Any:
    """Fusion récursive : met à jour `target` (mapping ruamel) avec `patch`."""
    for key, value in patch.items():
        if key in target and isinstance(target[key], dict) and isinstance(value, dict):
            deep_merge(target[key], value)
        else:
            target[key] = value
    return target


def update_params(patch: dict[str, Any], config_dir: str = CONFIG_DIR) -> None:
    """Applique un patch à params.yaml (parametres / nomenclature / options / references_actives)."""
    path = _path(PARAMS_FILE, config_dir)
    data = _load(path)
    deep_merge(data, patch)
    _dump(data, path)


def update_fragments(patch: dict[str, Any], config_dir: str = CONFIG_DIR) -> None:
    """Applique un patch à prompt_fragments.yaml (fragments / presets / instructions)."""
    path = _path(FRAGMENTS_FILE, config_dir)
    data = _load(path)
    deep_merge(data, patch)
    _dump(data, path)
