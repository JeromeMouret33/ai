"""Classification d'angle (modèle vision configurable via OpenRouter).

Détecte l'angle de prise de vue + un score de confiance, puis en dérive :
    - le slug d'angle (nomenclature),
    - le nom de fichier cible,
    - le nom du dossier véhicule.

STUB Phase 1.
"""


def classify(image_path: str, config: dict) -> dict:
    """Détecte l'angle d'une photo.

    Returns:
        dict : { "angle": slug, "confidence": float }.
    """
    raise NotImplementedError("Phase 1 : appel OpenRouter (modèle config['models']['classification']).")
