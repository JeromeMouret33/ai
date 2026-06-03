# Plan d’attaque — Showroom virtuel IA pour véhicules

> Spécification de référence (verbatim). Source de vérité du projet, à lire au
> démarrage de toute session avec `prompts-config-goodcar.md` et `tasks/todo.md`.

## Objectif

Automatiser la chaîne : upload d’environ 15 photos d’un véhicule (sources variées) → détection de l’angle → génération IA du véhicule intégré dans un showroom de marque **fixe** → renommage → livraison sur Google Drive. Rendu 100 % génératif, régularité obtenue par garde-fous, **tout réglable via une config éditable dans l’app**.

-----

## Stack validée

- **Accès IA** : OpenRouter (1 seule clé, API compatible OpenAI) — classification, génération, contrôle qualité.
- **Modèle image** : Nano Banana Pro → `google/gemini-3-pro-image-preview` (multi-références, 4K, ratio configurable).
- **Backend** : Python (FastAPI), hébergé sur **Railway** (ou Render) — service toujours actif, jobs longs traités en tâche de fond.
- **Frontend** : web (Next.js), déployé sur Vercel.
- **Stockage** : Supabase (buckets + base de données).
- **Livraison** : Google Drive (dossier au nom du véhicule).
- **Configuration** : tous les prompts (en fragments) et paramètres sont éditables dans l’app — voir « Couche de configuration ».

-----

## Base acquise (prérequis prêts)

- Plaque showroom de référence figée (mur propre, sans logo).
- Logo GOODCAR HD prêt à pousser en référence.
- Image de plaque d’immatriculation GOODCAR (option plaque).
- Prompt validé (version A) découpé en fragments → voir `prompts-config-goodcar.md`.

*(Plus de phase de validation manuelle : la base est prête, on construit.)*

-----

## Traitement par photo (modèles distincts, réglables dans l’app)

Trois rôles IA, chacun avec son **propre modèle configurable** dans l’app (via OpenRouter) :

1. **Classification** (modèle vision configurable) → détecte l’angle + score de confiance. Sert aussi à : **renommer** la photo selon l’angle (nomenclature ci-dessous) et déclencher la **création du dossier** véhicule dans un répertoire Drive spécifique (configurable).
1. **Génération** (modèle image configurable, défaut Nano Banana Pro) → jusqu’à **4 références** (showroom, logo, véhicule, + plaque si option) + **prompt assemblé depuis la config** + preset d’angle + `image_config` (ratio 3:2, résolution 1K). **1 candidat par défaut** (configurable dans l’app).
1. **Contrôle qualité** (modèle vision configurable) → vérifie décor conforme, logo net, voiture fidèle, avec **vérification zoomée des zones sensibles** (DRL, jantes, calandre, badges). En cas de problème détecté : **on n’auto-relance pas en silence** — l’app affiche un **aperçu de la photo concernée et demande validation avant de relancer**.

### Nomenclature de renommage (validée)

- **Dossier Drive** : `{Marque} {Modèle} {infos}` (ex. `Peugeot 208 GT-Line`), créé dans un **répertoire parent Drive configurable**.
- **Fichiers** : `{marque}-{modele}_{angle}.jpg`, slugs d’angle :
  `face-avant`, `3-4-avant-gauche`, `3-4-avant-droit`, `profil-gauche`,
  `profil-droit`, `3-4-arriere-gauche`, `3-4-arriere-droit`, `arriere`,
  `interieur-01`, `detail-01`…
- Plusieurs photos d’un même angle → suffixe `-01`, `-02`.

-----

## Couche de configuration (prompts & paramètres éditables)

Le système est piloté par une config, pas par du code en dur :

