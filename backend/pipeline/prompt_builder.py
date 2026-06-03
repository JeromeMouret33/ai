"""Assembleur de prompt.

Concatène les fragments de config (prompt_fragments.yaml) en fonction de
l'angle détecté (extérieur / intérieur) et des options actives (relight,
plaque, blanchiment vitres). Le preset de cadrage de l'angle surcharge la
section composition.

Logique d'assemblage de référence (prompts-config-goodcar.md §3) :

    if angle == "interior":
        prompt = role + vehicle_lock + ref_vehicle + interior + constraints
    else:
        refs = ref_showroom + ref_logo + ref_vehicle
        if plate_enabled: refs += ref_plate
        body = task_base
        if relight_enabled: body += relight
        if plate_enabled:   body += plate
        prompt = role + vehicle_lock + refs + body + composition + constraints

Variables injectées depuis params.yaml au moment de l'assemblage :
    {ANGLE}, {FRAMING_PRESET}, {LOGO_POSITION_SIZE}, {RATIO}, {RESOLUTION}.

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
