/* Caches only this site's page shell (pages, styles, icons) so it installs and
   opens as an app. The QueueBot web app itself runs inside the frame from
   script.google.com and is never cached: no customer data is stored here. */
var CACHE = "qb-shell-v9";
var SHELL = [
  "./", "index.html", "frame.css", "frame.js", "signin.js", "signin-ui.js", "signin.css", "config.js",
  "uw/", "store/", "sales/", "hub/", "test/uw/", "test/store/", "test/sales/", "test/hub/", "hub/co/", "hub/mx/", "hub/us/", "demo/", "demo/demo.js", "demo/demo.css",
  "uw/manifest.webmanifest", "store/manifest.webmanifest", "sales/manifest.webmanifest", "hub/manifest.webmanifest", "test/uw/manifest.webmanifest", "test/store/manifest.webmanifest", "test/sales/manifest.webmanifest", "test/hub/manifest.webmanifest",
  "hub/co/manifest.webmanifest", "hub/mx/manifest.webmanifest", "hub/us/manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png",
  "icons/favicon-32.png", "icons/motory-logo.png",
  "icons/store-192.png", "icons/store-512.png", "icons/store-apple-180.png", "icons/uw-192.png", "icons/uw-512.png", "icons/uw-apple-180.png", "icons/hub-192.png", "icons/hub-512.png", "icons/hub-apple-180.png", "icons/sales-192.png", "icons/sales-512.png", "icons/sales-apple-180.png",
  "icons/store-test-192.png", "icons/store-test-512.png", "icons/store-test-apple-180.png", "icons/uw-test-192.png", "icons/uw-test-512.png", "icons/uw-test-apple-180.png", "icons/hub-test-192.png", "icons/hub-test-512.png", "icons/hub-test-apple-180.png", "icons/sales-test-192.png", "icons/sales-test-512.png", "icons/sales-test-apple-180.png",
  "icons/hub-co-192.png", "icons/hub-co-512.png", "icons/hub-co-apple-180.png", "icons/hub-mx-192.png", "icons/hub-mx-512.png", "icons/hub-mx-apple-180.png", "icons/hub-us-192.png", "icons/hub-us-512.png", "icons/hub-us-apple-180.png"
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
