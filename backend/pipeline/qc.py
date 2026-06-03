"""Contrôle qualité (modèle vision configurable via OpenRouter).

Vérifie : décor conforme, logo net, voiture fidèle, avec vérification zoomée
des zones sensibles (DRL, jantes, calandre, badges, optiques).
Renvoie un verdict + des raisons. NE relance PAS automatiquement : la décision
de relance est prise côté UI (aperçu + confirmation humaine).

STUB Phase 1.
"""


def qc(image_path: str, config: dict) -> dict:
    """Évalue la qualité d'une image générée.

    Returns:
        dict : { "verdict": "ok"|"ko", "reasons": [str, ...] }.
    """
    raise NotImplementedError("Phase 1 : appel OpenRouter (modèle config['models']['qc']).")
