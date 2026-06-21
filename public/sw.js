// Host Hours service worker. Offline strategy tuned for an auth-driven app:
//   • navigations  → network-first, fall back to a branded offline page
//   • build assets → cache-first (immutable, hashed) for speed + offline shell
//   • everything else (APIs, dynamic/private data, cross-origin) → network only
// Bump CACHE when this file changes so old caches are cleared on activate.

const CACHE = "host-hours-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
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
  if (req.method !== "GET") return; // never touch mutations (server actions, etc.)

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Supabase/3rd-party alone

  // App navigations: always try the network (fresh + auth-aware); show the
  // offline page only when there's genuinely no connection.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) =>
            cached ||
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            }),
        ),
      ),
    );
    return;
  }

  // Immutable build assets: serve from cache, then fall back to network (and
  // cache the result). Hashed filenames mean this is always safe.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (API routes, /api/receipt, dynamic data) → straight to network.
});
