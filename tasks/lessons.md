# LEÇONS

Format : [date] | ce qui a mal tourné | règle pour l'éviter

(À relire à chaque démarrage de session, à compléter après chaque correction.)

2026-06-03 | Les en-têtes HTTP (X-Title OpenRouter) contenaient un tiret cadratin "—" (U+2014) non encodable en ASCII/latin-1 → httpx levait UnicodeEncodeError sur CHAQUE requête. | Toujours assainir en ASCII les valeurs d'en-tête HTTP construites depuis du texte libre (titres, env vars). Helper `_ascii_header`.
2026-06-03 | Test end-to-end OpenRouter impossible depuis l'environnement web : politique réseau restrictive (403 "Host not in allowlist" sur openrouter.ai). | Vérifier l'allowlist réseau (hôtes autorisés en sortie) AVANT de planifier des tests d'API live. Les appels externes nécessitent un environnement dont la politique réseau autorise l'hôte, ou un run local.
2026-06-03 | Lint Next 16 (react-hooks/set-state-in-effect) : créer un object URL dans un useEffect avec setUrl() déclenche "Calling setState synchronously within an effect". | Pour une valeur dérivée d'une prop (ex. URL.createObjectURL d'un File), utiliser useMemo pour la valeur + un useEffect SANS setState pour le revoke au démontage.
2026-06-03 | App Router : avec un fichier `manifest.ts`, Next injecte déjà `<link rel="manifest" href="/manifest.webmanifest">`. Ajouter aussi `manifest:` dans `metadata` le duplique. | Ne pas définir `metadata.manifest` quand `app/manifest.ts` existe ; laisser Next gérer le lien.
