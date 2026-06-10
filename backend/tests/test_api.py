from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_get_config_exposes_fragments_and_params():
    r = client.get("/api/config")
    assert r.status_code == 200
    cfg = r.json()
    assert cfg["params"]["models"]["generation"] == "google/gemini-3.1-flash-image-preview"
    assert "role" in cfg["fragments"]
    assert "face-avant" in cfg["fragments"]["angle_presets"]


def test_openapi_lists_core_routes():
    paths = client.get("/openapi.json").json()["paths"]
    for route in ["/api/config", "/api/jobs", "/api/reference-assets",
                  "/api/jobs/{job_id}/deliver", "/api/jobs/{job_id}/download",
                  "/api/jobs/{job_id}/archive", "/api/jobs/{job_id}/cancel"]:
        assert route in paths
    # Endpoints Drive « historique » supprimés (l'historique vit dans l'app).
    assert "/api/history" not in paths
