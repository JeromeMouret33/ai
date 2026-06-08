# Prompts & configuration — GOODCAR (showroom virtuel IA)

Principe : le prompt n’est **jamais écrit en bloc**. Il est composé de **fragments** stockés dans la config, éditables dans l’app, et **réassemblés à la demande** selon l’angle détecté et les options actives. Chaque fragment ci-dessous = un champ texte modifiable dans l’écran de configuration.

-----

## 1. Références fournies à la génération

Chaque référence provient d’une **bibliothèque uploadable** dans l’app : on dépose un ou plusieurs assets par type, on les voit en vignettes, et on choisit l’**asset actif**. La génération utilise l’asset actif de chaque type.

- **SHOWROOM image** — plaque figée (mur propre, sans logo). Bibliothèque uploadable, un actif sélectionné.
- **LOGO image** — logo GOODCAR propre, haute résolution. Bibliothèque uploadable, un actif. Fidélité maximale.
- **VEHICLE image** — la photo du véhicule à traiter (vient de l’upload du job, pas de la bibliothèque).
- **PLATE image** — visuel de plaque d’immatriculation GOODCAR. Bibliothèque uploadable, un actif. *Utilisée seulement si l’option plaque est activée.*

> Intérieur : seule la VEHICLE image est utilisée (ni showroom, ni logo, ni plaque).

-----

## 2. Fragments de prompt (éditables en config)

> ⚠️ **2026-06-04 — prompts simplifiés (version épurée).** On a allégé les fragments
> (moins de verrouillage, on autorise une re-photo à hauteur d'œil pour corriger les
> perspectives plongée/contre-plongée). La **version vivante et autoritative** est
> `backend/config/prompt_fragments.yaml`. Les blocs ci-dessous décrivent l'intention
> d'origine (version A détaillée) et peuvent diverger pendant l'itération.

### `role` — toujours

```
Professional automotive studio compositor.
```

### `vehicle_lock` — toujours (cœur de la fidélité)

```
The car in the vehicle image is the subject. Preserve its IDENTITY exactly: same
model, trim, proportions, silhouette, body lines, panel gaps and paint COLOUR
(hue). These fine details are copied faithfully and never redrawn, added or
removed: headlights, tail lights, wheels/rims, grille, badges, emblems, lettering,
mirrors, door handles. LIGHT-EMITTING ELEMENTS ARE STRICTLY LOCKED: daytime
running lights (DRLs), headlight internals and lenses, indicators and tail lights
keep their EXACT original shape, internal pattern, light signature, colour and
glow — never re-rendered, relit, brightened, recoloured or restyled; their lenses
are NOT treated as "glass". Do NOT change the model or the geometry, and do not
invent missing parts. However, capture flaws of the SOURCE PHOTO (blown-out sun
highlights, harsh specular glare, strong cast shadows, uneven or coloured
exposure) MAY be normalised to the clean studio light (see the relighting rule),
as long as the paint hue, geometry and every fine detail stay identical.
```

### `ref_showroom` — toujours (extérieur)

```
SHOWROOM image (empty, clean wall, NO logo). Reproduce it EXACTLY: same white
matte walls and corner, same warm LED cove strip, same recessed ceiling spots,
same light-grey lightly textured floor with subtle reflection. Do NOT recolor,
redesign, relight, or move anything in the environment.
```

### `ref_logo` — toujours (extérieur)

```
LOGO image (GOODCAR). Reproduce the GOODCAR logo on the upper-left wall as a FLAT
printed/painted brand sign in its EXACT original colours — same shapes, wordmark,
tagline and colour fills, correct aspect ratio, crisp legible text. It is a
coloured graphic APPLIED on the wall, NOT a monochrome engraving or an embossed/
raised 3D relief: keep its real colours, do NOT tint it to the wall colour, do NOT
desaturate, recolour, relight, stretch, distort, crop, duplicate or restyle it.
Position: {LOGO_POSITION_SIZE}. Maximum logo fidelity.
```

### `ref_vehicle` — toujours

```
VEHICLE image — the exact car to feature (see the locked-asset rule above).
```

### `ref_plate` — seulement si `plate_enabled`

```
PLATE image — the GOODCAR license plate to apply to the vehicle.
```

### `task_base` — extérieur (toujours en extérieur)

```
Place the vehicle from the vehicle image into the showroom from the showroom
image as if professionally photographed there, shown at: {ANGLE}. Ground it
realistically — wheels firmly on the floor, with a soft contact shadow under the
car and a subtle reflection of the car on the showroom floor, matching the
showroom's soft, slightly warm light. Place the GOODCAR logo on the wall as
specified.
```

### `relight` — option `relight_enabled`

```
Relight the car to match the showroom's soft, even, slightly warm studio light.
On the large smooth painted body panels (doors, hood, roof, fenders, bumpers) and
the side/rear window glass you MAY: even out the exposure and REMOVE the source
photo's sun hotspots, blown highlights, harsh specular glare and strong cast
shadows, replacing them with clean soft studio reflections and highlights laid
OVER the existing surface. This must never redraw any shape and never change the
actual paint hue.
FORBIDDEN: relighting or re-rendering any light-emitting element (DRLs, headlights,
indicators, tail lights) or treating their lenses as glass; altering wheels,
grille, badges, lettering, optics or any fine detail; changing the paint colour.
```

> Si `relight_enabled = false` : ce fragment est omis et la voiture garde intégralement la surface de sa photo d’origine (seules l’ombre au sol et le reflet au sol sont ajoutés par `task_base`).

### `plate` — option `plate_enabled`

