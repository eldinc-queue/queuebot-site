/* Front door side of push alerts (docs/notifications.md in the queuebot repo).
   The QueueBot page runs inside this page's frame (an Apps Script sandbox) and
   cannot ask for notification permission or hold a push token itself. It asks
   here by postMessage:
     qb-push-status  -> qb-push-state { supported, configured, permission, ios, standalone, label, token }
     qb-push-enable  -> qb-push-token { token, label }  or  qb-push-error { reason }
   This page asks for permission (with a tap on its own bar, which iPhone and
   Safari need), gets the Firebase Cloud Messaging token and hands it back. The
   QueueBot page saves it on the server with the signed-in person.
   Firebase settings come from config.js (QB_SITE.firebase). Empty: push stays
   off and QueueBot's inbox and pop-ups still work. */
(function () {
  var SANDBOX = /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/;
  var FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  var root = document.body.getAttribute("data-root") || "./";
  var cfg = (window.QB_SITE || {}).firebase || {};
  var configured = !!(cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId && cfg.vapidKey);
  var ua = navigator.userAgent || "";
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var standalone = !!((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone);
  var app = null;        // { source, origin } of the QueueBot page
  var loads = {}, bar = null;

  function supported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function permission() { return "Notification" in window ? Notification.permission : "unsupported"; }
  function label() {
    var dev = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || (ios && !/iPhone/.test(ua)) ? "iPad" : /Android/.test(ua) ? "Android phone" : "This computer";
    var br = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "browser";
    return dev + ", " + (standalone ? "installed app" : br);
  }
  function send(m) { if (app) app.source.postMessage(m, app.origin); }
  function fail(reason) { send({ type: "qb-push-error", reason: reason }); }
  function state(token) {
    send({ type: "qb-push-state", supported: supported(), configured: configured, permission: permission(), ios: ios, standalone: standalone,
           label: label(), token: token || "" });
  }
  // The QueueBot page is the frame inside Apps Script's frame inside ours.
  function isInside(w, top) { try { for (var i = 0; i < 3 && w; i++) { if (w === top) return true; w = w.parent; } } catch (e) {} return false; }

  window.addEventListener("message", function (ev) {
    if (!SANDBOX.test(ev.origin) || !ev.data || typeof ev.data !== "object") return;
    var f = document.getElementById("qb-app");
    if (!f || !isInside(ev.source, f.contentWindow)) return;
    var d = ev.data;
    if (d.type === "qb-ready" || d.type === "qb-push-status" || d.type === "qb-push-enable") app = { source: ev.source, origin: ev.origin };
    if (d.type === "qb-push-status") status();
    else if (d.type === "qb-push-enable") enable();
  });

  function status() {
    if (supported() && configured && permission() === "granted") token().then(state, function () { state(""); });
    else state("");
  }
  function enable() {
    if (!configured) return fail("not_configured");
    if (!supported()) return fail(ios && !standalone ? "ios_install" : "unsupported");
    if (permission() === "denied") return fail("denied");
    if (permission() === "granted") return deliver();
    showBar();       // the permission prompt needs a tap on this page
  }
  function ask() {
    hideBar();
    var done = false;
    function then(p) {
      if (done) return; done = true;
      if (p === "granted") deliver(); else fail(p === "denied" ? "denied" : "dismissed");
    }
    try {
      var r = Notification.requestPermission(then);   // older Safari uses the callback
      if (r && r.then) r.then(then, function () { then("default"); });
    } catch (e) { then("default"); }
  }
  function deliver() {
    token().then(function (t) {
      if (t) send({ type: "qb-push-token", token: t, label: label() }); else fail("error");
    }, function () { fail("error"); });
  }

  function load(src) {
    if (!loads[src]) loads[src] = new Promise(function (ok, no) {
      var s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = no;
      document.head.appendChild(s);
    });
    return loads[src];
  }
  /** The Firebase token for this device (the same one while permission and the worker stay). */
  function token() {
    return load(FB + "firebase-app-compat.js").then(function () { return load(FB + "firebase-messaging-compat.js"); }).then(function () {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.projectId + ".firebaseapp.com", projectId: cfg.projectId,
                                        messagingSenderId: cfg.messagingSenderId, appId: cfg.appId });
      }
      // Its own scope, so it never takes over from the shell worker (sw.js).
      return navigator.serviceWorker.register(root + "firebase-messaging-sw.js", { scope: root + "push/" });
    }).then(function (reg) {
      return window.firebase.messaging().getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
    });
  }

  function showBar() {
    if (bar) return;
    bar = document.createElement("div");
    bar.id = "qb-push-bar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Turn on alerts");
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;" +
      "padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:#001a33;border-top:3px solid #e6a51a;color:#e8eef5;" +
      "font:15px/1.4 'Open Sans',Arial,sans-serif;box-shadow:0 -12px 30px rgba(0,0,0,.45)";
    bar.innerHTML = '<span style="flex:1 1 220px">Allow QueueBot alerts on this device?</span>' +
      '<button type="button" data-go style="height:44px;padding:0 18px;border:0;background:#e6a51a;color:#001a33;font-weight:800;font-size:15px;cursor:pointer">Turn on alerts</button>' +
      '<button type="button" data-no style="height:44px;padding:0 10px;border:0;background:none;color:#8ea3bb;font-weight:700;font-size:15px;cursor:pointer">Not now</button>';
    bar.querySelector("[data-go]").onclick = ask;
    bar.querySelector("[data-no]").onclick = function () { hideBar(); fail("dismissed"); };
    document.body.appendChild(bar);
    bar.querySelector("[data-go]").focus();
  }
  function hideBar() { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); bar = null; }
})();
