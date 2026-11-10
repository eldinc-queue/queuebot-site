/**
 * Front door site check (Playwright). Serves site/ locally, points config.js at a
 * local stand-in for the web app, and checks framing, query pass-through,
 * manifests, the shell-only service worker and the sign-in truck (test/truck.js).
 *   NODE_PATH=$(npm root -g) node test/site.page.js  (needs Playwright)
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { chromium } = require("playwright");
const { truckChecks } = require("./truck");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };

function serve(port, handler) {
  return new Promise((ok) => { const s = http.createServer(handler).listen(port, () => ok(s)); });
}

(async () => {
  const app = await serve(8732, (req, res) => { res.setHeader("content-type", "text/html"); res.end("<p id=app>APP " + req.url + "</p>"); });
  const site = await serve(8731, (req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/config.js") { res.setHeader("content-type", "text/javascript"); return res.end('window.QB_SITE={clientId:"x.apps.googleusercontent.com",live:"http://localhost:8732/live/exec",test:"http://localhost:8732/test/exec",demo:"http://localhost:8732/demo/exec"};'); }
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.statusCode = 404; return res.end("nf"); }
    res.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream");
    fs.createReadStream(f).pipe(res);
  });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.route(/accounts\.google\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());   // no Google in this check
  const page = await ctx.newPage();
  let fails = 0;
  const check = async (name, fn) => { try { await fn(); console.log("  ok   " + name); } catch (e) { fails++; console.log("  FAIL " + name + "\n       " + e.message); } };

  await check("store page frames the web app with role=store and passes the query on", async () => {
    await page.goto("http://localhost:8731/store/?store=Underwriting%20Test");
    const f = page.locator("#qb-app");
    assert.strictEqual(await f.getAttribute("allow"), "camera; clipboard-write");
    const src = await f.getAttribute("src");
    assert.strictEqual(src, "http://localhost:8732/live/exec?store=Underwriting+Test&role=store");
    await page.frameLocator("#qb-app").locator("#app").waitFor();
    await page.waitForFunction(() => document.body.classList.contains("ready"));
  });
  await check("test pages use the test link", async () => {
    await page.goto("http://localhost:8731/test/uw/");
    assert.strictEqual(await page.locator("#qb-app").getAttribute("src"), "http://localhost:8732/test/exec");
    await page.goto("http://localhost:8731/test/store/");
    assert.strictEqual(await page.locator("#qb-app").getAttribute("src"), "http://localhost:8732/test/exec?role=store");
  });
  await check("uw page has an installable manifest with Motory icons", async () => {
    await page.goto("http://localhost:8731/uw/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const m = await (await page.request.get(new URL(href, page.url()).href)).json();
    assert.strictEqual(m.display, "standalone");
    for (const ic of m.icons) {
      const r = await page.request.get(new URL(ic.src, new URL(href, page.url())).href);
      assert.strictEqual(r.status(), 200, ic.src);
    }
    assert.ok(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable"));
  });
  await check("service worker caches only the site shell", async () => {
    await page.goto("http://localhost:8731/uw/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const keys = await page.evaluate(async () => {
      const out = [];
      for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) out.push(r.url);
      return out;
    });
    assert.ok(keys.length > 5);
    assert.ok(keys.every((u) => u.startsWith("http://localhost:8731/")), "cached something outside the site: " + keys.filter((u) => !u.startsWith("http://localhost:8731/")));
  });
  await check("offline: the shell still opens from cache", async () => {
    await page.goto("http://localhost:8731/uw/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await ctx.setOffline(true);
    await page.reload();
    await page.locator("#qb-msg").waitFor();
    assert.match(await page.locator("#qb-msg").textContent(), /offline/i);
    await Promise.all([page.waitForEvent("load"), ctx.setOffline(false)]);   // frame.js reloads when back online
  });
  await check("sign-in screen shows over the frame when there is no session", async () => {
    await page.goto("http://localhost:8731/uw/");
    await page.locator("#qb-door #qd-gfake").waitFor();
    assert.ok(await page.locator("#qb-app").count());
  });
  await truckChecks(page, check, "http://localhost:8731/test/uw/");
  await page.setViewportSize({ width: 1280, height: 720 });
  await check("demo page frames the demo link under the gold bar, with the password screen", async () => {
    await page.goto("http://localhost:8731/demo/");
    assert.strictEqual(await page.locator("#qb-app").getAttribute("src"), "http://localhost:8732/demo/exec?role=store");
    await page.locator("#qdm-pw").waitFor();
    assert.match(await page.locator("#qdm-bar").textContent(), /^DEMO, PRACTICE ONLY/);
  });
  await check("service worker keeps the sign-in and demo files", async () => {
    await page.goto("http://localhost:8731/uw/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const keys = await page.evaluate(async () => (await (await caches.open("qb-shell-v6")).keys()).map((r) => r.url));
    ["signin-ui.js", "signin.css", "demo/", "demo/demo.js", "demo/demo.css", "sales/", "hub/", "test/sales/", "test/hub/", "test/sales/manifest.webmanifest"].forEach((f) => assert.ok(keys.includes("http://localhost:8731/" + f), f));
  });
  for (const role of ["sales", "hub"]) {
    await check(role + " page (live) opens the live app with page=" + role, async () => {
      await page.goto("http://localhost:8731/" + role + "/");
      await page.waitForSelector("#qb-app", { state: "attached" });
      assert.match(await page.locator("#qb-app").getAttribute("src"), new RegExp("page=" + role));
      assert.strictEqual(await page.evaluate(() => document.body.getAttribute("data-env")), "live");
    });
  }
  for (const role of ["sales", "hub"]) {
    await check("/test/" + role + "/ opens the TEST app with page=" + role, async () => {
      await page.goto("http://localhost:8731/test/" + role + "/?x=1");
      await page.waitForSelector("#qb-app", { state: "attached" });
      const src = await page.locator("#qb-app").getAttribute("src");
      assert.ok(src.startsWith("http://localhost:8732/test/exec?"), src);
      assert.match(src, new RegExp("page=" + role));
      assert.match(src, /x=1/);
      assert.strictEqual(await page.evaluate(() => document.body.getAttribute("data-env")), "test");
      assert.match(await page.title(), /TEST$/);
      const m = await (await page.request.get("http://localhost:8731/test/" + role + "/manifest.webmanifest")).json();
      assert.strictEqual(m.start_url, "./"); assert.strictEqual(m.scope, "./"); assert.match(m.name, /TEST$/);
      assert.ok(m.icons.every((i) => i.src.startsWith("../../icons/")));
    });
  }
  // Root sign-in routing (Eldin, Nov 9): claims or titles with no page permission go to Master Sales,
  // on the test copy to /test/sales/. The web app's answer is played by calling the screen's signedIn.
  const who = (roles, perms) => ({ email: "x@motorygroup.com", name: "X", roles, stores: [], known: true, active: true, perms });
  const lands = async (from, roles, perms, want) => {
    await page.goto("http://localhost:8731/" + from);
    await page.waitForSelector("#qb-door", { timeout: 5000 });
    await page.evaluate(([u]) => { window.QB_SIGNIN_UI.mode("enforce"); window.QB_SIGNIN_UI.signedIn({ mode: "enforce", user: u }); }, [who(roles, perms)]);
    await page.waitForURL("http://localhost:8731/" + want);
    await page.waitForSelector("#qb-app", { state: "attached" });
    assert.match(await page.locator("#qb-app").getAttribute("src"), /page=sales/);
  };
  await check("root sign-in: claims only on /test/uw/ lands on /test/sales/?view=val (test app)", async () => {
    await lands("test/uw/", ["claims"], [], "test/sales/?view=val");
    assert.match(await page.locator("#qb-app").getAttribute("src"), /^http:\/\/localhost:8732\/test\/exec\?.*view=val/);
  });
  await check("root sign-in: titles only on /test/store/ lands on /test/sales/?view=titles", async () => {
    await lands("test/store/", ["titles"], [], "test/sales/?view=titles");
  });
  await check("root sign-in: claims only on /uw/ lands on /sales/?view=val (live app)", async () => {
    await lands("uw/", ["claims"], [], "sales/?view=val");
    assert.match(await page.locator("#qb-app").getAttribute("src"), /^http:\/\/localhost:8732\/live\/exec\?/);
  });
  await check("root sign-in: titles only on /store/ lands on /sales/?view=titles; claims + titles on /uw/ on /sales/", async () => {
    await lands("store/", ["titles"], [], "sales/?view=titles");
    await lands("uw/", ["claims", "titles"], [], "sales/");
  });
  await check("root sign-in: titles + uw stays on /uw/", async () => {
    await page.goto("http://localhost:8731/uw/");
    await page.waitForSelector("#qb-door", { timeout: 5000 });
    await page.evaluate(([u]) => { window.QB_SIGNIN_UI.mode("enforce"); window.QB_SIGNIN_UI.signedIn({ mode: "enforce", user: u }); }, [who(["titles", "uw"], ["read:queue", "act:uw"])]);
    await page.waitForTimeout(400);
    assert.strictEqual(page.url(), "http://localhost:8731/uw/");
  });
  await check("front door links to store and uw", async () => {
    await page.goto("http://localhost:8731/");
    assert.deepStrictEqual(await page.locator("nav a").evaluateAll((a) => a.map((x) => x.getAttribute("href"))), ["store/", "uw/"]);
  });
  await check("phone width: no horizontal scroll on the front door", async () => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("http://localhost:8731/");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360));
  });

  await browser.close(); app.close(); site.close();
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exit(fails ? 1 : 0);
})();
