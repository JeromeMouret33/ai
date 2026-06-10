from backend.config.loader import load_config
from backend.pipeline import prompt_builder


def _cfg():
    return load_config()


def test_exterior_assembly_roles_and_substitution():
    cfg = _cfg()
    options = {"relight_enabled": True, "plate_enabled": True}
    built = prompt_builder.build("3-4-avant-gauche", options, cfg)

    assert built.is_interior is False
    assert built.reference_roles == ["showroom", "logo", "vehicle", "plate"]
    # Toutes les variables doivent être substituées.
    for var in ["{ANGLE}", "{FRAMING_PRESET}", "{LOGO_POSITION_SIZE}", "{RATIO}", "{RESOLUTION}"]:
        assert var not in built.text
    # Contenu attendu injecté.
    assert "front 3/4 left" in built.text
    assert "3:2" in built.text
    assert "1K" in built.text
    # Fragments présents (v2).
    assert "professional automotive studio photograph" in built.text
    assert "SHOWROOM image" in built.text
    assert "eye-level" in built.text
    assert "HARD RULES" in built.text


def test_plate_toggle_off_excludes_plate():
    cfg = _cfg()
    built = prompt_builder.build("face-avant", {"relight_enabled": True, "plate_enabled": False}, cfg)
    assert "plate" not in built.reference_roles
    assert "Replace the visible license plate" not in built.text


def test_relight_toggle_off_excludes_relight():
    cfg = _cfg()
    built = prompt_builder.build("face-avant", {"relight_enabled": False, "plate_enabled": False}, cfg)
    assert "Give the car the studio look" not in built.text


def test_interior_assembly_minimal():
    cfg = _cfg()
    built = prompt_builder.build("interieur", {"relight_enabled": True, "plate_enabled": True}, cfg)
    assert built.is_interior is True
    assert built.reference_roles == ["vehicle"]
    assert "INTERIOR:" in built.text
    assert "SHOWROOM image" not in built.text   # pas de showroom en intérieur
    assert "LOGO image" not in built.text        # pas de logo en intérieur


def test_unknown_angle_raises():
    cfg = _cfg()
    try:
        prompt_builder.build("does-not-exist", {}, cfg)
        assert False, "doit lever KeyError"
    except KeyError:
        pass
