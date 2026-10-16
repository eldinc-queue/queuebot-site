/* /demo (queuebot repo docs/demo.md, boards 23 to 25). The demo copy of QueueBot in the frame,
   the gold DEMO bar above it, the demo password screen and the role picker.
   The password goes to the demo web app in the frame (qbDemoSignIn checks it against the stored
   hash there); the role is set with qbDemoSetRole. signin.js does the hand-off and calls
   window.QB_SIGNIN_UI. Loaded before frame.js: it picks the page the frame opens. */
(function () {
  var body = document.body;
  var ROLE_KEY = "qb_demo_role";
  var STORE = "Gainesville";            // the Store role's store (DEMO_STORE in src/Demo.js)
  var ROLES = [
    { k: "store", t: "Store", step: "STEP 1", d: "You are a salesperson at " + STORE + ". A customer just sat down.", p: "Submit, track, sell, checklist",
      does: ["Submit a deal and the interview", "Watch where your deal is in line", "Mark it SOLD and do the checklist"] },
    { k: "uw", t: "Underwriter", step: "STEP 2", d: "You run the grid. Deals arrive from every store.", p: "Work the grid, decide",
      does: ["Start the next deal", "Read the interview, flag an answer", "Post a decision to the store"] },
    { k: "closer", t: "Closer", step: "STEP 3", d: "Sold deals land on your board with their documents.", p: "Documents, record, close",
      does: ["Pick up a sold deal", "Check documents as they arrive", "Record and close it"] },
    { k: "manager", t: "Manager", step: "STEP 4", d: "See the whole day: pace, waits and the championship.", p: "Performance and the race",
      does: ["Read Performance", "See flags by store", "Watch the championship move"] }
  ];
  function byKey(k) { for (var i = 0; i < ROLES.length; i++) if (ROLES[i].k === k) return ROLES[i]; return null; }
  function saved() { try { var r = localStorage.getItem(ROLE_KEY) || ""; return byKey(r) ? r : ""; } catch (e) { return ""; } }
  function save(r) { try { if (r) localStorage.setItem(ROLE_KEY, r); else localStorage.removeItem(ROLE_KEY); } catch (e) {} }
  function pageFor(r) { return r === "store" ? "store" : "uw"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var role = saved();                   // the role the demo session has (once signed in)
  var state = "";                       // "password" | "sent" | "pick" | "setting" | ""
  var want = "";
  var el = null;
  body.setAttribute("data-role", pageFor(role || "store"));

  /* ------------------------------ bar -------------------------------- */
  var bar = document.getElementById("qdm-bar");
  function fit() { try { document.documentElement.style.setProperty("--bar", bar.offsetHeight + "px"); } catch (e) {} }
  function paintBar() {
    var r = byKey(role);
    if (!r || state === "password" || state === "sent") {
      bar.className = "qdm-bar solo";
      bar.innerHTML = "DEMO, PRACTICE ONLY. MADE-UP CUSTOMERS. NOTHING HERE REACHES A STORE, CHAT OR AMS.";
    } else {
      var who = r.t + (r.k === "store" ? ", " + STORE : "");
      bar.className = "qdm-bar";
      bar.innerHTML = '<span>DEMO</span><span class="t w-only">Practice only, made-up customers.</span><span class="sp"></span>' +
        '<span class="t who"><span class="w-only">You are: </span>' + esc(who) + '</span>' +
        '<button type="button" id="qdm-switch">Switch role</button><button type="button" class="o w-only" id="qdm-guide">Guide</button>';
      document.getElementById("qdm-switch").onclick = function () { pick(); };
      document.getElementById("qdm-guide").onclick = function () { pick(); };
    }
    fit();
  }
  window.addEventListener("resize", fit);

  function screen(html, cls) {
    if (!el) { el = document.createElement("div"); el.id = "qdm-screen"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "qdm-title"); body.appendChild(el); }
    el.className = "qdm " + (cls || ""); el.innerHTML = html; el.hidden = false;
  }
  function hide() { if (el) el.hidden = true; state = ""; paintBar(); }

  /* --------------------------- 23: password --------------------------- */
  function password(message) {
    state = "password"; paintBar();
    screen('<div class="qdm-pw"><form class="qdm-card cut" id="qdm-form" novalidate>' +
      '<div class="qdm-brand"><div class="lg cuts"><img src="../icons/motory-logo.png" alt="Motory Group"></div><span class="wide">QueueBot demo</span></div>' +
      '<h1 class="wide" id="qdm-title">Learn QueueBot by doing</h1>' +
      '<p>Send a deal, work it as an underwriter, sell it and close it. Everything is made up and resets every night.</p>' +
      '<label>Demo password (from your manager)<input type="password" id="qdm-pw" autocomplete="current-password" required></label>' +
      '<button type="submit" class="qdm-go cuts" id="qdm-go">Start the demo</button>' +
      '<p class="qdm-err' + (message ? " bad" : "") + '" id="qdm-err" role="alert">' + esc(message || "") + '</p>' +
      '</form></div>');
    var input = document.getElementById("qdm-pw");
    try { input.focus(); } catch (e) {}
    document.getElementById("qdm-form").onsubmit = function (ev) {
      ev.preventDefault();
      var pw = input.value;
      var err = document.getElementById("qdm-err");
      if (!pw) { err.className = "qdm-err bad"; err.textContent = "Type the demo password."; return; }
      state = "sent";
      document.getElementById("qdm-go").disabled = true;
      err.className = "qdm-err"; err.textContent = "Starting the demo...";
      window.qbSendToApp({ type: "qb-demo-password", password: pw, role: role || "store" });
    };
  }

  /* ------------------------ 24, 25: pick a role ----------------------- */
  function pick() {
    state = "pick"; paintBar();
    var cur = role;
    screen('<div class="qdm-roles">' +
      '<h1 class="wide" id="qdm-title">Who do you want to be?</h1>' +
      '<p class="lead">Switch any time from the gold bar.<span class="w"> Follow Avery Collins from the store to the championship.</span></p>' +
      '<div class="qdm-grid w">' + ROLES.map(function (r) {
        return '<button type="button" class="qdm-role cut ' + r.k + (r.k === cur ? " now" : "") + '" data-role="' + r.k + '">' +
          '<span class="st wide">' + r.step + '</span><span class="tt wide">' + r.t + '</span><span class="dd">' + esc(r.d) + '</span><span class="gr"></span>' +
          '<span class="yw">You will:</span>' + r.does.map(function (x) { return '<span class="x"><i>&#9656;</i>' + esc(x) + '</span>'; }).join("") + '</button>';
      }).join("") + '</div>' +
      '<div class="qdm-today w"><i></i>Today\'s demo: 16 deals in every stage, a conditional, a requeue, an answer to flag and a close race for first.<i></i></div>' +
      '<div class="qdm-list n">' + ROLES.map(function (r) {
        return '<button type="button" class="qdm-prole ' + r.k + (r.k === (cur || "store") ? " now" : "") + '" data-role="' + r.k + '">' +
          '<span class="bar"></span><span class="nm"><b>' + r.t + '</b><small>' + esc(r.p) + '</small></span><span class="ch" aria-hidden="true">&rsaquo;</span></button>';
      }).join("") + '</div>' +
      '<div class="qdm-tip n">Tip: start as Store, send a deal, then switch to Underwriter to decide it.</div>' +
      '</div>');
    [].forEach.call(el.querySelectorAll("[data-role]"), function (b) {
      b.onclick = function () { choose(b.getAttribute("data-role")); };
    });
  }
  function choose(r) {
    if (r === role && body.getAttribute("data-role") === pageFor(r)) { hide(); return; }
    want = r; state = "setting";
    window.qbSendToApp({ type: "qb-demo-role", role: r });
  }
  /** Opens the page the role uses (store page or UW dashboard) when the frame shows the other one. */
  function frameFor(r) {
    var page = pageFor(r);
    if (body.getAttribute("data-role") === page) return false;
    body.setAttribute("data-role", page);
    var f = document.getElementById("qb-app"), base = (window.QB_SITE || {}).demo || "";
    if (f && base) { body.classList.remove("ready"); f.src = base + (page === "store" ? "?role=store" : ""); }
    return true;
  }

  /* ------------------------- called by signin.js ---------------------- */
  window.QB_SIGNIN_UI = {
    show: function () { role = ""; save(""); if (state !== "password") password(""); },
    hide: hide,
    signedIn: function (d) {
      var r = ((d.user || {}).roles || [])[0];
      if (byKey(r)) { role = r; save(r); }
      if (state === "sent") { pick(); return; }                     // password accepted: pick a role
      if (state === "setting") { state = ""; frameFor(role); hide(); return; }
      if (state === "pick") return;
      frameFor(role); hide();
    },
    failed: function (d) { password(d.message || "That password didn't work. Ask your manager for the current one."); },
    storeToday: function () { return ""; }
  };
  paintBar();
})();
