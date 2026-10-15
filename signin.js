/* Front door side of sign-in (docs/sign-in.md in the queuebot repo).
   Hands a QueueBot session, or a fresh Google ID token, to the QueueBot page in
   the frame, only when that page (an Apps Script sandbox) asks for it.
   The sign-in screen itself (#qb-signin) is added once its mockup is approved;
   until then this file only relays a session the person already has. */
(function () {
  var SANDBOX = /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/;
  var env = document.body.getAttribute("data-env") || "live";
  var KEY = "qb_session_" + env;
  var app = null;              // { source, origin } of the QueueBot page that said qb-ready
  var pendingToken = "";

  function get() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function set(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }
  function send(msg) { if (app) app.source.postMessage(msg, app.origin); }

  window.addEventListener("message", function (ev) {
    if (!SANDBOX.test(ev.origin) || !ev.data || typeof ev.data !== "object") return;
    var f = document.getElementById("qb-app");
    if (!f || !isInside(ev.source, f.contentWindow)) return;
    var d = ev.data;
    if (d.type === "qb-ready") {
      app = { source: ev.source, origin: ev.origin };
      if (pendingToken) { send({ type: "qb-idtoken", idToken: pendingToken }); pendingToken = ""; }
      else if (get()) send({ type: "qb-session", session: get() });
      else show();
    } else if (d.type === "qb-signed-in" && /^[0-9a-f]{64}$/.test(String(d.session || ""))) {
      set(d.session); hide();
    } else if (d.type === "qb-need-signin") {
      set(""); show();
    } else if (d.type === "qb-signout") {
      set(""); try { google.accounts.id.disableAutoSelect(); } catch (e) {} show();
    } else if (d.type === "qb-signin-failed") {
      if (window.QB_SIGNIN_UI) window.QB_SIGNIN_UI.failed(d);
    }
  });
  // The QueueBot page is the frame inside Apps Script's frame inside ours.
  function isInside(w, top) { try { for (var i = 0; i < 3 && w; i++) { if (w === top) return true; w = w.parent; } } catch (e) {} return false; }

  /** Called by the sign-in screen with the Google credential. */
  window.qbGotGoogleToken = function (idToken) {
    if (app) send({ type: "qb-idtoken", idToken: idToken }); else pendingToken = idToken;
  };
  function show() { if (window.QB_SIGNIN_UI) window.QB_SIGNIN_UI.show(); }
  function hide() { if (window.QB_SIGNIN_UI) window.QB_SIGNIN_UI.hide(); }
})();
