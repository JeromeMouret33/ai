import pytest

from backend import auth
from backend.pipeline import naming


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


# --- Auth fail-closed en production ---
def test_auth_fails_closed_in_production(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    req = type("R", (), {"headers": {}})()
    with pytest.raises(auth.AuthError) as exc:
        auth.get_current_user(req)  # type: ignore[arg-type]
    assert exc.value.status_code == 503


def test_auth_dev_bypass_outside_production(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    req = type("R", (), {"headers": {}})()
    assert auth.get_current_user(req)["auth_disabled"] is True  # type: ignore[arg-type]
