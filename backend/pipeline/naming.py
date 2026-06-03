"""Nomenclature de renommage.

Dossier Drive : "{Marque} {Modèle} {infos}" (ex. "Peugeot 208 GT-Line").
Fichiers      : "{marque}-{modele}_{angle}.jpg".
Même angle ×N : suffixe "-01", "-02". Les angles `interieur` et `detail` sont
                toujours numérotés (cf. nomenclature : interieur-01, detail-01).
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter

# Angles toujours numérotés, même en un seul exemplaire.
ALWAYS_INDEXED = {"interieur", "detail"}


def slugify(value: str) -> str:
    """Minuscule, sans accents, séparé par des tirets (ASCII sûr pour un nom de fichier)."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def folder_name(marque: str, modele: str, infos: str = "") -> str:
    """Nom lisible du dossier véhicule pour le Drive (casse d'origine conservée)."""
    parts = [p.strip() for p in (marque, modele, infos) if p and p.strip()]
    return " ".join(parts)


def file_name(marque: str, modele: str, angle: str, index: int | None = None) -> str:
    """Nom de fichier d'une photo. `index` (1-based) ajoute un suffixe -NN."""
    base = f"{slugify(marque)}-{slugify(modele)}_{angle}"
    if index is not None:
        base = f"{base}-{index:02d}"
    return f"{base}.jpg"


def assign_names(marque: str, modele: str, angles: list[str]) -> list[str]:
    """Attribue un nom de fichier à chaque angle, en gérant les doublons.

    Règle : suffixe -NN si l'angle apparaît plusieurs fois OU s'il fait partie
    des angles toujours numérotés (interieur, detail).
    """
    totals = Counter(angles)
    running: Counter[str] = Counter()
    names: list[str] = []
    for angle in angles:
        running[angle] += 1
        needs_index = angle in ALWAYS_INDEXED or totals[angle] > 1
        index = running[angle] if needs_index else None
        names.append(file_name(marque, modele, angle, index))
    return names
