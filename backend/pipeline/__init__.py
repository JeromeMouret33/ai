"""Pipeline génératif : assemblage de prompt, classification, génération, nommage.

Ordre logique par photo :
    classify() -> prompt_builder.build() -> generate()
La validation et la relance sont déclenchées par l'UI (humain).
"""
