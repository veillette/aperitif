// Offline support. The deploy workflow replaces VERSION with the commit hash,
// so each deploy installs a fresh cache and drops the old one.
const VERSION = "dev";
const CACHE = `aperitif-${VERSION}`;
const CORE = [
  "./", "index.html", "recipe.html", "manifest.webmanifest", "icons/icon.svg",
  "css/style.css", "js/app.js", "js/recipe.js", "js/data.js", "js/units.js", "js/dom.js",
  "data/cocktails.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
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
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(new URL(request.url).pathname, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached ?? fresh;
    }),
  );
});
