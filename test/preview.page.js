/**
 * /preview/ check (Playwright): the new front door under /preview/ opens only the
 * test and demo copies, stays inside /preview/, and the live pages are untouched;
 * plus the sign-in truck (test/truck.js) on the preview pages.
 *   NODE_PATH=$(npm root -g) node test/preview.page.js
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
  for (const [p, role] of [["test/store/", "store"], ["test/uw/", "uw"], ["test/sales/", "sales"], ["test/hub/", "hub"]]) {
    await check("/preview/" + p + " frames the TEST copy and shows the sign-in screen", async () => {
      await page.goto("http://localhost:8741/preview/" + p);
      await page.waitForSelector("#qb-app", { state: "attached" });
      const src = await page.locator("#qb-app").getAttribute("src");
      assert.ok(src.startsWith("https://script.google.com/macros/s/AKfycbwSx8bp"), src);
      if (role === "store") assert.match(src, /role=store/);
      if (role === "sales") assert.match(src, /page=sales/);
      if (role === "hub") assert.match(src, /page=hub/);
      await page.waitForSelector("#qb-door", { timeout: 5000 });
    });
  }
  await check("/preview/ has the sign-in branch's report deal-list skip: ?page=nodeal opens without the sign-in screen", async () => {
    await page.goto("http://localhost:8741/preview/test/uw/?page=nodeal&from=2026-10-01&to=2026-10-14&k=x");
    await page.waitForSelector("#qb-app", { state: "attached" });
    await page.waitForTimeout(500);
    assert.strictEqual(await page.evaluate(() => { const d = document.getElementById("qb-door"); return !!d && !d.hidden; }), false);
  });
  // Where a signed-in person lands (signin-ui.js signedIn; Eldin, Nov 9: claims or titles with no other page go to
  // Master Sales). The QueueBot page's answer is played by calling the screen's signedIn with the user it carries.
  const B = "http://localhost:8741/preview/test/";
  const signedIn = async (from, mode, user) => {
    await page.goto(B + from);
    await page.waitForSelector("#qb-door", { timeout: 5000 });
    await page.evaluate(([m, u]) => { window.QB_SIGNIN_UI.mode(m); window.QB_SIGNIN_UI.signedIn({ mode: m, user: u }); }, [mode, user]);
  };
  const who = (roles, perms, x) => Object.assign({ email: "x@motorygroup.com", name: "X", roles, stores: [], known: true, active: true, perms }, x || {});
  const UWP = ["read:queue", "read:analytics", "act:uw", "act:store", "act:closing"];
  const landsOn = async (want, view) => {
    await page.waitForURL(B + want);
    await page.waitForSelector("#qb-app", { state: "attached" });
    const src = await page.locator("#qb-app").getAttribute("src");
    assert.match(src, /page=sales/);
    if (view) assert.match(src, new RegExp("view=" + view)); else assert.ok(!/view=/.test(src), src);
  };
  const doorHidden = () => page.evaluate(() => { const d = document.getElementById("qb-door"); return !d || d.hidden; });
  for (const [from, mode] of [["uw/", "enforce"], ["store/", "enforce"], ["hub/", "enforce"], ["uw/", "audit"]]) {
    await check("claims only on /preview/test/" + from + " (" + mode + "): Master Sales, Valuation", async () => {
      await signedIn(from, mode, who(["claims"], []));
      await landsOn("sales/?view=val", "val");
    });
  }
  await check("titles only on /preview/test/uw/ (enforce): Master Sales, Titles", async () => {
    await signedIn("uw/", "enforce", who(["titles"], []));
    await landsOn("sales/?view=titles", "titles");
  });
  await check("titles only on /preview/test/store/ (audit): Master Sales, Titles", async () => {
    await signedIn("store/", "audit", who(["titles"], [], { stores: ["Joplin", "Rogers"] }));
    await landsOn("sales/?view=titles", "titles");
  });
  await check("claims and titles (and insurance, collections): Master Sales, default view", async () => {
    await signedIn("uw/", "enforce", who(["claims", "titles"], []));
    await landsOn("sales/", "");
    await signedIn("store/", "enforce", who(["titles", "insurance", "collections"], []));
    await landsOn("sales/?view=titles", "titles");
  });
  await check("titles only already on /preview/test/sales/: stays, sign-in screen closes", async () => {
    await signedIn("sales/", "enforce", who(["titles"], []));
    await page.waitForFunction(() => document.getElementById("qb-door").hidden);
    assert.strictEqual(page.url(), B + "sales/");
  });
  await check("mixed roles keep today's routing: titles + uw stays on /uw, claims + manager stays on /uw, titles + store on /store", async () => {
    for (const [from, roles, perms] of [["uw/", ["titles", "uw"], UWP], ["uw/", ["claims", "manager"], UWP], ["store/", ["titles", "store"], ["read:queue", "act:store"]]]) {
      await signedIn(from, "enforce", who(roles, perms, { stores: ["Joplin"] }));
      await page.waitForFunction(() => document.getElementById("qb-door").hidden);
      await page.waitForTimeout(150);
      assert.strictEqual(page.url(), B + from, roles.join("+"));
    }
  });
  await check("store only on /uw still goes to /store", async () => {
    await signedIn("uw/", "enforce", who(["store"], ["read:queue", "act:store"], { stores: ["Joplin"] }));
    await page.waitForURL(B + "store/");
  });
  await check("roles that still have nothing keep Coming soon (insurance, collections); nobody on Users: not set up", async () => {
    await signedIn("uw/", "enforce", who(["insurance"], []));
    assert.strictEqual(await page.locator("#qd-title").innerText(), "Coming soon for Insurance");
    await signedIn("store/", "enforce", who(["collections", "insurance"], []));
    assert.strictEqual(await page.locator("#qd-title").innerText(), "Coming soon for Collections and Insurance");
    await signedIn("uw/", "enforce", who([], [], { known: false, active: false }));
    assert.strictEqual(await page.locator("#qd-title").innerText(), "You're not set up in QueueBot yet");
    await signedIn("uw/", "enforce", who(["titles"], [], { active: false }));
    assert.strictEqual(await page.locator("#qd-title").innerText(), "You're not set up in QueueBot yet", "turned off on Users: not set up, no Master Sales");
    assert.strictEqual(page.url(), B + "uw/");
  });
  await check("audit, not on Users (no roles): stays where it is", async () => {
    await signedIn("uw/", "audit", who([], [], { known: false, active: false }));
    assert.ok(await doorHidden());
    assert.strictEqual(page.url(), B + "uw/");
  });
  await truckChecks(page, check, "http://localhost:8741/preview/test/uw/");
  await page.setViewportSize({ width: 1280, height: 720 });
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
  await check("the preview service worker cache is qb-preview-v5 and holds the sign-in files", async () => {
    await page.goto("http://localhost:8741/preview/test/store/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const names = await page.evaluate(() => caches.keys());
    assert.ok(names.includes("qb-preview-v5") && !names.includes("qb-preview-v2"), names.join(", "));
    const keys = await page.evaluate(async () => (await (await caches.open("qb-preview-v5")).keys()).map((r) => r.url));
    ["signin-ui.js", "signin.css", "signin.js"].forEach((f) => assert.ok(keys.includes("http://localhost:8741/preview/" + f), f));
  });
  await browser.close(); site.close();
  console.log(fails ? fails + " failed" : "all passed");
  process.exit(fails ? 1 : 0);
})();
