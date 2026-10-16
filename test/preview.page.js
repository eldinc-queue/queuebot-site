/**
 * /preview/ check (Playwright): the new front door under /preview/ opens only the
 * test and demo copies, stays inside /preview/, and the live pages are untouched.
 *   NODE_PATH=$(npm root -g) node test/preview.page.js
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const cfg = fs.readFileSync(path.join(ROOT, "preview/config.js"), "utf8");

(async () => {
  const site = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.statusCode = 404; return res.end("nf"); }
    res.setHeader("content-type", TYPES[path.extname(f)] || "application/octet-stream");
    fs.createReadStream(f).pipe(res);
  }).listen(8741);
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const outside = [];
  await ctx.route(/script\.google\.com/, (r) => r.fulfill({ contentType: "text/html", body: "<p>APP</p>" }));
  await ctx.route(/accounts\.google\.com|fonts\.(googleapis|gstatic)\.com|gstatic\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("request", (r) => { const u = r.url(); if (u.startsWith("http://localhost:8741/") && !u.startsWith("http://localhost:8741/preview/")) outside.push(u); });
  let fails = 0;
  const check = async (name, fn) => { try { await fn(); console.log("  ok   " + name); } catch (e) { fails++; console.log("  FAIL " + name + "\n       " + e.message); } };

  await check("config has the test and demo links and no live link", async () => {
    assert.ok(/test: "https:\/\/script\.google\.com\//.test(cfg) && /demo: "https:\/\/script\.google\.com\//.test(cfg));
    assert.ok(!/\blive\s*:/.test(cfg), "no live link");
    assert.ok(!/http:\/\//.test(cfg));
  });
  for (const [p, role] of [["test/store/", "store"], ["test/uw/", "uw"]]) {
    await check("/preview/" + p + " frames the TEST copy and shows the sign-in screen", async () => {
      await page.goto("http://localhost:8741/preview/" + p);
      await page.waitForSelector("#qb-app", { state: "attached" });
      const src = await page.locator("#qb-app").getAttribute("src");
      assert.ok(src.startsWith("https://script.google.com/macros/s/AKfycbwSx8bp"), src);
      if (role === "store") assert.match(src, /role=store/);
      await page.waitForSelector("#qb-door", { timeout: 5000 });
    });
  }
  await check("/preview/demo/ frames the DEMO copy", async () => {
    await page.goto("http://localhost:8741/preview/demo/");
    await page.waitForSelector("#qb-app", { state: "attached" });
    assert.ok((await page.locator("#qb-app").getAttribute("src")).startsWith("https://script.google.com/macros/s/AKfycbymoHc"));
  });
  await check("preview pages load nothing from outside /preview/ (the live front door files)", async () => {
    assert.deepStrictEqual(outside, []);
  });
  await check("the preview service worker is scoped to /preview/", async () => {
    await page.goto("http://localhost:8741/preview/test/store/");
    const scopes = await page.evaluate(async () => { await navigator.serviceWorker.ready; return (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope); });
    assert.ok(scopes.every((s) => s.startsWith("http://localhost:8741/preview/")), scopes.join(", "));
  });
  await browser.close(); site.close();
  console.log(fails ? fails + " failed" : "all passed");
  process.exit(fails ? 1 : 0);
})();
