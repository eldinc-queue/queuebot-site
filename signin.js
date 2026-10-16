/* Front door side of sign-in (docs/sign-in.md in the queuebot repo).
   Hands a QueueBot session, or a fresh Google ID token, to the QueueBot page in
   the frame, only when that page (an Apps Script sandbox) asks for it.
   The screens (sign-in, store pick, not set up; the demo password and roles)
   are window.QB_SIGNIN_UI, from signin-ui.js or demo/demo.js. */
(function () {
  var SANDBOX = /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/;
  var env = document.body.getAttribute("data-env") || "live";
  var KEY = "qb_session_" + env;
  var app = null;              // { source, origin } of the QueueBot page that said qb-ready
  var queue = [];              // messages for the page before it is ready

  function get() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function set(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }
  function send(msg) { if (app) app.source.postMessage(msg, app.origin); }
  function ui(name, arg) { var u = window.QB_SIGNIN_UI; if (u && typeof u[name] === "function") return u[name](arg); }

  window.addEventListener("message", function (ev) {
    if (!SANDBOX.test(ev.origin) || !ev.data || typeof ev.data !== "object") return;
    var f = document.getElementById("qb-app");
    if (!f || !isInside(ev.source, f.contentWindow)) return;
    var d = ev.data;
    if (d.type === "qb-ready") {
      app = { source: ev.source, origin: ev.origin };
      if (queue.length) { var q = queue; queue = []; q.forEach(send); }
      else if (get()) send({ type: "qb-session", session: get(), store: ui("storeToday") || "" });
      else show();
    } else if (d.type === "qb-signed-in" && /^[0-9a-f]{64}$/.test(String(d.session || ""))) {
      set(d.session);
      if (window.QB_SIGNIN_UI && window.QB_SIGNIN_UI.signedIn) ui("signedIn", d); else hide();
    } else if (d.type === "qb-need-signin") {
      set(""); show();
    } else if (d.type === "qb-signout") {
      set(""); try { google.accounts.id.disableAutoSelect(); } catch (e) {} ui("signedOut"); show();
    } else if (d.type === "qb-signin-failed") {
      ui("failed", d);
    } else if (d.type === "qb-store-info") {
      ui("storeInfo", d);
    }
  });
  // The QueueBot page is the frame inside Apps Script's frame inside ours.
  function isInside(w, top) { try { for (var i = 0; i < 3 && w; i++) { if (w === top) return true; w = w.parent; } } catch (e) {} return false; }

  /** Sends a message to the QueueBot page (kept until it says qb-ready). */
  window.qbSendToApp = function (msg) { if (app) send(msg); else queue.push(msg); };
  /** Called by the sign-in screen with the Google credential. */
  window.qbGotGoogleToken = function (idToken) { window.qbSendToApp({ type: "qb-idtoken", idToken: idToken }); };
  /** Forgets the session here and tells the page (sign out, use a different account). */
  window.qbForgetSession = function () {
    set(""); window.qbSendToApp({ type: "qb-signout" });
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
  };
  window.qbHasSession = function () { return !!get(); };
  function show() { if (document.getElementById("qb-app")) ui("show"); }   // offline or no link: frame.js says so instead
  function hide() { ui("hide"); }
  // No session on this device: the sign-in screen shows at once, while the app loads behind it.
  if (!get()) show();
})();
