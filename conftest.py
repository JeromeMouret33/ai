"""Assure que la racine du repo est sur sys.path pour `import backend...` en test."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
