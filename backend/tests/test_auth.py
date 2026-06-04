import time

import jwt
import pytest
from fastapi import Request

from backend import auth

SECRET = "test-secret"


def make_token(secret: str = SECRET, **claims) -> str:
    payload = {"sub": "u1", "email": "user@goodcar.fr", "aud": "authenticated",
               "exp": time.time() + 3600, **claims}
    return jwt.encode(payload, secret, algorithm="HS256")


def _request(token: str | None) -> Request:
    headers = [(b"authorization", f"Bearer {token}".encode())] if token else []
    return Request({"type": "http", "headers": headers})


# --- verify_token (chemin HS256 / legacy secret) ---
def test_verify_token_ok(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    assert auth.verify_token(make_token())["email"] == "user@goodcar.fr"


def test_verify_token_bad_signature(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    with pytest.raises(auth.AuthError):
        auth.verify_token(make_token(secret="autre"))


def test_verify_token_expired(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    with pytest.raises(auth.AuthError):
        auth.verify_token(make_token(exp=time.time() - 10))


def test_verify_token_wrong_audience(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    with pytest.raises(auth.AuthError):
        auth.verify_token(make_token(aud="anon"))


# --- get_current_user (dependency) ---
def test_dependency_disabled_without_config(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    assert auth.get_current_user(_request(None))["auth_disabled"] is True


def test_dependency_requires_token_when_enabled(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    with pytest.raises(auth.AuthError):
        auth.get_current_user(_request(None))
    assert auth.get_current_user(_request(make_token()))["email"] == "user@goodcar.fr"


def test_dependency_allowlist(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("AUTH_ALLOWED_EMAILS", "boss@goodcar.fr, user@goodcar.fr")
    assert auth.get_current_user(_request(make_token()))["email"] == "user@goodcar.fr"
    monkeypatch.setenv("AUTH_ALLOWED_EMAILS", "only@goodcar.fr")
    with pytest.raises(auth.AuthError):
        auth.get_current_user(_request(make_token()))
