/* The front door's sign-in screens (queuebot repo docs/sign-in.md):
   17 sign-in on a computer, 18 on a phone (Google Identity Services button), both with
   the truck on its track (round 11, boards 152 to 155),
   19 "Which store today?" for people with more than one store,
   20 not set up yet (enforce mode), or "Coming soon" for a role without screens.
   Round 13: inside an app's own browser (WhatsApp, Facebook, ...) "Open in Chrome to sign in" instead of
   Google's button (Google refuses sign-in there), the same help under the button when Google's script does not
   load or draw its button within 8 seconds, and "Continue without signing in" under the card in audit mode.
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
  var G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>';
  var WARN = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e6a51a" stroke-width="2" aria-hidden="true"><path d="M12 8v5M12 16h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>';
  var PLAN = { titles: "Titles: title work in QueueBot, planned for January 2027.",
               insurance: "Insurance: the insurance workflow, planned for December 2026 to January 2027.",
               collections: "Collections: account lookup, planned for December 2026 to January 2027." };

  /* The sign-in truck (round 11, boards 152 to 155, queuebot repo docs/design/mockups/round11): an original
     full-size crew-cab pickup, Motory blue to navy, with the round MG badge on the front door and no other
     badge. Inline SVG facing the way it drives; signin.css moves it (transform and opacity only, no script,
     nothing fetched). "@" in the drawing is the copy's id prefix, so the gradient ids are unique per copy. */
  var TRUCK = (
    '<defs><linearGradient id="@-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a9be0"/><stop offset=".32" stop-color="#1683cc"/>' +
    '<stop offset=".55" stop-color="#0e76bc"/><stop offset=".56" stop-color="#0b63a3"/><stop offset=".85" stop-color="#004781"/>' +
    '<stop offset="1" stop-color="#003463"/></linearGradient><linearGradient id="@-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cb2ef"/>' +
    '<stop offset="1" stop-color="#1683cc"/></linearGradient><linearGradient id="@-glass" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#3d5873"/><stop offset=".45" stop-color="#1b2a3b"/><stop offset="1" stop-color="#0d1622"/></linearGradient>' +
    '<linearGradient id="@-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset=".5" stop-color="#b9c4d0"/>' +
    '<stop offset="1" stop-color="#7d8a99"/></linearGradient><linearGradient id="@-rimd" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#a7b3c1"/><stop offset="1" stop-color="#5b6776"/></linearGradient>' +
    '<linearGradient id="@-trim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a535f"/><stop offset="1" stop-color="#1c2129"/>' +
    '</linearGradient><linearGradient id="@-led" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bfe6ff" stop-opacity=".2"/>' +
    '<stop offset=".4" stop-color="#eaf7ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>' +
    '<ellipse cx="152" cy="105" rx="146" ry="4.5" fill="#000000" opacity=".3"/>' +
    '<path d="M6 44 L99 44 L99 88 L85.35 88 A28.5 28.5 0 1 0 30.65 88 L8 88 Q5 88 5 85 Z" fill="url(#@-body)"/>' +
    '<path d="M5 41 H100 V45 H5 Z" fill="url(#@-trim)"/><path d="M14 41 V39.2 H92 V41" fill="none" stroke="#2a313b" stroke-width="1.2"/>' +
    '<path d="M10 45 V86" stroke="#06325c" stroke-width=".8" opacity=".8"/><path d="M4.5 46 H9 V64 H4.5 Z" fill="#c4262e"/>' +
    '<path d="M5.2 47 H8.2 V53 H5.2 Z" fill="#ff6b6b" opacity=".75"/><path d="M2 81 H20 V89.5 Q20 91.5 18 91.5 H4 Q2 91.5 2 89.5 Z" fill="url(#@-trim)"/>' +
    '<path d="M100 88 L100 15 Q100 9 106 9 L177 9 Q183 9 186.5 13 L207 39 L284 41.6 Q294.5 42 295.8 47 L296.8 84 Q296.8 88 292.8 88 L267.35 88 A28.5 28.5 0 1 0 212.65 88 Z" fill="url(#@-body)"/>' +
    '<path d="M100 15 Q100 9 106 9 L177 9 Q183 9 186.5 13 L189 16 L100 16 Z" fill="url(#@-top)"/>' +
    '<path d="M207 39 L284 41.6 Q292 41.9 294.3 44.5 L208 42 Z" fill="#5cb2ef" opacity=".75"/><path d="M99.5 41 V88" stroke="#04213f" stroke-width="1.2"/>' +
    '<path d="M105 14.5 L176 14.5 Q180 14.5 182.5 17.5 L201 40.5 L105 40.5 Z" fill="#11161d"/>' +
    '<path d="M108 17 L150 17 L150 38.5 L108 38.5 Z" fill="url(#@-glass)"/>' +
    '<path d="M157 17 L176 17 Q178.5 17 180 19 L196.5 38.5 L157 38.5 Z" fill="url(#@-glass)"/>' +
    '<path d="M112 17 L104 38.5 M161 17 L153 38.5" stroke="#ffffff" stroke-width="3" opacity=".09"/>' +
    '<path d="M118 17 L113 30 M168 17 L163 30" stroke="#ffffff" stroke-width="1.2" opacity=".14"/>' +
    '<path d="M186.5 13 L207 39" stroke="#1b2a3b" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M186 12.4 L206.6 38.6" stroke="#9cc9ec" stroke-width=".6" opacity=".6"/>' +
    '<path d="M6 50.2 L292 52.6" stroke="#7cc3f4" stroke-width=".9" opacity=".75"/>' +
    '<path d="M6 51.4 L292 53.8" stroke="#003a6e" stroke-width=".9" opacity=".7"/>' +
    '<path d="M14 56.2 L99 57 M100.5 57 L208 58 M272 58.6 L291 58.8" stroke="#e6a51a" stroke-width="1.15"/>' +
    '<path d="M104 40.5 V84 Q104 86.5 106.5 86.5 H151.5 Q153.5 86.5 153.5 84.5 V40.5 M153.5 40.5 V84.5 M211.5 41 L211.5 56 Q211.5 63 209 70 L206 86.5 H156" fill="none" stroke="#06325c" stroke-width=".8"/>' +
    '<path d="M104.8 40.5 V84 M154.3 40.5 V84.5" stroke="#5cb2ef" stroke-width=".4" opacity=".5"/>' +
    '<path d="M139 46.4 H148 Q149.5 46.4 149.5 47.9 Q149.5 49.4 148 49.4 H139 Q137.5 49.4 137.5 47.9 Q137.5 46.4 139 46.4 Z" fill="url(#@-trim)"/>' +
    '<path d="M195 46.6 H204 Q205.5 46.6 205.5 48.1 Q205.5 49.6 204 49.6 H195 Q193.5 49.6 193.5 48.1 Q193.5 46.6 195 46.6 Z" fill="url(#@-trim)"/>' +
    '<path d="M197 33.5 Q197 29.5 201 29.5 L212 29.5 Q215 29.5 214.6 32.5 L213.6 39.5 Q213.3 41.5 211 41.5 L199.5 41.5 Q197 41.5 197 39 Z" fill="url(#@-trim)"/>' +
    '<path d="M199 31.4 H212" stroke="#6a7584" stroke-width=".7"/><path d="M203 41.5 L205.5 44.5 H209.5 L208 41.5" fill="#1c2129"/>' +
    '<circle cx="182" cy="69" r="9.6" fill="#004781" stroke="#e6a51a" stroke-width="1.7"/>' +
    '<circle cx="182" cy="69" r="7.6" fill="none" stroke="#ffffff" stroke-width=".35" opacity=".35"/>' +
    '<text x="182" y="72.5" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-size="9.4" font-weight="900" fill="#e6a51a" letter-spacing=".2">MG</text>' +
    '<path d="M262 61 H276 L274 64 H262 Z" fill="url(#@-trim)"/><path d="M291 53.5 L297.2 53.5 L298 76.5 L291.6 76.5 Z" fill="#141920"/>' +
    '<path d="M291 53.5 L291.6 76.5" stroke="#7cc3f4" stroke-width=".6" opacity=".6"/>' +
    '<path d="M292.2 56.5 L297.4 56.5" stroke="#8a96a5" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M292.2 60.6 L297.4 60.6" stroke="#8a96a5" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M292.2 64.7 L297.4 64.7" stroke="#8a96a5" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M292.2 68.8 L297.4 68.8" stroke="#8a96a5" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M292.2 72.9 L297.4 72.9" stroke="#8a96a5" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M264 44.6 L292.5 45.7 Q296 46 296.3 49 L296.5 52.6 L268 51.6 Q264 51.4 264 48.6 Z" fill="#141920"/>' +
    '<path d="M266.5 47.3 L295.8 48.3" stroke="url(#@-led)" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="288" cy="50.3" r="1.5" fill="#dff2ff" opacity=".9"/><circle cx="282" cy="50.1" r="1.5" fill="#dff2ff" opacity=".9"/>' +
    '<path d="M293.3 50.2 L296.4 50.4 L296.5 52.6 L293.4 52.5 Z" fill="#f2a33a"/>' +
    '<path d="M283 76.5 L298.5 76.5 Q300 76.5 300 78 L300 89.5 Q300 92 297.5 92 L277 92 Q274 92 274.5 89 L276 81 Q276.8 76.5 283 76.5 Z" fill="url(#@-trim)"/>' +
    '<path d="M279 84.5 H299" stroke="#8a96a5" stroke-width="1.1"/><path d="M287 89.2 H299.4" stroke="#b9c4d0" stroke-width="1.4" opacity=".8"/>' +
    '<path d="M104 90.6 H208 Q210 90.6 210 92.2 Q210 93.8 208 93.8 H104 Q102 93.8 102 92.2 Q102 90.6 104 90.6 Z" fill="url(#@-trim)"/>' +
    '<path d="M106 91.2 H206" stroke="#7d8a99" stroke-width=".5"/>' +
    '<path d="M28.05 88 A31 31 0 1 1 87.95 88 M210.05 88 A31 31 0 1 1 269.95 88" fill="none" stroke="#1c2129" stroke-width="5.4"/>' +
    '<path d="M25.65 86 A32.9 32.9 0 1 1 90.35 86 M207.65 86 A32.9 32.9 0 1 1 272.35 86" fill="none" stroke="#4a535f" stroke-width=".6"/>' +
    '<path d="M30.54 88 A28.6 28.6 0 1 1 85.46 88 Z M212.54 88 A28.6 28.6 0 1 1 267.46 88 Z" fill="#0a0e13"/>');
  function wheel(x, u) {
    var s = '<g transform="translate(' + x + ' 80)"><g class="qd-trk-wheel"><circle r="24" fill="#191e25"/>', a;
    for (a = 0; a < 360; a += 15) s += '<path d="M-1.2 -24 L1.2 -24 L0.9 -21.6 L-0.9 -21.6 Z" transform="rotate(' + a + ')" fill="#07090c"/>';
    s += '<circle r="21.2" fill="none" stroke="#2c343f" stroke-width="1.1"/><circle r="18.8" fill="#0f1318"/><circle r="17.3" fill="url(#@-rimd)"/><circle r="16.2" fill="#1a1f26"/>';
    for (a = 0; a < 360; a += 60) s += '<path d="M-1.7 -5 L-2.9 -15.6 L2.9 -15.6 L1.7 -5 Z" transform="rotate(' + a + ')" fill="url(#@-rim)"/>';
    for (a = 0; a < 360; a += 60) s += '<path d="M0 -5.4 L0 -15.8" transform="rotate(' + a + ')" stroke="#2a313b" stroke-width=".9"/>';
    s += '<circle r="5.2" fill="url(#@-rim)"/><circle r="5.2" fill="none" stroke="#2a313b" stroke-width=".6"/>';
    for (a = 30; a < 360; a += 60) s += '<circle cx="0" cy="-3.1" r=".55" transform="rotate(' + a + ')" fill="#2a313b"/>';
    return s + '<circle r="1.9" fill="#004781"/><circle r="17.3" fill="none" stroke="#e8edf3" stroke-width=".5" opacity=".7"/></g></g>';
  }
  /* In-app browsers (round 13). Google blocks its sign-in page inside apps' own browsers (embedded webviews:
     "disallowed_useragent"), so these get "Open in Chrome (or Safari) to sign in". Detection is by user agent.
     To add an app: one row, [name people know, test on navigator.userAgent]. The last row is any other Android
     app's browser (Android WebView marks itself "; wv)"). On iPhone and iPad, any app's browser that is not
     Safari, Chrome, Firefox or Edge also counts: Apple's WebKit without the "Safari/" word, except the installed
     QueueBot app (home screen, standalone), which has no "Safari/" either and signs in fine.
     When unsure, Google's normal button shows: a real browser is never blocked. */
  var IN_APP = [
    ["WhatsApp", /WhatsApp/i],
    ["Messenger", /\bMessenger\b|MessengerForiOS|MessengerLite|Orca-Android/i],
    ["Facebook", /FBAN|FBAV|FB_IAB|FBIOS|FB4A/],
    ["Instagram", /Instagram/i],
    ["Gmail", /\bGmail\b/i],
    ["LinkedIn", /LinkedInApp/i],
    ["LINE", /\bLine\/\d/],
    ["Snapchat", /Snapchat/i],
    ["TikTok", /musical_ly|BytedanceWebview|\bTikTok\b/i],
    ["X", /\bTwitter(Android)?\b/i],
    ["WeChat", /MicroMessenger/i],
    ["", /; wv\)/]
  ];
  /** { app, os: "android" | "ios" | "" } inside an app's own browser, otherwise null. */
  function inAppBrowser(ua, standalone) {
    ua = String(ua || "");
    var os = /Android/.test(ua) ? "android" : /iPhone|iPad|iPod/.test(ua) ? "ios" : "";
    for (var i = 0; i < IN_APP.length; i++) if (IN_APP[i][1].test(ua)) return { app: IN_APP[i][0], os: os };
    if (os === "ios" && /AppleWebKit/.test(ua) && !/Safari\//.test(ua) && !standalone) return { app: "", os: os };
    return null;
  }
  function standaloneApp() {
    try { return navigator.standalone === true || !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches); } catch (e) { return false; }
  }
  var IN = inAppBrowser(navigator.userAgent, standaloneApp());
  var ANDROID = /Android/.test(navigator.userAgent);
  var GIS_WAIT_MS = Number(window.QB_GIS_WAIT_MS) || 8000;   // the safety net under Google's button
  var DOTS_V = '<svg class="qd-dots" width="6" height="16" viewBox="0 0 6 16" aria-hidden="true"><circle cx="3" cy="2.5" r="1.8"/><circle cx="3" cy="8" r="1.8"/><circle cx="3" cy="13.5" r="1.8"/></svg>';
  var DOTS_H = '<svg class="qd-dots" width="16" height="6" viewBox="0 0 16 6" aria-hidden="true"><circle cx="2.5" cy="3" r="1.8"/><circle cx="8" cy="3" r="1.8"/><circle cx="13.5" cy="3" r="1.8"/></svg>';
  function intentUrl() { return "intent://" + location.host + location.pathname + location.search + "#Intent;scheme=https;package=com.android.chrome;end"; }

  var trucks = 0;
  function truckSvg(w) {
    var u = "qdtk" + (++trucks);
    return ('<svg class="qd-trk-svg" width="' + w + '" height="' + Math.round(w * 112 / 300) + '" viewBox="0 0 300 112" aria-hidden="true" focusable="false">' +
      TRUCK + wheel(58) + wheel(240) + '</svg>').replace(/@-/g, u + "-");
  }
  // The track: road, checkered line, waving flag and the truck. Fixed height (signin.css), so nothing moves around it.
  function track(small) {
    return '<div class="qd-trk' + (small ? ' qd-trk-sm' : '') + '" aria-hidden="true"><div class="qd-trk-road"></div><div class="qd-trk-line"></div>' +
      '<div class="qd-trk-flag"><i></i><b></b></div><div class="qd-trk-run"><div class="qd-trk-truck"><div class="qd-trk-speed"><i></i><i></i><i></i></div>' +
      truckSvg(small ? 152 : 220) + '</div></div></div>';
  }

  var el = null, screen = "", user = null, gisOn = false, mode = "", gisFailed = false, altTimer = null;

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
        track(false) +
      '</section>' +
      '<section class="qd-side">' + logo("qd-plogo") + '<div class="qd-ptrk" aria-hidden="true">' + track(true) + '</div>' +
        '<div class="qd-card qd-cut' + (IN ? ' qd-inapp' : '') + '"><div class="qd-cmid">' +
          (IN ? inAppCard() :
          '<h1 id="qd-title"><span class="w">Sign in</span><span class="n">Sign in to QueueBot</span></h1>' +
          '<p class="qd-lead"><span class="w">Use your Motory Google account, or the Gmail address your manager added for you.</span><span class="n">Your Motory Google account, or the Gmail your manager added for you.</span></p>' +
          '<div class="qd-gbtn" id="qd-gbtn"><button type="button" class="qd-gfake" id="qd-gfake">' + G + 'Sign in with Google</button></div>' +
          '<p class="qd-err" id="qd-err" role="alert">' + esc(message || "") + '</p>' +
          '<div class="qd-alt" id="qd-alt" hidden></div>' +
          '<ul class="qd-steps">' + steps.map(function (t, i) { return '<li><span>' + (i + 1) + '</span>' + t + '</li>'; }).join("") + '</ul>' +
          '<div class="qd-note">You stay signed in on this phone. Your unsent forms stay saved.</div>') +
        '</div>' +
        '<div class="qd-foot"><span class="qd-new"><span class="w">New here? </span><a href="' + root + 'demo/">Practice on the demo</a></span><a href="' + HELP + '">Need help?</a></div>' +
        '</div>' +
        '<div class="qd-skipw" id="qd-skipw" hidden><button type="button" class="qd-skip" id="qd-skip">Continue without signing in</button></div>' +
      '</section></div>');
    box().setAttribute("aria-labelledby", "qd-title");
    document.getElementById("qd-skip").onclick = function () { if (typeof window.qbSkipSignIn === "function") window.qbSkipSignIn(); };
    showSkip();
    clearTimeout(altTimer);
    if (IN) return wireOpenHelp(el);
    document.getElementById("qd-gfake").onclick = function () {
      if (gisReady()) { try { google.accounts.id.prompt(); } catch (e) {} }
      else document.getElementById("qd-err").textContent = "Google sign-in has not loaded. Check the connection and reload the page.";
    };
    drawGoogle(!message);
    if (gisFailed) showAlt();
    else altTimer = setTimeout(function () { if (screen === "signin" && !googleDrawn()) showAlt(); }, GIS_WAIT_MS);
  }

  /* Round 13: inside an app's own browser. Same card, Google's button replaced by how to open the page in
     Chrome (Android) or Safari (iPhone), "Copy link", and on Android "Open in Chrome" (an intent:// link). */
  function browserName() { return IN && IN.os === "ios" ? "Safari" : IN && IN.os === "android" ? "Chrome" : "Chrome (or Safari)"; }
  function howTo() {
    var ios = IN ? IN.os === "ios" : !ANDROID && /iPhone|iPad|iPod/.test(navigator.userAgent);
    var menu = ios ? '<b class="qd-menu">' + DOTS_H + '</b> menu (or the share button)' : '<b class="qd-menu">' + (ANDROID ? DOTS_V : DOTS_H) + '</b> menu, top right';
    var open = ios ? '<b>Open in Safari</b> or <b>Open in browser</b>' : ANDROID ? '<b>Open in Chrome</b> or <b>Open in browser</b>' : '<b>Open in browser</b>, <b>Open in Chrome</b> or <b>Open in Safari</b>';
    return '<ol class="qd-how"><li><span>1</span><span>Tap the ' + menu + '</span></li><li><span>2</span><span>Tap ' + open + '</span></li>' +
      '<li><span>3</span><span>Sign in with Google there</span></li></ol>';
  }
  function openButtons(small) {
    return '<div class="qd-open' + (small ? ' qd-open-sm' : '') + '">' +
      (ANDROID ? '<a class="qd-gold" id="qd-chrome" href="' + esc(intentUrl()) + '">Open in Chrome</a>' : '') +
      '<button type="button" class="' + (ANDROID ? 'qd-ghost' : 'qd-gold') + '" id="qd-copylink">Copy link</button></div>';
  }
  function inAppCard() {
    var where = IN.app ? esc(IN.app) + "'s browser" : "this app's browser";
    return '<h1 id="qd-title">Open in ' + browserName() + ' to sign in</h1>' +
      '<p class="qd-lead">Google does not allow signing in inside ' + where + '. Open this page in ' + browserName() + ', then sign in there.</p>' +
      openButtons(false) + howTo() +
      '<p class="qd-hint">' + (ANDROID ? 'Or copy the link and paste it in Chrome.' : 'Or copy the link and paste it in ' + (IN.os === "ios" ? 'Safari' : 'your browser') + '.') + '</p>';
  }
  function wireOpenHelp(scope) {
    var c = scope.querySelector("#qd-copylink");
    if (c) c.onclick = function () { copy(location.href, c, "Copy link"); };
  }
  // The safety net: Google's script did not load, or its button is not there after GIS_WAIT_MS.
  function googleDrawn() { var c = document.getElementById("qd-gbtn"); return gisReady() && !!c && !document.getElementById("qd-gfake") && !!c.firstElementChild; }
  function showAlt() {
    var a = document.getElementById("qd-alt");
    if (!a || !a.hidden) return;
    a.innerHTML = '<p class="qd-alt-h"><b>Sign-in not loading?</b> Open this page in ' + (ANDROID ? 'Chrome' : 'Chrome (or Safari)') + '.</p>' + howTo() + openButtons(true);
    a.hidden = false;
    wireOpenHelp(a);
  }
  window.addEventListener("error", function (ev) {
    var t = ev && ev.target;
    if (t && t.tagName === "SCRIPT" && /accounts\.google\.com\/gsi\//.test(t.src || "")) { gisFailed = true; if (screen === "signin") showAlt(); }
  }, true);
  // "Continue without signing in": only when the QueueBot page said the mode is audit (qb-ready, signin.js).
  function showSkip() { var w = document.getElementById("qd-skipw"); if (w && screen === "signin") w.hidden = mode !== "audit"; }

  function gisReady() { return !!(window.google && google.accounts && google.accounts.id); }
  function drawGoogle(prompt) {
    if (screen !== "signin" || !gisReady() || IN) return;   // in an app's browser Google's button would only fail
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

  // The truck goes with the sign-in screen, so it never runs behind the app.
  function hide() {
    clearTimeout(altTimer);
    if (el) { [].forEach.call(el.querySelectorAll(".qd-trk"), function (t) { t.parentNode.removeChild(t); }); el.hidden = true; }
    screen = "";
  }
  function signedIn(d) {
    var u = d.user || {};
    if (d.mode) mode = String(d.mode);
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
    mode: function (m) { mode = String(m || ""); showSkip(); },
    hide: hide, signedIn: signedIn, failed: failed, storeInfo: storeInfo, storeToday: storeToday,
    signedOut: function () { try { localStorage.removeItem(STORE_KEY); sessionStorage.removeItem(STORE_KEY); } catch (e) {} }
  };
})();
