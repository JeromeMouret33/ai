// Service worker minimal — Showroom IA (GOODCAR).
// Objectif : installabilité PWA. Stratégie : cache de l'app shell au install,
// puis network-first avec repli cache pour les navigations (offline gracieux).
const CACHE = "showroom-ia-v1";
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

  // Navigations : network-first, repli sur le cache puis l'accueil.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Autres GET : passthrough réseau, repli cache si dispo.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
