"""Classification d'angle (modèle vision configurable via OpenRouter).

Détecte l'angle de prise de vue + un score de confiance. Le slug renvoyé sert
ensuite au renommage (naming) et au choix du preset (prompt_builder).
"""

from __future__ import annotations

from typing import Any

from . import openrouter


def classify_usage(image_path: str, config: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Comme `classify`, mais renvoie aussi l'usage/coût (Phase 4)."""
    model = config["params"]["models"].get("classification")
    if not model:
        raise ValueError("Aucun modèle de classification configuré (params.models.classification).")

    valid = list(config["fragments"].get("angle_presets", {}).keys())
    instruction = config["fragments"]["classify_instruction"].replace("{ANGLES}", ", ".join(valid))

    data, usage = openrouter.vision_json_usage(model, [image_path], instruction)

    angle = data.get("angle")
    if angle not in valid:
        angle = None
    confidence = _as_float(data.get("confidence"))
    return {"angle": angle, "confidence": confidence, "raw": data}, usage


def classify(image_path: str, config: dict[str, Any]) -> dict[str, Any]:
    """Détecte l'angle d'une photo.

    Returns:
        dict : {
            "angle": slug | None,   # None si le modèle renvoie un slug inconnu
            "confidence": float | None,
            "raw": <réponse brute parsée>,
        }
    """
    return classify_usage(image_path, config)[0]


def _as_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
