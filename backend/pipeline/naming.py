"""Nomenclature de renommage.

Dossier Drive : "{Marque} {Modèle} {infos}" (ex. "Peugeot 208 GT-Line").
Fichiers      : "{marque}-{modele}_{angle}.jpg".
Même angle ×N : suffixe "-01", "-02".

STUB Phase 1.
"""


def folder_name(marque: str, modele: str, infos: str = "") -> str:
    """Nom du dossier véhicule pour le Drive."""
    raise NotImplementedError("Phase 1.")


def file_name(marque: str, modele: str, angle: str, index: int | None = None) -> str:
    """Nom de fichier d'une photo selon l'angle (+ suffixe si doublon)."""
    raise NotImplementedError("Phase 1.")