```
Replace the vehicle's visible license plate(s) with the plate from the plate
image, fitted neatly into the existing plate area with correct perspective,
undistorted. Reproduce the plate exactly as in the plate image.
```

### `composition` — toujours (extérieur)

```
COMPOSITION ({ANGLE}): {FRAMING_PRESET}
```

### `constraints` — toujours

```
STRICT CONSTRAINTS:
- Output {RATIO}, {RESOLUTION}, photoreal, clean, no artifacts.
- Keep the showroom 100% identical to the showroom image on every generation.
- The car's identity is locked (model, paint hue, wheels, lights, grille, badges,
  body lines, proportions). Do NOT hallucinate, invent, complete or "improve" any
  part of the car.
- The logo must match the logo image exactly: undistorted, correct aspect ratio,
  legible text, placed once on the upper-left wall.
- No added text, watermarks, people, or extra objects.
```

### `interior` — variante (remplace task_base + relight + plate + composition quand `{ANGLE}` = intérieur)

```
INTERIOR: Keep the cabin from the vehicle image exactly as-is; do not place it in
a showroom, do not add the logo, do not relight. Only replace what is visible
through the windows with clean, evenly blown-out white. Preserve all interior
details, materials and colors. Do NOT redraw or restyle any part of the interior.
```

-----

## 3. Logique d’assemblage (reconstitution à la demande)

```
if angle == "interior":
    prompt = role + vehicle_lock + ref_vehicle + interior + constraints
else:
    refs = ref_showroom + ref_logo + ref_vehicle
    if plate_enabled: refs += ref_plate
    body = task_base
    if relight_enabled: body += relight
    if plate_enabled:   body += plate
    prompt = role + vehicle_lock + refs + body + composition + constraints
```

Les variables `{ANGLE}`, `{FRAMING_PRESET}`, `{LOGO_POSITION_SIZE}`, `{RATIO}`, `{RESOLUTION}` sont injectées depuis les paramètres au moment de l’assemblage.

-----

## 4. Paramètres & options (config éditable)

```yaml
parametres:
  models:
    classification: "openai/gpt-4o-mini"      # vision via OpenRouter
    generation: "google/gemini-3-pro-image-preview"
    qc: "openai/gpt-4o-mini"                   # peut différer de la classification
  ratio: "3:2"            # format photo classique (configurable : 4:3, 16:9…)
  resolution: "1K"        # palier natif Nano Banana
  candidates_per_photo: 1   # configurable dans l'app
  max_retries: 2
  logo_position_size: "back wall, upper-left; logo left edge ~7% from frame's left border; width ~17% of frame width; vertical center ~30% from top; subtle raised 3D relief; never overlapping the vehicle"
  drive_parent_folder: "<id ou chemin du dossier Drive parent>"

nomenclature:
  dossier: "{Marque} {Modèle} {infos}"
  fichier: "{marque}-{modele}_{angle}.jpg"
  angles: [face-avant, 3-4-avant-gauche, 3-4-avant-droit, profil-gauche,
           profil-droit, 3-4-arriere-gauche, 3-4-arriere-droit, arriere,
           interieur-01, detail-01]
  doublon_meme_angle: "suffixe -01, -02"
  toujours_numerotes: [interieur, detail]   # numérotés même en un seul exemplaire

options:
  relight_enabled: true   # qualité avec garde-fous (version A)
  plate_enabled: true      # remplacer la plaque par la PLATE image
  interior_window_whiten: true

references_actives:        # asset choisi dans chaque bibliothèque uploadable
  showroom_asset_id: "<id de la vignette sélectionnée>"
  logo_asset_id: "<id de la vignette sélectionnée>"
  plate_asset_id: "<id de la vignette sélectionnée>"
```

-----

## 5. Position logo recommandée (valeur par défaut)

Mur du fond, en haut à gauche : bord gauche du logo à ~7 % du bord gauche de l’image, largeur ~17 % de la largeur de l’image, centre vertical à ~30 % depuis le haut, nettement au-dessus du toit du véhicule (jamais de chevauchement), léger relief 3D. Modifiable dans la config.

-----

## 6. Presets d’angle (`{ANGLE}` + `{FRAMING_PRESET}`)

Détectés par la classification, injectés dans `composition`. À affiner :

- `front 3/4 left` → angled, front-left visible, slightly low camera, car ~70% of frame width, centered.
- `front 3/4 right` → mirror.
- `profile left` / `profile right` → full side, eye-level, ~80% frame width.
- `front` → straight front, centered, slightly low camera.
- `rear` / `rear 3/4 left` / `rear 3/4 right` → rear visible, same logic.
- `interior` → variante `interior`, pas de showroom.
- `detail` → gros plan ; décor neutre ou selon décision.

-----

## 7. (Annexe) Régénérer une plaque showroom

La plaque actuelle est acquise. Pour en refaire une (ou des variantes par angle), éditer la photo d’exemple avec Nano Banana Pro :

```
Edit the provided image: remove the car completely AND remove the GOODCAR wall
logo, then reconstruct the empty showroom behind and beneath them. Keep
everything else strictly identical (white matte walls and corner, warm LED cove
strip, recessed ceiling spots, smooth light-grey lightly textured floor with
subtle reflection and gentle gradient). Leave the upper-left wall clean and empty.
No car, no logo, no people, no text, no extra objects. High resolution, photoreal.
```

-----

## 8. Décisions encore ouvertes

- Une seule plaque showroom, ou 2-3 selon l’angle (meilleur ancrage au sol).
- Hébergement backend (traitement de plusieurs minutes par série → backend toujours actif vs serverless).

> Nombre de candidats par photo : **tranché → défaut 1** (configurable dans l’app).
