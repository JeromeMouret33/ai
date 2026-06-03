"""Client OpenRouter (API compatible OpenAI).

Une seule clé (`OPENROUTER_API_KEY`) sert les trois rôles ; le modèle est passé
à chaque appel (lu dans la config par les modules classify / generate / qc).

Deux usages :
    - vision_json(model, images, instruction) -> dict   (classification, QC)
    - generate_image(model, prompt, images, n) -> list[bytes]  (génération)

httpx est importé paresseusement (dans _post) pour que le parsing des réponses
reste testable sans dépendance réseau.
"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import re
from typing import Any

API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEOUT = 180.0  # jobs longs (Nano Banana Pro)


class OpenRouterError(RuntimeError):
    """Erreur d'appel ou de réponse OpenRouter."""


# --------------------------------------------------------------------------- #
# Appels haut niveau
# --------------------------------------------------------------------------- #
def vision_json(
    model: str,
    image_paths: list[str],
    instruction: str,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Envoie une ou plusieurs images + une instruction, attend une réponse JSON.

    Utilisé par la classification et le contrôle qualité.
    """
    content: list[dict[str, Any]] = [{"type": "text", "text": instruction}]
    content += [_image_block(p) for p in image_paths]
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "response_format": {"type": "json_object"},
    }
    data = _post(payload, timeout)
    text = _first_text(data)
    return _extract_json(text)


def generate_image(
    model: str,
    prompt: str,
    image_paths: list[str],
    n: int = 1,
    timeout: float = DEFAULT_TIMEOUT,
) -> list[bytes]:
    """Génère `n` candidats à partir d'un prompt + références (images).

    Renvoie la liste des images générées (bytes). OpenRouter ne garantit pas le
    batch côté serveur : on boucle `n` fois et on agrège.
    """
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    content += [_image_block(p) for p in image_paths]
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "modalities": ["image", "text"],
    }
    out: list[bytes] = []
    for _ in range(max(1, n)):
        data = _post(payload, timeout)
        out.extend(_images_from_response(data))
    return out


# --------------------------------------------------------------------------- #
# Encodage / requête
# --------------------------------------------------------------------------- #
def _image_block(path_or_url: str) -> dict[str, Any]:
    """Bloc image. Accepte une URL http(s) (transmise telle quelle) ou un chemin
    local (encodé en data URI)."""
    if path_or_url.startswith(("http://", "https://", "data:")):
        url = path_or_url
    else:
        url = _data_uri(path_or_url)
    return {"type": "image_url", "image_url": {"url": url}}


def _data_uri(path: str) -> str:
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _headers() -> dict[str, str]:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise OpenRouterError("OPENROUTER_API_KEY manquante dans l'environnement.")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    # Attribution facultative (recommandée par OpenRouter). Les valeurs d'en-tête
    # HTTP doivent être ASCII : on assainit (ex. tiret cadratin "—" interdit).
    if os.environ.get("OPENROUTER_REFERER"):
        headers["HTTP-Referer"] = _ascii_header(os.environ["OPENROUTER_REFERER"])
    headers["X-Title"] = _ascii_header(os.environ.get("OPENROUTER_TITLE", "Showroom IA - GOODCAR"))
    return headers


def _ascii_header(value: str) -> str:
    """Rend une valeur d'en-tête sûre (ASCII), pour éviter les erreurs d'encodage."""
    return value.encode("ascii", "ignore").decode("ascii")


def _post(payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    import httpx  # import paresseux

    if not payload.get("model"):
        raise OpenRouterError("Modèle non configuré pour cet appel (vide).")
    try:
        resp = httpx.post(API_URL, headers=_headers(), json=payload, timeout=timeout)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:  # pragma: no cover - dépend du réseau
        raise OpenRouterError(
            f"OpenRouter {exc.response.status_code}: {exc.response.text[:500]}"
        ) from exc
    except httpx.HTTPError as exc:  # pragma: no cover - dépend du réseau
        raise OpenRouterError(f"Échec réseau OpenRouter: {exc}") from exc
    return resp.json()


# --------------------------------------------------------------------------- #
# Parsing des réponses (testable sans réseau)
# --------------------------------------------------------------------------- #
def _first_text(data: dict[str, Any]) -> str:
    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise OpenRouterError(f"Réponse sans contenu texte: {data!r}") from exc


def _extract_json(text: str) -> dict[str, Any]:
    """Parse un objet JSON, tolérant aux blocs ```json``` et au texte autour."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        brace = re.search(r"\{.*\}", candidate, re.DOTALL)
        if brace:
            return json.loads(brace.group(0))
        raise OpenRouterError(f"Réponse non-JSON: {text[:300]}")


def _images_from_response(data: dict[str, Any]) -> list[bytes]:
    """Extrait les images générées (champ `message.images` d'OpenRouter)."""
    try:
        message = data["choices"][0]["message"]
    except (KeyError, IndexError, TypeError) as exc:
        raise OpenRouterError(f"Réponse sans message: {data!r}") from exc

    images = message.get("images") or []
    out: list[bytes] = []
    for item in images:
        url = (item.get("image_url") or {}).get("url") if isinstance(item, dict) else None
        if not url:
            continue
        out.append(_decode_image_url(url))
    if not out:
        raise OpenRouterError("Aucune image dans la réponse de génération.")
    return out


def _decode_image_url(url: str) -> bytes:
    if url.startswith("data:"):
        b64 = url.split(",", 1)[1]
        return base64.b64decode(b64)
    # URL distante : récupération directe.
    import httpx  # import paresseux

    resp = httpx.get(url, timeout=DEFAULT_TIMEOUT)  # pragma: no cover - réseau
    resp.raise_for_status()
    return resp.content
