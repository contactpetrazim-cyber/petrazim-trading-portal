// Petrazim Trading Portal — offline app shell.
//
// Scope: "offline access to already-loaded pages" (Settings ->
// Backup and Offline), by direct request, adapted from the reference
// site's own "Install & Offline" panel. Caches the app shell (the SPA
// bundle, manifest, icons) so the site still loads and its client-side
// router still works with no connection, once you've visited it while
// online at least once. Deliberately does NOT cache API responses —
// every page's own data (trades, curriculum, insights, the coach...)
// still needs the network, same distinction the reference draws
// ("Listen, Recap and the Coach need the network"). Cross-origin
// requests (the backend API lives on its own origin, VITE_API_URL)
// are never intercepted here at all.
const CACHE_NAME = 'petrazim-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API calls: never touched, always live

  if (request.mode === 'navigate') {
    // Network-first for page loads/route changes — always the freshest
    // shell when online, falling back to the cached one when offline
    // (the SPA's own router then takes over client-side).
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static assets — Vite content-hashes build output
  // filenames, so a cached copy is never stale for a given URL.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
