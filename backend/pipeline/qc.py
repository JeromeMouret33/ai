"""Contrôle qualité (modèle vision configurable via OpenRouter).

Vérifie décor conforme, logo net, voiture fidèle, avec vérification zoomée des
zones sensibles (DRL, jantes, calandre, badges, optiques). Renvoie un verdict +
des raisons. NE relance PAS : la décision de relance est prise côté UI.
"""

from __future__ import annotations

from typing import Any

from . import openrouter


def qc(image_path: str, config: dict[str, Any]) -> dict[str, Any]:
    """Évalue la qualité d'une image générée.

    Returns:
        dict : {
            "verdict": "ok" | "ko",
            "reasons": [str, ...],
            "raw": <réponse brute parsée>,
        }
    """
    model = config["params"]["models"].get("qc")
    if not model:
        raise ValueError("Aucun modèle de QC configuré (params.models.qc).")

    instruction = config["fragments"]["qc_instruction"]
    data = openrouter.vision_json(model, [image_path], instruction)

    verdict = "ok" if str(data.get("verdict", "")).lower() == "ok" else "ko"
    reasons = data.get("reasons") or []
    if isinstance(reasons, str):
        reasons = [reasons]
    return {"verdict": verdict, "reasons": list(reasons), "raw": data}
