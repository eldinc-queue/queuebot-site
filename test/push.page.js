/**
 * Push alerts on the front door (push.js, firebase-messaging-sw.js). Playwright with
 * stand-ins only: the front door is served from these files at its real address
 * through routes, the QueueBot page is a stand-in in a stand-in Apps Script frame,
 * Firebase and the permission prompt are fakes. Nothing reaches Google.
 *   NODE_PATH=$(npm root -g) node test/push.page.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const DOOR = "https://queuebot.motorygroup.com";
const SANDBOX = "https://n-test0abc-0lu-script.googleusercontent.com";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const FB_CFG = { apiKey: "AIza-test", projectId: "queuebot-test", messagingSenderId: "123", appId: "1:123:web:abc", vapidKey: "BTESTKEY" };
const FAKE_FB = "window.firebase={apps:[],initializeApp:function(c){window.__fbInit=c;this.apps.push(c);}," +
  "messaging:function(){return{getToken:function(o){window.__fbGet={vapidKey:o.vapidKey,scope:o.serviceWorkerRegistration.scope,url:o.serviceWorkerRegistration.url};return Promise.resolve('tok-ABCDEFGHIJKLMNOPQRSTUVWX');}};}};";
const APP = `<!doctype html><p id=app>app</p><script>
  window.got = [];
  addEventListener("message", (e) => { if (e.origin === "${DOOR}") got.push(e.data); });
  window.ask = (type) => top.postMessage({ type }, "${DOOR}");
  ask("qb-ready");
</script>`;

async function door(browser, firebase) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    if (location.hostname !== "queuebot.motorygroup.com") return;
    window.__perm = "default";
    try {
      Object.defineProperty(Notification, "permission", { get: () => window.__perm });
      Notification.requestPermission = (cb) => { window.__perm = window.__answer || "granted"; if (cb) cb(window.__perm); return Promise.resolve(window.__perm); };
    } catch (e) {}
    navigator.serviceWorker.register = (u, o) => {
      (window.__regs = window.__regs || []).push([String(u), o && o.scope]);
      return Promise.resolve({ scope: new URL((o && o.scope) || "./", location.href).href, url: new URL(u, location.href).href });
    };
  });
  await ctx.route(/^https:\/\/queuebot\.motorygroup\.com\//, (r) => {
    let p = decodeURIComponent(new URL(r.request().url()).pathname);
    if (p === "/config.js") {
      return r.fulfill({ contentType: "text/javascript", body: "window.QB_SITE={live:'" + SANDBOX + "/exec',test:'" + SANDBOX + "/exec'" + (firebase ? ",firebase:" + JSON.stringify(FB_CFG) : "") + "};" });
    }
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: "nf" });
    r.fulfill({ contentType: TYPES[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
  });
  await ctx.route(/googleusercontent\.com\/exec/, (r) => r.fulfill({ contentType: "text/html", body: '<iframe src="/inner" style="width:300px;height:200px"></iframe>' }));
  await ctx.route(/googleusercontent\.com\/inner/, (r) => r.fulfill({ contentType: "text/html", body: APP }));
  await ctx.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.2\/firebase-app-compat\.js$/, (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_FB }));
  await ctx.route(/^https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.2\/firebase-messaging-compat\.js$/, (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route(/fonts\.googleapis|accounts\.google\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(DOOR + "/uw/");
  let app = null;
  for (let i = 0; i < 50 && !app; i++) { app = page.frames().find((f) => /\/inner$/.test(f.url())); if (!app) await page.waitForTimeout(100); }
  await app.waitForSelector("#app");
  const reply = async (type) => {
    await app.waitForFunction((t) => got.some((m) => m && m.type === t), type);
    return app.evaluate((t) => got.filter((m) => m && m.type === t).pop(), type);
  };
  return { ctx, page, app, reply };
}

(async () => {
  const browser = await chromium.launch();
  let fails = 0;
  const check = async (name, fn) => { try { await fn(); console.log("  ok   " + name); } catch (e) { fails++; console.log("  FAIL " + name + "\n       " + String(e.stack || e).split("\n").slice(0, 3).join("\n       ")); } };

  await check("every framed page loads push.js; config.js has the empty firebase block", async () => {
    for (const p of ["uw/index.html", "store/index.html", "test/uw/index.html", "test/store/index.html"]) {
      assert.match(fs.readFileSync(path.join(ROOT, p), "utf8"), /<script src="(\.\.\/)+push\.js"><\/script>/, p);
    }
    const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"), { window: w });
    assert.deepStrictEqual(Object.keys(w.QB_SITE.firebase), ["apiKey", "projectId", "messagingSenderId", "appId", "vapidKey"]);
    assert.ok(Object.values(w.QB_SITE.firebase).every((v) => v === ""), "values stay empty in the repo");
  });

  await check("Firebase not set up: status says so, enable answers not_configured, nothing loads", async () => {
    const d = await door(browser, false);
    try {
      await d.app.evaluate(() => ask("qb-push-status"));
      const st = await d.reply("qb-push-state");
      assert.strictEqual(st.configured, false);
      assert.strictEqual(st.token, "");
      await d.app.evaluate(() => ask("qb-push-enable"));
      assert.strictEqual((await d.reply("qb-push-error")).reason, "not_configured");
      assert.strictEqual(await d.page.evaluate(() => typeof window.firebase), "undefined");
    } finally { await d.ctx.close(); }
  });

  await check("turn on: the front door asks with a tap on its own bar, gets the token and hands it back", async () => {
    const d = await door(browser, true);
    try {
      await d.app.evaluate(() => ask("qb-push-status"));
      const st = await d.reply("qb-push-state");
      assert.deepStrictEqual([st.supported, st.configured, st.permission, st.token], [true, true, "default", ""]);
      assert.match(st.label, /^This computer, (Chrome|browser)$/);
      await d.app.evaluate(() => ask("qb-push-enable"));
      await d.page.waitForSelector("#qb-push-bar");
      assert.match(await d.page.textContent("#qb-push-bar"), /Allow QueueBot alerts on this device\?/);
      await d.page.click("#qb-push-bar >> text=Turn on alerts");
      const tok = await d.reply("qb-push-token");
      assert.strictEqual(tok.token, "tok-ABCDEFGHIJKLMNOPQRSTUVWX");
      assert.ok(await d.page.locator("#qb-push-bar").count() === 0, "bar gone");
      const init = await d.page.evaluate(() => window.__fbInit);
      assert.strictEqual(init.projectId, "queuebot-test");
      assert.strictEqual(init.appId, "1:123:web:abc");
      const get = await d.page.evaluate(() => window.__fbGet);
      assert.strictEqual(get.vapidKey, "BTESTKEY");
      assert.strictEqual(get.url, DOOR + "/firebase-messaging-sw.js");
      assert.strictEqual(get.scope, DOOR + "/push/", "its own scope, not the shell worker's");
      // now granted: status carries the token so the page can see this device is on
      await d.app.evaluate(() => { got.length = 0; ask("qb-push-status"); });
      assert.strictEqual((await d.reply("qb-push-state")).token, "tok-ABCDEFGHIJKLMNOPQRSTUVWX");
    } finally { await d.ctx.close(); }
  });

  await check("Not now, a refused prompt, and messages from anywhere but the QueueBot frame", async () => {
    const d = await door(browser, true);
    try {
      await d.app.evaluate(() => ask("qb-push-enable"));
      await d.page.click("#qb-push-bar >> text=Not now");
      assert.strictEqual((await d.reply("qb-push-error")).reason, "dismissed");
      await d.page.evaluate(() => { window.__answer = "denied"; });
      await d.app.evaluate(() => { got.length = 0; ask("qb-push-enable"); });
      await d.page.click("#qb-push-bar >> text=Turn on alerts");
      assert.strictEqual((await d.reply("qb-push-error")).reason, "denied");
      await d.app.evaluate(() => { got.length = 0; ask("qb-push-enable"); });
      assert.strictEqual((await d.reply("qb-push-error")).reason, "denied", "blocked stays blocked without a prompt");
      await d.page.evaluate(() => window.postMessage({ type: "qb-push-enable" }, "*"));
      await d.page.waitForTimeout(300);
      assert.strictEqual(await d.page.locator("#qb-push-bar").count(), 0, "the front door's own messages are ignored");
    } finally { await d.ctx.close(); }
  });

  await check("firebase-messaging-sw.js: off without config; with config it loads pinned Firebase and starts messaging", async () => {
    const src = fs.readFileSync(path.join(ROOT, "firebase-messaging-sw.js"), "utf8");
    function run(cfg) {
      const imported = [], listeners = {}, fb = { init: null, messaging: 0 };
      const self = { addEventListener: (k) => { listeners[k] = 1; }, skipWaiting() {}, clients: { claim() {} } };
      const ctx = { self, importScripts: (...u) => {
        u.forEach((x) => imported.push(x));
        if (u[0] === "config.js") self.QB_SITE = { live: "x", firebase: cfg };
        if (/firebase-app-compat/.test(u[0])) ctx.firebase = { initializeApp: (c) => { fb.init = c; }, messaging: () => { fb.messaging++; } };
      } };
      vm.runInNewContext(src, ctx);
      return { imported, listeners, fb };
    }
    let r = run({ apiKey: "", projectId: "", messagingSenderId: "", appId: "", vapidKey: "" });
    assert.deepStrictEqual(r.imported, ["config.js"]);
    assert.ok(r.listeners.install && r.listeners.activate);
    r = run(FB_CFG);
    assert.deepStrictEqual(r.imported, ["config.js", "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js", "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"]);
    assert.strictEqual(r.fb.init.projectId, "queuebot-test");
    assert.strictEqual(r.fb.messaging, 1);
  });

  await browser.close();
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
})();
