"""Livraison Google Drive (Phase 2).

Auth : OAuth utilisateur (refresh token), cohérent avec .env.example
       (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).
Le répertoire parent où sont créés les dossiers véhicule vient de la config
(params.drive_parent_folder) ou de GOOGLE_DRIVE_PARENT_FOLDER_ID.

Les dépendances Google (`google-api-python-client`, `google-auth`) sont importées
paresseusement : le module s'importe et ses helpers purs se testent sans elles.
"""

from __future__ import annotations

import mimetypes
import os
from typing import Any

FOLDER_MIME = "application/vnd.google-apps.folder"
TOKEN_URI = "https://oauth2.googleapis.com/token"


class DriveError(RuntimeError):
    """Erreur d'opération Google Drive."""


# --------------------------------------------------------------------------- #
# Helpers purs (testable sans réseau)
# --------------------------------------------------------------------------- #
def folder_metadata(name: str, parent_id: str) -> dict[str, Any]:
    return {"name": name, "mimeType": FOLDER_MIME, "parents": [parent_id]}


def file_metadata(name: str, parent_id: str) -> dict[str, Any]:
    return {"name": name, "parents": [parent_id]}


def guess_mime(filename: str) -> str:
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"


def parent_folder_id(config: dict[str, Any] | None = None) -> str:
    """Répertoire parent : config d'abord, sinon variable d'environnement."""
    if config:
        from_cfg = config.get("params", {}).get("drive_parent_folder")
        if from_cfg:
            return from_cfg
    env = os.environ.get("GOOGLE_DRIVE_PARENT_FOLDER_ID")
    if not env:
        raise DriveError("Répertoire Drive parent non configuré (params.drive_parent_folder).")
    return env


# --------------------------------------------------------------------------- #
# Service authentifié
# --------------------------------------------------------------------------- #
def _service():  # pragma: no cover - nécessite les libs Google + réseau
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise DriveError(
            "Dépendances Google manquantes : pip install google-api-python-client google-auth"
        ) from exc

    creds = Credentials(
        token=None,
        refresh_token=_env("GOOGLE_REFRESH_TOKEN"),
        client_id=_env("GOOGLE_CLIENT_ID"),
        client_secret=_env("GOOGLE_CLIENT_SECRET"),
        token_uri=TOKEN_URI,
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise DriveError(f"{name} manquante.")
    return value


# --------------------------------------------------------------------------- #
# Opérations (réseau)
# --------------------------------------------------------------------------- #
def create_vehicle_folder(name: str, parent_id: str, service=None) -> str:  # pragma: no cover
    """Crée le dossier véhicule sous le parent et renvoie son id."""
    service = service or _service()
    created = service.files().create(
        body=folder_metadata(name, parent_id), fields="id"
    ).execute()
    return created["id"]


def upload_file(folder_id: str, filepath: str, name: str, service=None) -> str:  # pragma: no cover
    """Téléverse un fichier (renommé `name`) dans le dossier et renvoie son id."""
    from googleapiclient.http import MediaFileUpload

    service = service or _service()
    media = MediaFileUpload(filepath, mimetype=guess_mime(name), resumable=True)
    created = service.files().create(
        body=file_metadata(name, folder_id), media_body=media, fields="id"
    ).execute()
    return created["id"]


def delete_folder(folder_id: str, service=None) -> None:  # pragma: no cover
    """Supprime un dossier (et son contenu) — utilisé par l'historique."""
    service = service or _service()
    service.files().delete(fileId=folder_id).execute()


def list_history(parent_id: str, service=None) -> list[dict[str, Any]]:  # pragma: no cover
    """Liste les dossiers véhicule sous le parent (source de l'historique)."""
    service = service or _service()
    query = f"'{parent_id}' in parents and mimeType = '{FOLDER_MIME}' and trashed = false"
    resp = service.files().list(
        q=query, fields="files(id, name, createdTime)", orderBy="createdTime desc"
    ).execute()
    return resp.get("files", [])
