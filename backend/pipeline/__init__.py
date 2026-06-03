"""Pipeline génératif : assemblage de prompt, classification, génération, QC, nommage.

Ordre logique par photo :
    classify() -> prompt_builder.build() -> generate() -> qc()
La décision de relance (en cas de verdict QC négatif) est laissée à l'UI.
"""
