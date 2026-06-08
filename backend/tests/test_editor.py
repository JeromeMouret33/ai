import shutil

from backend.config import editor, loader


def _copy_config(tmp_path):
    src = loader.CONFIG_DIR
    for name in (loader.PARAMS_FILE, loader.FRAGMENTS_FILE):
        shutil.copy(f"{src}/{name}", tmp_path / name)
    return str(tmp_path)


def test_update_params_applies_and_preserves_comments(tmp_path):
    cdir = _copy_config(tmp_path)
    editor.update_params({"parametres": {"candidates_per_photo": 3}}, config_dir=cdir)

    cfg = loader.load_config(cdir)
    assert cfg["params"]["candidates_per_photo"] == 3
    # Les autres valeurs ne bougent pas.
    assert cfg["params"]["models"]["generation"] == "google/gemini-3.1-flash-image-preview"
    # Un commentaire connu doit toujours être présent (round-trip ruamel).
    text = (tmp_path / loader.PARAMS_FILE).read_text(encoding="utf-8")
    assert "éditables dans l'app" in text


def test_update_fragments_applies(tmp_path):
    cdir = _copy_config(tmp_path)
    editor.update_fragments({"role": "Custom role."}, config_dir=cdir)
    cfg = loader.load_config(cdir)
    assert cfg["fragments"]["role"].strip() == "Custom role."
