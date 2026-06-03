"""Assembleur de prompt.

Concatène les fragments de config (prompt_fragments.yaml) en fonction de
l'angle détecté (extérieur / intérieur) et des options actives (relight,
plaque), puis injecte les variables depuis les paramètres.

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

Variables injectées depuis params.yaml :
    {ANGLE}, {FRAMING_PRESET}, {LOGO_POSITION_SIZE}, {RATIO}, {RESOLUTION}.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Slug d'angle traité comme prise de vue intérieure.
INTERIOR_ANGLE = "interieur"


@dataclass
class BuiltPrompt:
    """Résultat d'un assemblage."""

    text: str                    # prompt final, variables substituées
    reference_roles: list[str]   # rôles de référence à joindre (showroom, logo, vehicle, plate)
    is_interior: bool
    angle: str                   # slug d'angle


def build(angle: str, options: dict[str, Any], config: dict[str, Any]) -> BuiltPrompt:
    """Assemble le prompt final pour un angle et un jeu d'options donnés.

    Args:
        angle: slug d'angle (ex. "3-4-avant-gauche", "interieur").
        options: toggles actifs (relight_enabled, plate_enabled…).
        config: config chargée (clés "fragments" et "params").

    Returns:
        BuiltPrompt (texte + rôles de référence + flags).
    """
    fragments = config["fragments"]
    params = config["params"]

    presets = fragments.get("angle_presets", {})
    if angle not in presets:
        raise KeyError(f"Angle inconnu (absent de angle_presets): {angle!r}")
    preset = presets[angle] or {}

    is_interior = angle == INTERIOR_ANGLE or preset.get("angle") == "interior"
    plate_on = bool(options.get("plate_enabled"))
    relight_on = bool(options.get("relight_enabled"))

    if is_interior:
        # Intérieur : seule la VEHICLE image est utilisée.
        parts = [
            fragments["role"],
            fragments["vehicle_lock"],
            fragments["ref_vehicle"],
            fragments["interior"],
            fragments["constraints"],
        ]
        roles = ["vehicle"]
    else:
        refs = [fragments["ref_showroom"], fragments["ref_logo"], fragments["ref_vehicle"]]
        roles = ["showroom", "logo", "vehicle"]
        if plate_on:
            refs.append(fragments["ref_plate"])
            roles.append("plate")

        body = [fragments["task_base"]]
        if relight_on:
            body.append(fragments["relight"])
        if plate_on:
            body.append(fragments["plate"])

        parts = [
            fragments["role"],
            fragments["vehicle_lock"],
            *refs,
            *body,
            fragments["composition"],
            fragments["constraints"],
        ]

    text = "\n\n".join(part.strip() for part in parts)
    text = _inject(text, preset, params)
    return BuiltPrompt(text=text, reference_roles=roles, is_interior=is_interior, angle=angle)


def _inject(text: str, preset: dict[str, Any], params: dict[str, Any]) -> str:
    substitutions = {
        "{ANGLE}": str(preset.get("angle", "")),
        "{FRAMING_PRESET}": str(preset.get("framing", "")),
        "{LOGO_POSITION_SIZE}": str(params.get("logo_position_size", "")),
        "{RATIO}": str(params.get("ratio", "")),
        "{RESOLUTION}": str(params.get("resolution", "")),
    }
    for key, value in substitutions.items():
        text = text.replace(key, value)
    return text
