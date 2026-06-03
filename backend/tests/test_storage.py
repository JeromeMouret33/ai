import pytest

from backend.storage import delivery, drive
from backend.storage import supabase as sb


# --- Supabase : construction d'URL / headers (sans réseau) ---
def test_supabase_urls_and_headers(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co/")
    monkeypatch.setenv("SUPABASE_KEY", "service-key")
    assert sb._rest_url("jobs") == "https://proj.supabase.co/rest/v1/jobs"
    assert sb._object_url("outputs", "/a/b.png") == \
        "https://proj.supabase.co/storage/v1/object/outputs/a/b.png"
    assert sb.public_url("outputs", "a/b.png") == \
        "https://proj.supabase.co/storage/v1/object/public/outputs/a/b.png"
    h = sb._rest_headers(prefer="return=representation")
    assert h["apikey"] == "service-key"
    assert h["Authorization"] == "Bearer service-key"
    assert h["Prefer"] == "return=representation"


def test_supabase_missing_env_raises(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    with pytest.raises(sb.SupabaseError):
        sb._rest_url("jobs")


# --- Drive : helpers purs ---
def test_drive_metadata_and_mime():
    assert drive.folder_metadata("Peugeot 208", "PARENT") == {
        "name": "Peugeot 208", "mimeType": drive.FOLDER_MIME, "parents": ["PARENT"],
    }
    assert drive.file_metadata("x.jpg", "FOLDER") == {"name": "x.jpg", "parents": ["FOLDER"]}
    assert drive.guess_mime("photo.jpg") == "image/jpeg"
    assert drive.guess_mime("photo.png") == "image/png"


def test_drive_parent_folder_from_config_then_env(monkeypatch):
    cfg = {"params": {"drive_parent_folder": "FROM_CFG"}}
    assert drive.parent_folder_id(cfg) == "FROM_CFG"
    monkeypatch.setenv("GOOGLE_DRIVE_PARENT_FOLDER_ID", "FROM_ENV")
    assert drive.parent_folder_id({"params": {"drive_parent_folder": ""}}) == "FROM_ENV"
    monkeypatch.delenv("GOOGLE_DRIVE_PARENT_FOLDER_ID", raising=False)
    with pytest.raises(drive.DriveError):
        drive.parent_folder_id({})


# --- Delivery : plan d'upload (pur) ---
def _manifest():
    return {
        "drive_folder": "Peugeot 208 GT-Line",
        "photos": [
            {"source": "a.jpg", "target_filename": "peugeot-208_face-avant.jpg",
             "candidates": [{"path": "/out/a_cand01.png"}]},
            {"source": "b.jpg", "target_filename": "peugeot-208_arriere.jpg",
             "candidates": [{"path": "/out/b_cand01.png"}]},
            {"source": "c.jpg", "errors": ["angle non reconnu"]},  # pas de candidat
        ],
    }


def test_build_plan_selects_kept_with_candidates():
    plan = delivery.build_plan(_manifest(), {"a.jpg", "c.jpg"})
    # c.jpg n'a pas de candidat -> exclu ; b.jpg non sélectionné -> exclu.
    assert plan == [
        {"source": "a.jpg", "target_filename": "peugeot-208_face-avant.jpg",
         "candidate_path": "/out/a_cand01.png"},
    ]


def test_deliver_dry_run_no_network(monkeypatch):
    monkeypatch.setenv("GOOGLE_DRIVE_PARENT_FOLDER_ID", "PARENT")
    result = delivery.deliver(_manifest(), {"a.jpg", "b.jpg"}, {}, dry_run=True)
    assert result["folder_name"] == "Peugeot 208 GT-Line"
    assert result["parent_id"] == "PARENT"
    assert len(result["uploads"]) == 2
