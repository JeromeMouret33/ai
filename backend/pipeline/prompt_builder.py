"""Assembleur de prompt.

Concatène les fragments de config (prompt_fragments.yaml) en fonction de
l'angle détecté (extérieur / intérieur) et des options actives (relight,
plaque, blanchiment vitres). Le preset de cadrage de l'angle surcharge la
section composition.

STUB Phase 1.
"""


def build(angle: str, options: dict, fragments: dict) -> str:
    """Assemble le prompt final pour un angle et un jeu d'options donnés.

    Args:
        angle: slug d'angle (ex. "3-4-avant-gauche", "interieur").
        options: toggles actifs (relight, plate, interior_window_whitening...).
        fragments: contenu de prompt_fragments.yaml.

    Returns:
        Le prompt assemblé (str).
    """
    raise NotImplementedError("Phase 1 : assemblage des fragments selon angle + options.")
