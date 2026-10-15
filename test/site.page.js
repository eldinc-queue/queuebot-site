/**
 * Front door site check (Playwright). Serves site/ locally, points config.js at a
 * local stand-in for the web app, and checks framing, query pass-through,
 * manifests and the shell-only service worker.
 *   NODE_PATH=$(npm root -g) node test/site.page.js  (needs Playwright)
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };

function serve(port, handler) {
  return new Promise((ok) => { const s = http.createServer(handler).listen(port, () => ok(s)); });
}

(async () => {
  const app = await serve(8732, (req, res) => { res.setHeader("content-type", "text/html"); res.end("<p id=app>APP " + req.url + "</p>"); });
  const site = await serve(8731, (req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/config.js") { res.setHeader("content-type", "text/javascript"); return res.end('window.QB_SITE={live:"http://localhost:8732/live/exec",test:"http://localhost:8732/test/exec"};'); }
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.statusCode = 404; return res.end("nf"); }
    res.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream");
    fs.createReadStream(f).pipe(res);
  });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
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
    await ctx.setOffline(false);
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
