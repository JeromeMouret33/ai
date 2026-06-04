"""Authentification — vérification du JWT Supabase (login Google/Apple, invite-only).

Supporte les deux régimes de signature Supabase :
- **ES256/RS256** (nouvelles « JWT Signing Keys ») → vérification via **JWKS**
  (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`).
- **HS256** (ancien « legacy JWT secret ») → vérification avec `SUPABASE_JWT_SECRET`.
Le bon chemin est choisi selon l'algorithme déclaré dans le token.

Invite-only : géré côté Supabase (+ liste blanche optionnelle `AUTH_ALLOWED_EMAILS`).
Dev : si ni `SUPABASE_URL` ni `SUPABASE_JWT_SECRET` ne sont définis, l'auth est
DÉSACTIVÉE (utilisateur "dev"). En production, l'absence de config → 503.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

from backend.env import env_str

SUPABASE_AUD = "authenticated"


class AuthError(HTTPException):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(status_code=status, detail=detail)


@lru_cache(maxsize=4)
def _jwk_client(jwks_url: str) -> PyJWKClient:
    """Client JWKS mis en cache (les clés publiques sont elles-mêmes cachées)."""
    return PyJWKClient(jwks_url)


def _jwks_url() -> str:
    base = env_str("SUPABASE_URL").rstrip("/")
    return f"{base}/auth/v1/.well-known/jwks.json" if base else ""


def verify_token(token: str) -> dict[str, Any]:
    """Vérifie un JWT Supabase (HS256 legacy ou ES256/RS256 via JWKS)."""
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
    except jwt.PyJWTError as exc:
        raise AuthError(401, "Token mal formé.") from exc

    try:
        if alg == "HS256":
            secret = env_str("SUPABASE_JWT_SECRET")
            if not secret:
                raise AuthError(401, "Token HS256 mais SUPABASE_JWT_SECRET absent.")
            payload = jwt.decode(token, secret, algorithms=["HS256"], audience=SUPABASE_AUD)
        else:
            url = _jwks_url()
            if not url:
                raise AuthError(401, "Token asymétrique mais SUPABASE_URL absent (JWKS).")
            key = _jwk_client(url).get_signing_key_from_jwt(token).key
            payload = jwt.decode(token, key, algorithms=[alg], audience=SUPABASE_AUD)
    except jwt.ExpiredSignatureError as exc:
        raise AuthError(401, "Token expiré.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError(401, f"Token invalide : {exc}") from exc
    return payload


def _allowed(email: str | None) -> bool:
    allowlist = env_str("AUTH_ALLOWED_EMAILS")
    if not allowlist:
        return True  # pas de liste blanche -> on s'appuie sur l'invite-only Supabase
    allowed = {e.strip().lower() for e in allowlist.split(",") if e.strip()}
    return bool(email) and email.lower() in allowed


def get_current_user(request: Request) -> dict[str, Any]:
    """Dependency FastAPI : renvoie l'utilisateur courant ou lève 401/403/503."""
    configured = bool(env_str("SUPABASE_URL") or env_str("SUPABASE_JWT_SECRET"))
    if not configured:
        # Échec SÛR : en production, on refuse plutôt que d'ouvrir l'app.
        if env_str("ENVIRONMENT").lower() == "production":
            raise AuthError(503, "Authentification non configurée (SUPABASE_URL manquant).")
        return {"sub": "dev", "email": "dev@local", "auth_disabled": True}

    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise AuthError(401, "Token d'authentification manquant.")
    payload = verify_token(header[len("Bearer "):].strip())

    email = payload.get("email")
    if not _allowed(email):
        raise AuthError(403, "Accès non autorisé pour cet utilisateur.")
    return {"sub": payload.get("sub"), "email": email}
