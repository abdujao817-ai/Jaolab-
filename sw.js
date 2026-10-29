// Jao Lab service worker: online first, saved copies when offline
const CACHE = "jaolab-v1";
const SHELL = [
  "index.html", "categories.html", "wishlist.html", "you.html", "cart.html",
  "css/style.css", "js/data.js", "js/app.js", "icons/icon-192.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE;
      }).map(function (k) {
        return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  const url = new URL(req.url);

  // Only this site's own files. Never the database, and never admin pages.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("admin") !== -1) return;

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(req, copy);
        });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || new Response("You are offline. Please reconnect and try again.", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      });
    })
  );
});