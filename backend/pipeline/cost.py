"""Extraction de l'usage / coût des réponses OpenRouter (Phase 4).

OpenRouter renvoie un objet `usage` (tokens) et, si l'option d'accounting est
activée dans la requête, un champ `cost` (USD). Fonctions pures, testables.
"""

from __future__ import annotations

from typing import Any


def extract_usage(data: dict[str, Any]) -> dict[str, Any]:
    """Normalise l'usage d'une réponse OpenRouter en dict simple."""
    usage = data.get("usage") or {}
    return {
        "prompt_tokens": usage.get("prompt_tokens", 0) or 0,
        "completion_tokens": usage.get("completion_tokens", 0) or 0,
        "total_tokens": usage.get("total_tokens", 0) or 0,
        "cost": float(usage.get("cost", 0) or 0),
        "model": data.get("model"),
    }


def merge_usage(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    """Agrège deux usages (somme des tokens et du coût)."""
    return {
        "prompt_tokens": a.get("prompt_tokens", 0) + b.get("prompt_tokens", 0),
        "completion_tokens": a.get("completion_tokens", 0) + b.get("completion_tokens", 0),
        "total_tokens": a.get("total_tokens", 0) + b.get("total_tokens", 0),
        "cost": float(a.get("cost", 0)) + float(b.get("cost", 0)),
        "model": b.get("model") or a.get("model"),
    }
