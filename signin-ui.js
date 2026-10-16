/* The front door's sign-in screens (queuebot repo docs/sign-in.md):
   17 sign-in on a computer, 18 on a phone (Google Identity Services button),
   19 "Which store today?" for people with more than one store,
   20 not set up yet (enforce mode), or "Coming soon" for a role without screens.
   signin.js does the hand-off with the QueueBot page and calls these. */
(function () {
  var body = document.body;
  var env = body.getAttribute("data-env") || "live";
  var role = body.getAttribute("data-role") || "uw";
  var root = body.getAttribute("data-root") || "./";
  var cfg = window.QB_SITE || {};
  var WIDE = window.matchMedia ? window.matchMedia("(min-width: 900px)") : { matches: false };
  var STORE_KEY = "qb_store_" + env;          // today's store: { store, day }
  var HELP = "mailto:eldinc@motorygroup.com?subject=" + encodeURIComponent("QueueBot sign-in");
  var CARS = ["#e6a51a", "#d0312d", "#0e76bc", "#2fae6e", "#8b5cf6"];
  var G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>';
  var WARN = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e6a51a" stroke-width="2" aria-hidden="true"><path d="M12 8v5M12 16h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>';
  var PLAN = { titles: "Titles: title work in QueueBot, planned for January 2027.",
               insurance: "Insurance: the insurance workflow, planned for December 2026 to January 2027.",
               collections: "Collections: account lookup, planned for December 2026 to January 2027." };

  var el = null, screen = "", user = null, gisOn = false;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function logo(cls) { return '<div class="' + cls + '"><img src="' + root + 'icons/motory-logo.png" alt="Motory Group"></div>'; }
  function box() {
    if (!el) { el = document.createElement("div"); el.id = "qb-door"; el.className = "qd"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); body.appendChild(el); }
    return el;
  }
  function paint(name, cls, html) { screen = name; var b = box(); b.className = "qd " + cls; b.innerHTML = html; b.hidden = false; }
  function copy(text, btn, label) {
    var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = label; }, 2000); };
    var fallback = function () {
      var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch (e) {} body.removeChild(t); done();
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  /* ------------------------- 17, 18: sign in -------------------------- */

  function signIn(message) {
    var steps = ["Pick your account in the Google window.", "QueueBot opens your screens: store, underwriting or closing.", "You stay signed in on this device until you sign out."];
    paint("signin", "qd-signin",
      '<div class="qd-in">' +
      '<section class="qd-hero" aria-hidden="true">' +
        '<div class="qd-brand">' + logo("qd-logo qd-cuts") + '<span class="qd-wide">QueueBot</span></div>' +
        '<div><div class="qd-tag qd-wide">Every deal,<br>start to flag.</div><div class="qd-lead">Underwriting, closing and your store\'s deals in one place. Sign in once on each phone or computer.</div></div>' +
        '<div class="qd-track">' + CARS.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + '<span class="road"></span><span class="flag"></span></div>' +
      '</section>' +
      '<section class="qd-side">' + logo("qd-plogo") +
        '<div class="qd-card qd-cut"><div class="qd-cmid">' +
          '<h1 id="qd-title"><span class="w">Sign in</span><span class="n">Sign in to QueueBot</span></h1>' +
          '<p class="qd-lead"><span class="w">Use your Motory Google account, or the Gmail address your manager added for you.</span><span class="n">Your Motory Google account, or the Gmail your manager added for you.</span></p>' +
          '<div class="qd-gbtn" id="qd-gbtn"><button type="button" class="qd-gfake" id="qd-gfake">' + G + 'Sign in with Google</button></div>' +
          '<p class="qd-err" id="qd-err" role="alert">' + esc(message || "") + '</p>' +
          '<ul class="qd-steps">' + steps.map(function (t, i) { return '<li><span>' + (i + 1) + '</span>' + t + '</li>'; }).join("") + '</ul>' +
          '<div class="qd-note">You stay signed in on this phone. Your unsent forms stay saved.</div>' +
        '</div>' +
        '<div class="qd-foot"><span class="qd-new"><span class="w">New here? </span><a href="' + root + 'demo/">Practice on the demo</a></span><a href="' + HELP + '">Need help?</a></div>' +
        '</div>' +
      '</section></div>');
    box().setAttribute("aria-labelledby", "qd-title");
    document.getElementById("qd-gfake").onclick = function () {
      if (gisReady()) { try { google.accounts.id.prompt(); } catch (e) {} }
      else document.getElementById("qd-err").textContent = "Google sign-in has not loaded. Check the connection and reload the page.";
    };
    drawGoogle(!message);
  }

  function gisReady() { return !!(window.google && google.accounts && google.accounts.id); }
  function drawGoogle(prompt) {
    if (screen !== "signin" || !gisReady()) return;
    if (!cfg.clientId) { document.getElementById("qd-err").textContent = "Sign-in is not set up yet (config.js clientId)."; return; }
    if (!gisOn) {
      google.accounts.id.initialize({ client_id: cfg.clientId, callback: gotCredential, auto_select: true, cancel_on_tap_outside: false, itp_support: true });
      gisOn = true;
    }
    var c = document.getElementById("qd-gbtn");
    var w = Math.max(200, Math.min(400, c.clientWidth || 320));
    c.innerHTML = "";
    google.accounts.id.renderButton(c, { type: "standard", theme: "outline", size: "large", text: "signin_with",
      shape: WIDE.matches ? "rectangular" : "pill", logo_alignment: "center", width: w });
    if (prompt) { try { google.accounts.id.prompt(); } catch (e) {} }   // returning people: one tap, or none with auto select
  }
  function gotCredential(resp) {
    if (!resp || !resp.credential) return;
    var err = document.getElementById("qd-err");
    if (err) err.textContent = "Signing you in...";
    window.qbGotGoogleToken(resp.credential);
  }
  // Google's library calls this once it has loaded (the script tag is async).
  var prevLoad = window.onGoogleLibraryLoad;
  window.onGoogleLibraryLoad = function () { if (typeof prevLoad === "function") prevLoad(); drawGoogle(true); };

  /* ---------------------- 19: which store today ----------------------- */

  function storeToday() {
    var raw = "";
    try { raw = localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY) || ""; } catch (e) {}
    try { var v = JSON.parse(raw || "{}"); return v.day === today() ? String(v.store || "") : ""; } catch (e) { return ""; }
  }
  function lastStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY + "_last") || '""'); } catch (e) { return ""; } }
  function rememberStore(store, keep) {
    var v = JSON.stringify({ store: store, day: today() });
    try {
      localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY);
      (keep ? localStorage : sessionStorage).setItem(STORE_KEY, v);
      localStorage.setItem(STORE_KEY + "_last", JSON.stringify(store));
    } catch (e) {}
  }

  function storePick(u) {
    var stores = u.stores || [], last = lastStore(), on = stores.indexOf(last) >= 0 ? last : stores[0];
    var ini = String(u.name || u.email || "").split(/[\s@.]+/).filter(String).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "-";
    paint("pick", "qd-pick",
      '<div class="qd-col" style="padding:40px 20px 28px">' +
      '<div class="qd-me"><span class="qd-ini" aria-hidden="true">' + esc(ini) + '</span><span><b>' + esc(u.name || u.email) + '</b><small>' + esc(u.email) + '</small></span></div>' +
      '<h1 class="qd-h" id="qd-title">Which store today?</h1>' +
      '<div class="qd-sub">You work at ' + stores.length + ' stores. You can switch any time from the top of the app.</div>' +
      '<div class="qd-stores">' + stores.map(function (s) {
        return '<button type="button" class="qd-store' + (s === on ? " on" : "") + '" data-store="' + esc(s) + '"><span class="n"><b>' + esc(s) + '</b><small data-sub></small></span><span class="rk" data-rank></span></button>';
      }).join("") + '</div>' +
      '<label class="qd-remember"><input type="checkbox" id="qd-keep" checked>Remember on this ' + (WIDE.matches ? "computer" : "phone") + '</label>' +
      '</div>');
    box().setAttribute("aria-labelledby", "qd-title");
    [].forEach.call(el.querySelectorAll(".qd-store"), function (b) {
      b.onclick = function () {
        var s = b.getAttribute("data-store");
        rememberStore(s, document.getElementById("qd-keep").checked);
        window.qbSendToApp({ type: "qb-store", store: s });
        hide();
      };
    });
    window.qbSendToApp({ type: "qb-store-info" });
  }
  function dealsLine(x) {
    var p = [];
    if (x.uw) p.push(x.uw + (x.uw === 1 ? " deal" : " deals") + " in UW");
    if (x.closing) p.push(x.closing + (p.length ? "" : x.closing === 1 ? " deal" : " deals") + " in closing");
    return p.length ? p.join(", ") : "No deals in UW or closing";
  }
  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function storeInfo(d) {
    if (screen !== "pick") return;
    (d.stores || []).forEach(function (x) {
      [].forEach.call(el.querySelectorAll(".qd-store"), function (b) {
        if (b.getAttribute("data-store") !== x.store) return;
        b.querySelector("[data-sub]").textContent = dealsLine(x);
        b.querySelector("[data-rank]").textContent = x.rank ? ordinal(x.rank) : "";
      });
    });
  }

  /* ------------------ 20: not set up, or coming soon ------------------ */

  function notSetUp(email, soonRoles) {
    var soon = soonRoles && soonRoles.length;
    var title = soon ? "Coming soon for " + soonRoles.map(cap).join(" and ") : "You're not set up in QueueBot yet";
    var text = soon
      ? 'You signed in as <b>' + esc(email) + '</b>. Your screens in QueueBot are not built yet. You will see them here as soon as they are ready.'
      : 'You signed in as <b>' + esc(email) + '</b>. Ask your manager or Eldin to add this address. It works as soon as they do; just open QueueBot again.';
    paint(soon ? "soon" : "notsetup", "qd-ns",
      '<div class="qd-col">' + logo("qd-plogo") + '<div class="qd-mid">' +
      '<div class="qd-warn">' + WARN + '</div>' +
      '<h1 class="qd-h" id="qd-title">' + esc(title) + '</h1>' +
      '<p>' + text + '</p>' +
      (soon ? '<ul class="qd-plan">' + soonRoles.map(function (r) { return '<li>' + esc(PLAN[r] || cap(r)) + '</li>'; }).join("") + '</ul>' : '') +
      '<div class="qd-box">Signed in with the wrong account? Use the one your manager added, usually your <b>@motorygroup.com</b> address.</div>' +
      '<button type="button" class="qd-gold" id="qd-other">Use a different account</button>' +
      (soon ? '' : '<button type="button" class="qd-ghost" id="qd-copy">Copy my address for my manager</button>') +
      '</div></div>');
    box().setAttribute("aria-labelledby", "qd-title");
    document.getElementById("qd-other").onclick = function () { window.qbForgetSession(); signIn(""); };
    var c = document.getElementById("qd-copy");
    if (c) c.onclick = function () { copy(email, c, "Copy my address for my manager"); };
  }

  /* ------------------------- called by signin.js ----------------------- */

  function hide() { if (el) el.hidden = true; screen = ""; }
  function signedIn(d) {
    var u = d.user || {}, mode = d.mode || "";
    user = u;
    if (mode === "enforce" && !u.active) return notSetUp(u.email);
    var roles = u.roles || [];
    if (mode === "enforce" && !(u.perms || []).length) return notSetUp(u.email, roles.filter(function (r) { return PLAN[r]; }).length ? roles.filter(function (r) { return PLAN[r]; }) : roles);
    // A store-only person who opened the UW page: their screens are the store page.
    if (role === "uw" && u.known && roles.length && roles.every(function (r) { return r === "store"; })) {
      location.replace(root + (env === "test" ? "test/" : "") + "store/");
      return;
    }
    if (role === "store" && u.known && (u.stores || []).length > 1) {
      var t = storeToday();
      if (t && u.stores.indexOf(t) >= 0) { window.qbSendToApp({ type: "qb-store", store: t }); return hide(); }
      return storePick(u);
    }
    hide();
  }
  function failed(d) {
    if (d.reason === "not_set_up") return notSetUp(d.email || "");
    signIn(d.message || "Google did not confirm the sign-in. Try again.");
  }

  window.QB_SIGNIN_UI = {
    show: function () { if (screen !== "signin") signIn(""); },
    hide: hide, signedIn: signedIn, failed: failed, storeInfo: storeInfo, storeToday: storeToday,
    signedOut: function () { try { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY); } catch (e) {} }
  };
})();
