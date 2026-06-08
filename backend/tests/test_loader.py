from backend.config.loader import known_angles, load_config


def test_load_config_structure():
    cfg = load_config()
    assert set(cfg) >= {"fragments", "params", "nomenclature", "options", "references"}
    assert cfg["params"]["models"]["generation"] == "google/gemini-3.1-flash-image-preview"
    assert cfg["params"]["candidates_per_photo"] == 1
    assert cfg["options"]["relight_enabled"] is True


def test_known_angles_present():
    angles = known_angles(load_config())
    assert "face-avant" in angles
    assert "interieur" in angles
    assert len(angles) == 10


def test_fragments_have_required_keys():
    frg = load_config()["fragments"]
    for key in ["role", "vehicle_lock", "ref_showroom", "ref_logo", "ref_vehicle",
                "ref_plate", "task_base", "relight", "plate", "composition",
                "constraints", "interior", "classify_instruction", "qc_instruction"]:
        assert key in frg, f"fragment manquant: {key}"
