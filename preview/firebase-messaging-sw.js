/* Push alerts for QueueBot (Firebase Cloud Messaging). push.js registers this
   worker with its own scope (push/), next to the shell worker sw.js. It shows
   the alerts QueueBot sends (title and text only, never customer details beyond
   a first name and App #) and opens QueueBot when one is tapped. It caches
   nothing. Firebase settings come from config.js; empty means push is off. */
self.window = self;   // config.js sets window.QB_SITE
try { importScripts("config.js"); } catch (e) {}
var QB_FB = (self.QB_SITE || {}).firebase || {};

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

if (QB_FB.apiKey && QB_FB.projectId && QB_FB.messagingSenderId && QB_FB.appId) {
  importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
  firebase.initializeApp({ apiKey: QB_FB.apiKey, authDomain: QB_FB.projectId + ".firebaseapp.com", projectId: QB_FB.projectId,
                           messagingSenderId: QB_FB.messagingSenderId, appId: QB_FB.appId });
  // QueueBot sends notification messages with webpush.fcm_options.link: Firebase
  // shows them and opens the link on a tap.
  firebase.messaging();
}
