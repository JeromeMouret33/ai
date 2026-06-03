"""Génération d'image (modèle image configurable, défaut Nano Banana Pro).

Envoie jusqu'à 4 références (showroom, logo, véhicule, + plaque si option)
+ le prompt assemblé + le preset d'angle + image_config (ratio, résolution)
au modèle de génération via OpenRouter. Produit N candidats (défaut 1).

STUB Phase 1.
"""


def generate(prompt: str, references: list, config: dict) -> list:
    """Génère des candidats pour une photo.

    Args:
        prompt: prompt assemblé.
        references: assets actifs (showroom, logo, véhicule, plaque).
        config: paramètres (modèle, ratio, résolution, candidats).

    Returns:
        Liste des candidats générés (chemins ou bytes).
    """
    raise NotImplementedError("Phase 1 : appel OpenRouter (modèle config['models']['generation']).")
