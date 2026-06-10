"""Tests de la persistance de config en base (logique pure / overlay loader)."""

from backend.config import loader, store


def test_deep_merge_overrides_and_completes():
    target = {"a": {"x": 1, "y": 2}, "b": 3}
    store.deep_merge(target, {"a": {"y": 9, "z": 5}, "c": 7})
    assert target == {"a": {"x": 1, "y": 9, "z": 5}, "b": 3, "c": 7}


def test_load_overrides_empty_when_disabled(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    assert store.enabled() is False
    assert store.load_overrides() == {}


def test_load_config_applies_db_overrides(monkeypatch):
    """Une surcharge base doit écraser le défaut YAML (params ET fragments)."""
    monkeypatch.setattr(store, "load_overrides", lambda: {
        "params": {"parametres": {"models": {"generation": "custom/model-x"},
                                  "ratio": "16:9"}},
        "fragments": {"role": "Overridden role."},
    })
    cfg = loader.load_config()
    assert cfg["params"]["models"]["generation"] == "custom/model-x"
    assert cfg["params"]["ratio"] == "16:9"
    assert cfg["fragments"]["role"].strip() == "Overridden role."
    # Les valeurs non surchargées gardent leur défaut YAML.
    assert cfg["params"]["models"]["classification"] == "openai/gpt-4o-mini"
    assert "vehicle_lock" in cfg["fragments"]


def test_load_config_no_overrides_is_pure_yaml(monkeypatch):
    monkeypatch.setattr(store, "load_overrides", lambda: {})
    cfg = loader.load_config()
    assert cfg["params"]["models"]["generation"] == "google/gemini-3.1-flash-image-preview"
