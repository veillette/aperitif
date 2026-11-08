// Offline support. The deploy workflow replaces VERSION with the commit hash,
// so each deploy installs a fresh cache and drops the old one.
const VERSION = "dev";
const CACHE = `aperitif-${VERSION}`;
const CORE = [
  "./", "index.html", "recipe.html", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png",
  "css/style.css", "js/app.js", "js/recipe.js", "js/data.js", "js/units.js", "js/dom.js", "js/navigation.js", "js/preferences.js", "js/cards.js",
  "data/cocktails.json",
];

self.addEventListener("install", (event) => {
  // Bypass the HTTP cache so a new deploy never stores the previous deploy's files.
  const requests = CORE.map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("aperitif-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate. Query strings are ignored so recipe.html?c=… hits the cached page.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  const cache = caches.open(CACHE);
  const fresh = fetch(request);
  // Keep the worker alive until the refreshed copy is stored, even when the cached one is served.
  event.waitUntil(fresh.then(async (res) => {
    if (!res.ok) return;
    const copy = res.clone();
    await (await cache).put(new URL(request.url).pathname, copy);
  }).catch(() => {}));
  event.respondWith(cache.then((c) => c.match(request, { ignoreSearch: true })).then((cached) => cached ?? fresh));
});
