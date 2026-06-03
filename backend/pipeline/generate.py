"""Génération d'image (modèle image configurable, défaut Nano Banana Pro).

Envoie les références désignées par leur rôle (showroom, logo, véhicule, +
plaque si option) + le prompt assemblé au modèle de génération via OpenRouter.
Produit N candidats (params.candidates_per_photo, défaut 1).
"""

from __future__ import annotations

from typing import Any

from . import openrouter
from .prompt_builder import BuiltPrompt


def generate(
    built: BuiltPrompt,
    references: dict[str, str],
    config: dict[str, Any],
) -> list[bytes]:
    """Génère les candidats d'une photo.

    Args:
        built: prompt assemblé (texte + rôles de référence requis).
        references: mapping rôle -> chemin de l'asset actif
            (ex. {"showroom": ..., "logo": ..., "vehicle": ..., "plate": ...}).
            La VEHICLE image change à chaque photo du job.
        config: config chargée.

    Returns:
        Liste d'images générées (bytes), une par candidat.
    """
    model = config["params"]["models"].get("generation")
    if not model:
        raise ValueError("Aucun modèle de génération configuré (params.models.generation).")

    n = int(config["params"].get("candidates_per_photo", 1) or 1)

    image_paths = _ordered_reference_paths(built.reference_roles, references)
    return openrouter.generate_image(model, built.text, image_paths, n=n)


def _ordered_reference_paths(roles: list[str], references: dict[str, str]) -> list[str]:
    """Chemins des références dans l'ordre des rôles, en ignorant les manquants.

    Un rôle requis mais sans asset actif est ignoré silencieusement ici (la
    validation "asset showroom/logo manquant" se fait en amont, côté orchestrateur).
    """
    paths: list[str] = []
    for role in roles:
        path = references.get(role)
        if path:
            paths.append(path)
    return paths
