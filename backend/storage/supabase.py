"""Accès Supabase via l'API REST (PostgREST + Storage), avec httpx.

Choix : client REST léger (pas de dépendance `supabase-py`), cohérent avec le
client OpenRouter et facile à tester côté construction de requêtes.

Auth : `SUPABASE_URL` + `SUPABASE_KEY` (clé service role côté backend).
httpx est importé paresseusement pour garder les helpers testables hors réseau.

Buckets : references (public), uploads (privé), outputs (public).
Tables   : jobs, photos, reference_assets (voir supabase/migrations/0001_init.sql).
"""

from __future__ import annotations

import os
from typing import Any

BUCKET_REFERENCES = "references"
BUCKET_UPLOADS = "uploads"
BUCKET_OUTPUTS = "outputs"

DEFAULT_TIMEOUT = 60.0


class SupabaseError(RuntimeError):
    """Erreur d'appel Supabase."""


# --------------------------------------------------------------------------- #
# Construction des requêtes (testable sans réseau)
# --------------------------------------------------------------------------- #
def _base_url() -> str:
    url = os.environ.get("SUPABASE_URL")
    if not url:
        raise SupabaseError("SUPABASE_URL manquante.")
    return url.rstrip("/")


def _key() -> str:
    key = os.environ.get("SUPABASE_KEY")
    if not key:
        raise SupabaseError("SUPABASE_KEY manquante.")
    return key


def _rest_headers(prefer: str | None = None) -> dict[str, str]:
    key = _key()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _rest_url(table: str) -> str:
    return f"{_base_url()}/rest/v1/{table}"


def _object_url(bucket: str, path: str) -> str:
    return f"{_base_url()}/storage/v1/object/{bucket}/{path.lstrip('/')}"


def public_url(bucket: str, path: str) -> str:
    """URL publique d'un objet (buckets publics : references, outputs)."""
    return f"{_base_url()}/storage/v1/object/public/{bucket}/{path.lstrip('/')}"


# --------------------------------------------------------------------------- #
# Opérations tables (PostgREST)
# --------------------------------------------------------------------------- #
def insert(table: str, row: dict[str, Any]) -> dict[str, Any]:
    """Insère une ligne et renvoie la ligne créée."""
    data = _request("POST", _rest_url(table), json=[row], prefer="return=representation")
    return data[0] if isinstance(data, list) and data else data


def update(table: str, match: dict[str, Any], patch: dict[str, Any]) -> list[dict[str, Any]]:
    """Met à jour les lignes correspondant à `match` (égalités)."""
    params = {k: f"eq.{v}" for k, v in match.items()}
    return _request("PATCH", _rest_url(table), json=patch, params=params,
                    prefer="return=representation")


def select(table: str, match: dict[str, Any] | None = None,
           columns: str = "*") -> list[dict[str, Any]]:
    """Sélectionne des lignes (filtres d'égalité optionnels)."""
    params = {"select": columns}
    for k, v in (match or {}).items():
        params[k] = f"eq.{v}"
    return _request("GET", _rest_url(table), params=params)


# --------------------------------------------------------------------------- #
# Bibliothèque de références (un actif par type)
# --------------------------------------------------------------------------- #
def list_reference_assets(asset_type: str | None = None) -> list[dict[str, Any]]:
    match = {"type": asset_type} if asset_type else None
    return select("reference_assets", match)


def get_active_asset(asset_type: str) -> dict[str, Any] | None:
    rows = select("reference_assets", {"type": asset_type, "active": "true"})
    return rows[0] if rows else None


def set_active_asset(asset_id: str, asset_type: str) -> dict[str, Any]:
    """Active un asset et désactive les autres du même type."""
    update("reference_assets", {"type": asset_type}, {"active": False})
    rows = update("reference_assets", {"id": asset_id}, {"active": True})
    if not rows:
        raise SupabaseError(f"Asset introuvable: {asset_id}")
    return rows[0]


# --------------------------------------------------------------------------- #
# Storage
# --------------------------------------------------------------------------- #
def upload(bucket: str, path: str, data: bytes, content_type: str = "image/png") -> str:
    """Téléverse un objet et renvoie son chemin (utiliser public_url/signed_url pour l'URL)."""
    import httpx  # import paresseux

    headers = {
        "apikey": _key(),
        "Authorization": f"Bearer {_key()}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    resp = httpx.post(_object_url(bucket, path), headers=headers, content=data,
                      timeout=DEFAULT_TIMEOUT)
    if resp.status_code >= 400:
        raise SupabaseError(f"Upload {bucket}/{path} -> {resp.status_code}: {resp.text[:300]}")
    return path


def download(bucket: str, path: str) -> bytes:
    """Télécharge un objet (fonctionne aussi sur bucket privé via la clé service)."""
    import httpx  # import paresseux

    headers = {"apikey": _key(), "Authorization": f"Bearer {_key()}"}
    resp = httpx.get(_object_url(bucket, path), headers=headers, timeout=DEFAULT_TIMEOUT)
    if resp.status_code >= 400:
        raise SupabaseError(f"Download {bucket}/{path} -> {resp.status_code}: {resp.text[:200]}")
    return resp.content


def create_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """URL signée à durée limitée pour un objet d'un bucket privé (ex. outputs)."""
    import httpx  # import paresseux

    url = f"{_base_url()}/storage/v1/object/sign/{bucket}/{path.lstrip('/')}"
    headers = {"apikey": _key(), "Authorization": f"Bearer {_key()}",
               "Content-Type": "application/json"}
    resp = httpx.post(url, headers=headers, json={"expiresIn": expires_in},
                      timeout=DEFAULT_TIMEOUT)
    if resp.status_code >= 400:
        raise SupabaseError(f"Sign {bucket}/{path} -> {resp.status_code}: {resp.text[:200]}")
    signed = resp.json().get("signedURL") or resp.json().get("signedUrl", "")
    return f"{_base_url()}/storage/v1{signed}" if signed.startswith("/object") else f"{_base_url()}{signed}"


# --------------------------------------------------------------------------- #
# Transport
# --------------------------------------------------------------------------- #
def _request(method: str, url: str, *, json: Any = None,
             params: dict[str, Any] | None = None, prefer: str | None = None) -> Any:
    import httpx  # import paresseux

    resp = httpx.request(method, url, headers=_rest_headers(prefer), json=json,
                         params=params, timeout=DEFAULT_TIMEOUT)
    if resp.status_code >= 400:
        raise SupabaseError(f"{method} {url} -> {resp.status_code}: {resp.text[:300]}")
    if resp.content:
        return resp.json()
    return []
