// Service worker minimal — Showroom IA (GOODCAR).
// Objectif : installabilité PWA + repli hors-ligne de l'app shell.
// IMPORTANT : on n'intercepte QUE les navigations de MÊME origine. Les appels
// API (Railway) et Supabase (autre origine) ne sont JAMAIS touchés par le SW,
// pour ne pas masquer les erreurs réseau/CORS ni renvoyer une réponse nulle.
const CACHE = "showroom-ia-v2";
const SHELL = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // On ne gère QUE les navigations de page (HTML) de même origine.
  // Tout le reste (assets, API Railway, Supabase…) part en réseau normal,
  // NON intercepté → pas de masquage d'erreur, pas de réponse nulle.
  if (req.mode !== "navigate") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
  );
});
