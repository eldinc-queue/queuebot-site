/* PREVIEW copy (scope /preview/ only; the live front door has its own sw.js at the root).
   Caches only this site's page shell (pages, styles, icons) so it installs and
   opens as an app. The QueueBot web app itself runs inside the frame from
   script.google.com and is never cached: no customer data is stored here. */
var CACHE = "qb-preview-v5";
var SHELL = [
  "./", "frame.css", "frame.js", "signin.js", "signin-ui.js", "signin.css", "config.js", "push.js",
  "test/uw/", "test/store/", "test/sales/", "test/hub/", "demo/", "demo/demo.js", "demo/demo.css",
  "test/uw/manifest.webmanifest", "test/store/manifest.webmanifest", "test/sales/manifest.webmanifest", "test/hub/manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png",
  "icons/favicon-32.png", "icons/motory-logo.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Same-origin GETs only. Network first so a change to the site shows at once;
// the cached copy is the fallback when offline.
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true });
  }));
});
