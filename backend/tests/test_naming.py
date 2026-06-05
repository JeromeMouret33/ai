from backend.pipeline import naming


def test_slugify_accents_and_spaces():
    assert naming.slugify("Peugeot") == "peugeot"
    assert naming.slugify("208 GT-Line") == "208-gt-line"
    assert naming.slugify("Citroën C3 Aircross") == "citroen-c3-aircross"


def test_folder_name_joins_non_empty():
    assert naming.folder_name("Peugeot", "208", "GT-Line") == "Peugeot 208 GT-Line"
    assert naming.folder_name("Peugeot", "208", "") == "Peugeot 208"


def test_file_name_with_and_without_index():
    assert naming.file_name("Peugeot", "208 GT-Line", "face-avant") == "peugeot-208-gt-line_face-avant.jpg"
    assert naming.file_name("Peugeot", "208", "profil-gauche", 2) == "peugeot-208_profil-gauche-02.jpg"


def test_folder_name_client_template():
    tpl = "{client_nom} {client_prenom} - {Marque} {Modèle}"
    assert (
        naming.folder_name("Peugeot", "208", "GT-Line", template=tpl,
                           client_nom="Dupont", client_prenom="Jean")
        == "Dupont Jean - Peugeot 208"
    )
    # Prénom vide -> pas de double espace, tiret conservé (interne).
    assert (
        naming.folder_name("Peugeot", "208", template=tpl, client_nom="Dupont")
        == "Dupont - Peugeot 208"
    )
    # Client vide -> tiret de tête retiré.
    assert naming.folder_name("Peugeot", "208", template=tpl) == "Peugeot 208"


def test_config_driven_templates():
    # Template de fichier personnalisé + jeu d'angles toujours numérotés custom.
    names = naming.assign_names(
        "Renault", "Clio", ["face-avant", "vue-drone"],
        file_template="{marque}_{modele}_{angle}.png",
        always_indexed={"vue-drone"},
    )
    assert names == ["renault_clio_face-avant.png", "renault_clio_vue-drone-01.png"]
    # Template de dossier personnalisé.
    assert naming.folder_name("Renault", "Clio", "RS", template="{Modèle} {Marque} - {infos}") \
        == "Clio Renault - RS"


def test_assign_names_dedup_and_always_indexed():
    angles = ["face-avant", "profil-gauche", "profil-gauche", "interieur", "detail", "arriere"]
    names = naming.assign_names("Peugeot", "208", angles)
    assert names == [
        "peugeot-208_face-avant.jpg",          # unique -> pas de suffixe
        "peugeot-208_profil-gauche-01.jpg",    # doublon -> -01
        "peugeot-208_profil-gauche-02.jpg",    # doublon -> -02
        "peugeot-208_interieur-01.jpg",        # toujours numéroté
        "peugeot-208_detail-01.jpg",           # toujours numéroté
        "peugeot-208_arriere.jpg",
    ]
