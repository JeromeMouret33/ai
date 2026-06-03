import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi import Request

from backend import auth

SECRET = "test-secret"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def make_token(secret: str = SECRET, **claims) -> str:
    payload = {"sub": "u1", "email": "user@goodcar.fr", "aud": "authenticated",
               "exp": time.time() + 3600, **claims}
    header_b64 = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload_b64 = _b64(json.dumps(payload).encode())
    signing_input = f"{header_b64}.{payload_b64}".encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64(sig)}"


def _request(token: str | None) -> Request:
    headers = [(b"authorization", f"Bearer {token}".encode())] if token else []
    return Request({"type": "http", "headers": headers})


def test_verify_token_ok():
    payload = auth.verify_token(make_token(), SECRET)
    assert payload["email"] == "user@goodcar.fr"


def test_verify_token_bad_signature():
    with pytest.raises(auth.AuthError):
        auth.verify_token(make_token(secret="autre"), SECRET)


def test_verify_token_expired():
    with pytest.raises(auth.AuthError):
        auth.verify_token(make_token(exp=time.time() - 10), SECRET)


def test_verify_token_wrong_audience():
    with pytest.raises(auth.AuthError):
        auth.verify_token(make_token(aud="anon"), SECRET)


def test_dependency_disabled_without_secret(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    user = auth.get_current_user(_request(None))
    assert user["auth_disabled"] is True


def test_dependency_requires_token_when_enabled(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    with pytest.raises(auth.AuthError):
        auth.get_current_user(_request(None))
    user = auth.get_current_user(_request(make_token()))
    assert user["email"] == "user@goodcar.fr"


def test_dependency_allowlist(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("AUTH_ALLOWED_EMAILS", "boss@goodcar.fr, user@goodcar.fr")
    assert auth.get_current_user(_request(make_token()))["email"] == "user@goodcar.fr"
    monkeypatch.setenv("AUTH_ALLOWED_EMAILS", "only@goodcar.fr")
    with pytest.raises(auth.AuthError):
        auth.get_current_user(_request(make_token()))
