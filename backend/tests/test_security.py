import pytest
from fastapi import HTTPException

from backend import auth
from backend.main import _sniff_image
from backend.pipeline import naming


# --- Magic bytes : seules de vraies images raster passent ---
def test_sniff_image_accepts_real_formats():
    assert _sniff_image(b"\xff\xd8\xff\xe0rest") == "image/jpeg"
    assert _sniff_image(b"\x89PNG\r\n\x1a\nrest") == "image/png"
    assert _sniff_image(b"RIFF\x00\x00\x00\x00WEBPrest") == "image/webp"
    assert _sniff_image(b"\x00\x00\x00\x18ftypheicrest") == "image/heic"


def test_sniff_image_rejects_svg_and_junk():
    # SVG = XML scriptable -> refusé même avec un Content-Type image/svg+xml.
    with pytest.raises(HTTPException):
        _sniff_image(b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")
    with pytest.raises(HTTPException):
        _sniff_image(b"GIF89a maybe")  # GIF non accepté (pas un format photo)
    with pytest.raises(HTTPException):
        _sniff_image(b"")


# --- JWT : algorithmes hors allow-list refusés ---
def test_verify_token_rejects_unknown_alg(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co")
    import jwt as pyjwt
    token = pyjwt.encode({"aud": "authenticated"}, "k", algorithm="HS384")
    with pytest.raises(auth.AuthError) as exc:
        auth.verify_token(token)
    assert "refusé" in exc.value.detail


# --- Path traversal : assainissement des noms de fichiers ---
def test_safe_filename_strips_path_traversal():
    assert naming.safe_filename("../../etc/passwd") == "passwd"
    assert naming.safe_filename("/abs/path/photo.jpg") == "photo.jpg"
    assert naming.safe_filename("a b;rm -rf.jpg") == "a_b_rm_-rf.jpg"
    assert naming.safe_filename("") == "file"
    assert naming.safe_filename("...") == "file"
    # Invariant de sécurité : aucun séparateur de chemin ni ".." en tête ne survit.
    for danger in ["../../etc/passwd", "/a/b.jpg", "..\\..\\win.ini", "a/../../b"]:
        out = naming.safe_filename(danger)
        assert "/" not in out and "\\" not in out
        assert not out.startswith(".")


def test_safe_filename_keeps_clean_names():
    assert naming.safe_filename("peugeot-208_face-avant.jpg") == "peugeot-208_face-avant.jpg"


# --- Auth fail-closed en production (ni SUPABASE_URL ni secret) ---
def test_auth_fails_closed_in_production(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    req = type("R", (), {"headers": {}})()
    with pytest.raises(auth.AuthError) as exc:
        auth.get_current_user(req)  # type: ignore[arg-type]
    assert exc.value.status_code == 503


def test_auth_dev_bypass_outside_production(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    req = type("R", (), {"headers": {}})()
    assert auth.get_current_user(req)["auth_disabled"] is True  # type: ignore[arg-type]


def test_auth_missing_bearer_when_configured(monkeypatch):
    # Configuré (SUPABASE_URL présent) mais pas de header -> 401.
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    req = type("R", (), {"headers": {}})()
    with pytest.raises(auth.AuthError) as exc:
        auth.get_current_user(req)  # type: ignore[arg-type]
    assert exc.value.status_code == 401
