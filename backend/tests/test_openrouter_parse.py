import base64

import pytest

from backend.pipeline import openrouter


def test_extract_json_plain():
    assert openrouter._extract_json('{"angle": "face-avant", "confidence": 0.9}') == {
        "angle": "face-avant",
        "confidence": 0.9,
    }


def test_extract_json_fenced_with_prose():
    text = 'Voici le résultat :\n```json\n{"verdict": "ko", "reasons": ["logo flou"]}\n```\nVoilà.'
    assert openrouter._extract_json(text) == {"verdict": "ko", "reasons": ["logo flou"]}


def test_extract_json_invalid_raises():
    with pytest.raises(openrouter.OpenRouterError):
        openrouter._extract_json("pas de json ici")


def test_first_text():
    data = {"choices": [{"message": {"content": "hello"}}]}
    assert openrouter._first_text(data) == "hello"


def test_images_from_response_data_uri():
    raw = b"\x89PNG\r\n\x1a\n fake png bytes"
    uri = "data:image/png;base64," + base64.b64encode(raw).decode()
    data = {"choices": [{"message": {"images": [{"image_url": {"url": uri}}]}}]}
    assert openrouter._images_from_response(data) == [raw]


def test_images_from_response_empty_raises():
    data = {"choices": [{"message": {"images": []}}]}
    with pytest.raises(openrouter.OpenRouterError):
        openrouter._images_from_response(data)
