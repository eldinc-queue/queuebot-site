/* Shows the QueueBot web app full screen inside this page.
   <body data-env="live|test" data-role="uw|store"> */
(function () {
  var body = document.body;
  var env = body.getAttribute("data-env") || "live";
  var role = body.getAttribute("data-role") || "uw";
  var base = (window.QB_SITE || {})[env] || "";
  var msg = document.getElementById("qb-msg");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(body.getAttribute("data-root") + "sw.js").catch(function () {});
  }

  if (!base) {
    msg.textContent = "The " + env + " link is not set yet (config.js).";
    return;
  }
  if (!navigator.onLine) {
    msg.textContent = "You are offline. QueueBot opens when the connection is back.";
    window.addEventListener("online", function () { location.reload(); });
    return;
  }

  // Pass the page's own query on (for example ?store=Florence).
  var q = new URLSearchParams(location.search);
  if (role === "store") q.set("role", "store");
  var src = base + (q.toString() ? "?" + q.toString() : "");

  var f = document.createElement("iframe");
  f.id = "qb-app";
  f.title = "QueueBot";
  f.allow = "camera; clipboard-write";
  f.src = src;
  f.addEventListener("load", function () { body.classList.add("ready"); });
  document.body.appendChild(f);
})();
