"""Tests du traitement de job (parties pures / mocks Supabase)."""

from backend import jobs


def test_refresh_job_names_keeps_suffixes_stable(monkeypatch):
    """Après une régénération, les suffixes -01/-02 doivent rester cohérents
    sur TOUT le job (bug : nommer une photo isolément perdait le dédoublonnage)."""
    photos = [
        {"id": "a", "angle": "profil-gauche", "target_filename": None, "created_at": "1"},
        {"id": "b", "angle": "profil-gauche", "target_filename": None, "created_at": "2"},
        {"id": "c", "angle": "face-avant", "target_filename": None, "created_at": "3"},
        {"id": "d", "angle": None, "target_filename": None, "created_at": "4"},  # non classée
    ]
    updates: dict[str, dict] = {}
    monkeypatch.setattr(jobs.sb, "select", lambda table, match=None, **kw: photos)
    monkeypatch.setattr(jobs.sb, "update",
                        lambda table, match, patch: updates.setdefault(match["id"], patch))

    job = {"id": "j1", "marque": "Peugeot", "modele": "208"}
    jobs._refresh_job_names(job, {})

    assert updates["a"]["target_filename"] == "peugeot-208_profil-gauche-01.jpg"
    assert updates["b"]["target_filename"] == "peugeot-208_profil-gauche-02.jpg"
    assert updates["c"]["target_filename"] == "peugeot-208_face-avant.jpg"
    assert "d" not in updates  # photo non classée -> pas de nom


def test_refresh_job_names_skips_unchanged(monkeypatch):
    photos = [
        {"id": "a", "angle": "arriere", "target_filename": "peugeot-208_arriere.jpg",
         "created_at": "1"},
    ]
    updates: dict[str, dict] = {}
    monkeypatch.setattr(jobs.sb, "select", lambda table, match=None, **kw: photos)
    monkeypatch.setattr(jobs.sb, "update",
                        lambda table, match, patch: updates.setdefault(match["id"], patch))

    jobs._refresh_job_names({"id": "j1", "marque": "Peugeot", "modele": "208"}, {})
    assert updates == {}  # nom déjà correct -> aucun write inutile


def test_format_error_maps_known_cases():
    assert "Clé OpenRouter" in jobs._format_error(Exception("OPENROUTER_API_KEY manquante"))
    assert "aucune image" in jobs._format_error(Exception("Aucune image dans la réponse")).lower()
    assert "Limite" in jobs._format_error(Exception("OpenRouter 429: rate limit"))
    assert "refusé" in jobs._format_error(Exception("OpenRouter 401: invalid key"))


def test_format_error_truncates_and_falls_back():
    assert jobs._format_error(Exception("")) == "Erreur inconnue pendant la génération."
    long = "x" * 500
    assert len(jobs._format_error(Exception(long))) == 300