- **Fragments de prompt** modulaires, chacun éditable dans l’app : `role`, `vehicle_lock`, références, `task_base`, `relight`, `plate`, `composition`, `constraints`, `interior`.
- **Bibliothèque de références (upload + aperçu + sélection)** : champs d’upload pour le **showroom**, le **logo** et la **plaque d’immatriculation**. On peut déposer plusieurs assets par type, les visualiser en **vignettes**, et **choisir lequel est actif**. La génération utilise les assets actifs.
- **Modèles distincts par rôle (configurables)** : un modèle pour la classification, un pour la génération (défaut Nano Banana Pro), un pour le contrôle qualité — chacun réglable dans l’app.
- **Réassemblage à la demande** : selon l’angle détecté (extérieur / intérieur) et les options actives, l’app concatène uniquement les fragments voulus.
- **Options activables (toggles)** : relight on/off, plaque on/off, blanchiment des vitres intérieur on/off…
- **Paramètres** : modèles (×3), ratio (3:2 par défaut), résolution (**1080p**), nb de candidats, retries max, position/taille du logo, **répertoire Drive parent** où créer les dossiers véhicule.

But : affiner chaque réglage et tester des variantes sans retoucher le code. Détail complet (fragments + logique d’assemblage) dans `prompts-config-goodcar.md`.

-----

## Garde-fous de régularité

- Références désignées par leur rôle (showroom / logo / véhicule / plaque), pas par un numéro.
- Fragments de prompt figés en config ; seules variables = angle, cadrage, paramètres.
- Clauses de préservation strictes : décor inchangé, voiture fidèle.
- **Relighting version A** : autorisé uniquement sur surfaces lisses (portes, capot, toit, ailes) + vitres latérales/arrière ; éléments lumineux (DRL, phares, feux) et détails fins (jantes, calandre, badges, optiques) **verrouillés**. Activable/désactivable.
- Logo : fidélité maximale, poussé en référence à chaque génération.
- Format de sortie constant (ratio + résolution).
- Presets de cadrage par angle.
- QC avec **validation humaine** : en cas de problème détecté, aperçu de la photo concernée + demande avant relance (pas d’auto-relance silencieuse).

-----

## Flux de validation, livraison & historique

### Galerie de validation (avant Drive)

Après génération, **rien ne part automatiquement sur le Drive**. L’app affiche une **galerie d’aperçus** de toutes les photos générées du job. L’utilisateur **coche celles à garder** (les autres sont ignorées ou relançables). Au clic « Livrer », seules les photos cochées sont renommées et envoyées sur le Drive.

### Livraison Drive

À la validation : création du **dossier véhicule** dans le **répertoire parent Drive configuré**, renommage selon la nomenclature validée, upload des photos cochées.

### Historique des générations

Vue listant les **générations passées**, avec le **Drive comme source** (dossier, date, véhicule, nb de photos, vignettes). Pour chaque entrée : possibilité de **supprimer depuis l’app** → supprime l’enregistrement **et le dossier Drive** correspondant.

-----

### Phase 1 — Config + cœur génératif (CLI, sans interface)

- [ ] Schéma de config (fragments de prompt + paramètres + **3 modèles** + toggles + répertoire Drive) + **assembleur de prompt**.
- [ ] Intégration OpenRouter : `generate()` (modèle image), `classify()` (modèle vision), `qc()` (modèle vision) — chacun lit son modèle dans la config.
- [ ] Classification → angle + confiance + **nom de fichier** (nomenclature) + nom du dossier véhicule.
- [ ] QC → détecte les problèmes ; renvoie un verdict + raisons (la décision de relance est laissée à l’utilisateur côté UI).
- [ ] Orchestrateur : boucle sur un dossier de photos.
- [ ] Test end-to-end sur ~30 photos.

### Phase 2 — Stockage, nommage, livraison

- [ ] Supabase : buckets (`references`, `uploads`, `outputs`) + tables (`jobs`, `photos` : statut, angle, tentatives, URLs, retenue oui/non).
- [ ] Table `reference_assets` (type = showroom/logo/plaque, nom, URL, vignette, actif).
- [ ] Renommage selon la nomenclature validée.
- [ ] Livraison Google Drive : création du dossier véhicule dans le **répertoire parent configuré** + upload des photos **cochées**.

### Phase 3 — Interface web (génération, validation, config, historique)

