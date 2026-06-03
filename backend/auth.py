"""Authentification — vérification du JWT Supabase (Google OAuth, invite-only).

Supabase émet des access tokens JWT signés en HS256 avec le secret du projet
(`SUPABASE_JWT_SECRET`). On vérifie la signature en pur stdlib (hmac/hashlib) :
pas de dépendance crypto externe, suffisant pour HS256.

Modèle d'accès invite-only : géré côté Supabase (signups désactivés, provider
Google). Défense en profondeur optionnelle ici via `AUTH_ALLOWED_EMAILS`
(liste blanche d'emails, séparés par des virgules).

Dev : si `SUPABASE_JWT_SECRET` n'est pas défini, l'auth est DÉSACTIVÉE (un
utilisateur "dev" est renvoyé). En production, définir le secret active la garde.

> Si le projet Supabase utilise des clés de signature asymétriques (ES256/RS256
> via JWKS), remplacer la vérification HS256 par PyJWT + JWKS.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from fastapi import HTTPException, Request

SUPABASE_AUD = "authenticated"


class AuthError(HTTPException):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(status_code=status, detail=detail)


def _b64url_decode(segment: str) -> bytes:
    pad = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + pad)


def verify_token(token: str, secret: str) -> dict[str, Any]:
    """Vérifie un JWT HS256 et renvoie le payload. Lève AuthError sinon."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError:
        raise AuthError(401, "Token mal formé.")

    header = json.loads(_b64url_decode(header_b64))
    if header.get("alg") != "HS256":
        raise AuthError(401, f"Algorithme non supporté: {header.get('alg')}")

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _b64url_decode(sig_b64)):
        raise AuthError(401, "Signature invalide.")

    payload = json.loads(_b64url_decode(payload_b64))

    exp = payload.get("exp")
    if exp is not None and time.time() > float(exp):
        raise AuthError(401, "Token expiré.")

    aud = payload.get("aud")
    auds = aud if isinstance(aud, list) else [aud]
    if SUPABASE_AUD not in auds:
        raise AuthError(401, "Audience invalide.")

    return payload


def _allowed(email: str | None) -> bool:
    allowlist = os.environ.get("AUTH_ALLOWED_EMAILS")
    if not allowlist:
        return True  # pas de liste blanche -> on s'appuie sur l'invite-only Supabase
    allowed = {e.strip().lower() for e in allowlist.split(",") if e.strip()}
    return bool(email) and email.lower() in allowed


def get_current_user(request: Request) -> dict[str, Any]:
    """Dependency FastAPI : renvoie l'utilisateur courant ou lève 401/403."""
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        # Auth désactivée (dev/test). À NE PAS laisser en production.
        return {"sub": "dev", "email": "dev@local", "auth_disabled": True}

    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise AuthError(401, "Token d'authentification manquant.")
    payload = verify_token(header[len("Bearer "):].strip(), secret)

    email = payload.get("email")
    if not _allowed(email):
        raise AuthError(403, "Accès non autorisé pour cet utilisateur.")
    return {"sub": payload.get("sub"), "email": email}
