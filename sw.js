// DEV MODE Service Worker
// Goal: always pull latest HTML/CSS/JS so you don't fight cache while iterating.

const CACHE_NAME = "habit-tracker-dev-cache";

// Cache minimal assets (optional). Icons can be cached safely.
const SAFE_ASSETS = [
  "./",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon-180.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SAFE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isNavigate = req.mode === "navigate";

  // Always fetch latest for core files (prevents “stuck on old version”)
  const isCore =
    isNavigate ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.endsWith("/sw.js");

  if (isCore) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() => caches.match(req))
    );
    return;
  }

  // For everything else: cache-first (fine for icons)
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});