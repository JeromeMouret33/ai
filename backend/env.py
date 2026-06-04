"""Lecture d'environnement robuste (Phase déploiement).

Sur les plateformes (Railway/Render…), une variable peut exister mais être VIDE.
`os.environ.get(name, default)` renvoie alors "" (pas le défaut), ce qui casse
`int("")`. Ces helpers traitent vide/espaces comme « non défini » → repli sur le défaut.
"""

from __future__ import annotations

import os


def env_str(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    return value if value is not None and value.strip() != "" else default


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default
