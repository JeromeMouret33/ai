# LEÇONS

Format : [date] | ce qui a mal tourné | règle pour l'éviter

(À relire à chaque démarrage de session, à compléter après chaque correction.)

2026-06-03 | Les en-têtes HTTP (X-Title OpenRouter) contenaient un tiret cadratin "—" (U+2014) non encodable en ASCII/latin-1 → httpx levait UnicodeEncodeError sur CHAQUE requête. | Toujours assainir en ASCII les valeurs d'en-tête HTTP construites depuis du texte libre (titres, env vars). Helper `_ascii_header`.
2026-06-03 | Test end-to-end OpenRouter impossible depuis l'environnement web : politique réseau restrictive (403 "Host not in allowlist" sur openrouter.ai). | Vérifier l'allowlist réseau (hôtes autorisés en sortie) AVANT de planifier des tests d'API live. Les appels externes nécessitent un environnement dont la politique réseau autorise l'hôte, ou un run local.
2026-06-03 | Lint Next 16 (react-hooks/set-state-in-effect) : créer un object URL dans un useEffect avec setUrl() déclenche "Calling setState synchronously within an effect". | Pour une valeur dérivée d'une prop (ex. URL.createObjectURL d'un File), utiliser useMemo pour la valeur + un useEffect SANS setState pour le revoke au démontage.
2026-06-03 | App Router : avec un fichier `manifest.ts`, Next injecte déjà `<link rel="manifest" href="/manifest.webmanifest">`. Ajouter aussi `manifest:` dans `metadata` le duplique. | Ne pas définir `metadata.manifest` quand `app/manifest.ts` existe ; laisser Next gérer le lien.
2026-06-03 | Supabase : la clé anon est publique ; sans RLS, les tables sont accessibles via PostgREST par n'importe qui. | TOUJOURS activer RLS (`enable row level security`) sur les tables exposées ; le backend passe par `service_role` (bypass RLS).
2026-06-03 | Uploads : utiliser `f.filename` brut pour un chemin disque/bucket = path traversal (`../`). | Assainir tout nom fourni par le client (`safe_filename` : basename + whitelist) avant écriture/stockage.
2026-06-03 | Auth « fail-open » : désactiver l'auth quand un secret manque ouvre l'app si mal configurée en prod. | Échec SÛR : en production, refuser (503) plutôt que d'ouvrir quand la config d'auth est absente.
2026-06-04 | Supabase a migré les projets vers des « JWT Signing Keys » asymétriques (ES256) : un backend qui vérifie en HS256 avec le legacy secret échoue. | Vérifier les tokens via JWKS (PyJWT + PyJWKClient depuis SUPABASE_URL), avec repli HS256 selon l'algo du token.
2026-06-04 | Variables d'env VIDES sur Railway/Render (pas absentes) cassent `int("")` au démarrage. | Helpers env_str/env_int traitant vide/espaces comme « non défini » → repli sur défaut.
2026-06-04 | `requirements.txt` racine avec `-r backend/requirements.txt` : le builder Nixpacks ne résout pas le chemin imbriqué (Could not open requirements file). | Mettre une liste autonome à la racine pour le déploiement.
2026-06-04 | `pytest ... | tail` masque le code de sortie (renvoie celui de `tail` = 0) : un `&& git commit` enchaîné s'exécute même si les tests échouent. | Conditionner un commit aux tests en lançant pytest SANS pipe, ou vérifier `$?` séparément.
2026-06-05 | Renommer une photo isolément au retry (`assign_names` sur 1 élément) perdait les suffixes -01/-02 → collisions de noms dans le zip d'export (écrasement). | Tout nommage dédoublonné doit être recalculé sur l'ENSEMBLE du lot, jamais sur un élément isolé.
2026-06-05 | Deux features livrées séparément (purge après export / re-téléchargement Réalisations) étaient incompatibles : la purge cassait le re-téléchargement avec une erreur brute. | À chaque nouvelle feature, vérifier ses interactions avec les options existantes (matrice options × features), et donner un état UI explicite plutôt qu'une erreur.
2026-06-05 | Le QC ne recevait QUE l'image générée mais son instruction exigeait la fidélité « à la source » qu'il ne voyait pas : verdicts non fondés. | Quand un agent doit COMPARER, lui fournir les deux éléments ; relire chaque prompt en se demandant « a-t-il les entrées pour faire ce qu'on lui demande ? ».