- [ ] Front : drag-drop photos + champs (nom véhicule, marque/modèle/infos) + bouton lancer + progression par photo.
- [ ] **QC interactif** : aperçu de la photo signalée + choix relancer / garder.
- [ ] **Galerie de validation** : aperçus + cases à cocher → livrer la sélection sur le Drive.
- [ ] **Écran de config** : upload + aperçu vignettes (showroom / logo / plaque) + sélection de l’actif ; édition des fragments ; 3 modèles ; options ; paramètres ; répertoire Drive.
- [ ] **Historique** : liste des générations (source Drive) + suppression app + dossier Drive.
- [ ] Câblage front ↔ backend + déploiement.

### Phase 4 — Robustesse & finitions

- [ ] Relance ciblée d’une photo, ajustements.
- [ ] Logs, gestion d’erreurs, suivi des coûts par job.
- [ ] Affinage des presets par angle.

-----

## Structure de repo proposée (pour Claude Code)

```
showroom-ia/
├── backend/
│   ├── main.py                 # FastAPI : upload / process / status / deliver / config
│   ├── config/
│   │   ├── prompt_fragments.*  # tous les fragments éditables
│   │   └── params.*            # 3 modèles, ratio, résolution, candidats, toggles, logo_position, dossier Drive parent
│   ├── pipeline/
│   │   ├── prompt_builder.py   # assemble le prompt selon angle + options
│   │   ├── classify.py         # angle + nomenclature de renommage
│   │   ├── generate.py         # appel modèle image (refs + prompt + image_config)
│   │   ├── qc.py               # verdict + raisons (relance décidée côté UI)
│   │   └── naming.py
│   └── storage/
│       ├── supabase.py
│       └── drive.py            # création dossier, upload sélection, suppression dossier
├── frontend/                   # Next.js (upload, validation cochée, config, historique)
├── assets/                     # plaque showroom, logo, plaque immatriculation
└── .env                        # OPENROUTER_API_KEY, SUPABASE_*, GOOGLE_*
```

> Note d’implémentation : dans ce repo, `backend/`, `frontend/` et `assets/` sont
> à la **racine** (pas dans un sous-dossier `showroom-ia/`).

-----

## Ordre de construction dans Claude Code

Phase 1 (config + cœur en CLI, là où est tout le risque) → Phase 2 (stockage + livraison) → Phase 3 (UI + config) → Phase 4 (finitions). On prouve la fiabilité du traitement avant d’investir dans l’UI.

-----

## Décisions verrouillées

- Approche **100 % générative** via OpenRouter + Nano Banana Pro.
- **4 références** : showroom, logo, véhicule, plaque d’immatriculation (option).
- Logo **poussé en référence**, fidélité max ; position recommandée (mur du fond, haut gauche — voir pack).
- Plaque showroom **dérivée de la photo d’exemple** (acquise).
- **Relighting version A** (surfaces lisses + vitres latérales/arrière ; lumineux et détails verrouillés). Activable/désactivable.
- **Ratio = format photo classique 3:2** (configurable).
- **Résolution = 1K** (configurable).
- **3 modèles distincts** (classification / génération / QC), réglables dans l’app.
- **QC à validation humaine** : aperçu + confirmation avant relance.
- **Galerie de validation** : on coche les photos à livrer avant envoi Drive.
- **Historique** des générations (source Drive) + suppression app ↔ dossier Drive.
- Dossiers véhicule créés dans un **répertoire Drive parent configurable**.
- **Une plaque showroom par défaut** ; la bibliothèque permet d’en ajouter (ex. une « profil ») seulement si certains angles rendent mal.
- **Inpaint écarté pour l’instant**, gardé en recours.
- **Tout configurable dans l’app** : prompts (fragments) + paramètres + options.
- **Hébergement** : frontend Vercel, backend Railway (ou Render), jobs en tâche de fond.
- **Nombre de candidats par photo configurable dans l’app, défaut 1.**

-----

## Décisions encore ouvertes (cf. `prompts-config-goodcar.md` §8)

- Une seule plaque showroom, ou 2-3 selon l’angle (meilleur ancrage au sol).
- Nombre de candidats par photo : **défaut verrouillé à 1** ici, mais le pack de prompts mentionne « défaut 2 » → à trancher.
- Hébergement backend (traitement de plusieurs minutes par série → backend toujours actif vs serverless).
