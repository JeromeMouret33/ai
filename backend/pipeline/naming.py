"""Nomenclature de renommage — pilotée par la config (éditable dans l'app).

Les templates viennent de `params.yaml -> nomenclature` :
    dossier : "{Marque} {Modèle} {infos}"      ({…} = valeurs saisies, casse conservée)
    fichier : "{marque}-{modele}_{angle}.jpg"  ({marque}/{modele} = slugs ; {angle} = slug d'angle)
Même angle ×N → suffixe "-01", "-02". Les angles de `toujours_numerotes`
(défaut : interieur, detail) sont numérotés même en un seul exemplaire.

Les valeurs par défaut ci-dessous ne servent que de repli : la source de vérité
est la config, threadée depuis l'orchestrateur.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter

DEFAULT_FOLDER_TEMPLATE = "{Marque} {Modèle} {infos}"
DEFAULT_FILE_TEMPLATE = "{marque}-{modele}_{angle}.jpg"
ALWAYS_INDEXED = {"interieur", "detail"}


def slugify(value: str) -> str:
    """Minuscule, sans accents, séparé par des tirets (ASCII sûr pour un nom de fichier)."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def folder_name(
    marque: str,
    modele: str,
    infos: str = "",
    template: str = DEFAULT_FOLDER_TEMPLATE,
) -> str:
    """Nom lisible du dossier véhicule (casse d'origine conservée)."""
    out = (
        template.replace("{Marque}", marque or "")
        .replace("{Modèle}", modele or "")
        .replace("{infos}", infos or "")
    )
    return " ".join(out.split())  # normalise les espaces (gère infos vide)


def file_name(
    marque: str,
    modele: str,
    angle: str,
    index: int | None = None,
    template: str = DEFAULT_FILE_TEMPLATE,
) -> str:
    """Nom de fichier d'une photo. `index` (1-based) insère un suffixe -NN avant l'extension."""
    name = (
        template.replace("{marque}", slugify(marque))
        .replace("{modele}", slugify(modele))
        .replace("{angle}", angle)
    )
    if index is not None:
        root, dot, ext = name.rpartition(".")
        name = f"{root}-{index:02d}.{ext}" if dot else f"{name}-{index:02d}"
    return name


def assign_names(
    marque: str,
    modele: str,
    angles: list[str],
    *,
    file_template: str = DEFAULT_FILE_TEMPLATE,
    always_indexed: set[str] = ALWAYS_INDEXED,
) -> list[str]:
    """Attribue un nom de fichier à chaque angle, en gérant les doublons.

    Règle : suffixe -NN si l'angle apparaît plusieurs fois OU s'il fait partie
    des angles toujours numérotés.
    """
    totals = Counter(angles)
    running: Counter[str] = Counter()
    names: list[str] = []
    for angle in angles:
        running[angle] += 1
        needs_index = angle in always_indexed or totals[angle] > 1
        index = running[angle] if needs_index else None
        names.append(file_name(marque, modele, angle, index, template=file_template))
    return names
