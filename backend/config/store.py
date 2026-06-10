"""Persistance de la config éditable en base (Supabase) — survit aux déploiements.

Les fichiers YAML (`prompt_fragments.yaml` / `params.yaml`) restent les DÉFAUTS
(seed du repo). La table `app_config` (1 ligne, colonne `data` jsonb) stocke les
SURCHARGES faites depuis l'app, fusionnées par-dessus au chargement.

Forme de `data` (miroir des fichiers) :
    {"params": <params.yaml-shaped>, "fragments": <prompt_fragments-shaped>}

Chargement = best-effort : si Supabase n'est pas configuré ou injoignable, on
renvoie {} (l'app tourne sur les défauts YAML, jamais bloquée).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from backend.env import env_str

CONFIG_ROW_ID = "main"


def enabled() -> bool:
    """La persistance en base est-elle disponible (Supabase configuré) ?"""
    return bool(env_str("SUPABASE_URL") and env_str("SUPABASE_KEY"))


def deep_merge(target: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Fusion récursive : `patch` écrase/complète `target` (mutations en place)."""
    for key, value in patch.items():
        if key in target and isinstance(target[key], dict) and isinstance(value, dict):
            deep_merge(target[key], value)
        else:
            target[key] = value
    return target


def load_overrides() -> dict[str, Any]:
    """Surcharges persistées. {} si non configuré ou erreur (jamais bloquant)."""
    if not enabled():
        return {}
    try:
        from backend.storage import supabase as sb
        rows = sb.select("app_config", {"id": CONFIG_ROW_ID})
        return (rows[0].get("data") or {}) if rows else {}
    except Exception:  # noqa: BLE001 - le chargement de config ne doit jamais échouer
        return {}


def save_override(section: str, patch: dict[str, Any]) -> None:
    """Fusionne `patch` dans data[section] et upsert. section ∈ {'params','fragments'}."""
    from backend.storage import supabase as sb
    rows = sb.select("app_config", {"id": CONFIG_ROW_ID})
    data: dict[str, Any] = (rows[0].get("data") if rows else {}) or {}
    data[section] = deep_merge(data.get(section, {}) or {}, patch)
    now = datetime.now(timezone.utc).isoformat()
    if rows:
        sb.update("app_config", {"id": CONFIG_ROW_ID}, {"data": data, "updated_at": now})
    else:
        sb.insert("app_config", {"id": CONFIG_ROW_ID, "data": data})
