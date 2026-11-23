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
    const keys = await page.evaluate(async () => (await (await caches.open("qb-shell-v8")).keys()).map((r) => r.url));
    ["signin-ui.js", "signin.css", "demo/", "demo/demo.js", "demo/demo.css", "sales/", "hub/", "test/sales/", "test/hub/", "test/sales/manifest.webmanifest", "hub/co/", "hub/mx/", "hub/us/", "hub/co/manifest.webmanifest"].forEach((f) => assert.ok(keys.includes("http://localhost:8731/" + f), f));
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
  await check("front door lists the four apps with their icons", async () => {
    await page.goto("http://localhost:8731/");
    assert.deepStrictEqual(await page.locator("nav a").evaluateAll((a) => a.map((x) => x.getAttribute("href"))), ["store/", "uw/", "hub/", "sales/"]);
    assert.deepStrictEqual(await page.locator("nav a").evaluateAll((a) => a.map((x) => x.textContent.trim())), ["Store", "UW", "My Hub", "Master Sales"]);
    await page.waitForFunction(() => [...document.querySelectorAll("nav img")].every((i) => i.complete && i.naturalWidth === 192));
  });
  // One home screen app per address (approved Nov 20): own name, icon and color; test copies carry the TEST icons.
  const APPS = { store: ["QueueBot Store", "QB Store", "#e6a51a"], uw: ["QueueBot UW", "QB UW", "#004781"],
    hub: ["My Hub", "My Hub", "#0e76bc"], sales: ["QueueBot Master Sales", "QB Sales", "#444444"] };
  for (const [app, [name, short, color]] of Object.entries(APPS)) {
    for (const test of [false, true]) {
      const dir = (test ? "test/" : "") + app + "/", key = app + (test ? "-test" : "");
      await check("/" + dir + " has its own app: name, short name, icons, color", async () => {
        await page.goto("http://localhost:8731/" + dir);
        const href = new URL(await page.locator('link[rel="manifest"]').getAttribute("href"), page.url()).href;
        const m = await (await page.request.get(href)).json();
        assert.strictEqual(m.id, "./"); assert.strictEqual(m.start_url, "./"); assert.strictEqual(m.scope, "./");
        assert.strictEqual(m.name, name + (test ? " TEST" : ""));
        assert.strictEqual(m.short_name, test ? short + " T" : short);
        assert.ok(m.short_name.length <= 10, m.short_name);
        assert.strictEqual(m.theme_color, color);
        assert.deepStrictEqual(m.icons.map((i) => [i.src.split("/").pop(), i.sizes, i.purpose || "any"]),
          [[key + "-192.png", "192x192", "any"], [key + "-512.png", "512x512", "any"], [key + "-512.png", "512x512", "maskable"]]);
        const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
        assert.ok(apple.endsWith("icons/" + key + "-apple-180.png"), apple);
        assert.strictEqual(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute("content"), m.short_name);
        assert.strictEqual(await page.locator('meta[name="theme-color"]').getAttribute("content"), color);
        const srcs = m.icons.map((i) => new URL(i.src, href).href).concat([new URL(apple, page.url()).href]);
        for (const u of srcs) {
          const r = await page.request.get(u);
          assert.strictEqual(r.status(), 200, u); assert.strictEqual(r.headers()["content-type"], "image/png", u);
        }
      });
    }
  }
  // My Hub icon per person (approved Nov 23): /hub/co/, /hub/mx/, /hub/us/ are My Hub with their own icon and app id.
  for (const c of ["co", "mx", "us"]) {
    await check("/hub/" + c + "/ is My Hub (live, page=hub) with its own flag icon and app id", async () => {
      await page.goto("http://localhost:8731/hub/" + c + "/?x=1");
      await page.waitForSelector("#qb-app", { state: "attached" });
      assert.strictEqual(await page.locator("#qb-app").getAttribute("src"), "http://localhost:8732/live/exec?x=1&page=hub");
      assert.strictEqual(await page.title(), "My Hub");
      const href = new URL(await page.locator('link[rel="manifest"]').getAttribute("href"), page.url()).href;
      assert.strictEqual(href, "http://localhost:8731/hub/" + c + "/manifest.webmanifest");
      const m = await (await page.request.get(href)).json();
      assert.strictEqual(new URL(m.id, href).href, "http://localhost:8731/hub/" + c + "/");   // its own app, not /hub/
      assert.strictEqual(new URL(m.start_url, href).href, "http://localhost:8731/hub/" + c + "/");
      assert.strictEqual(m.name, "My Hub"); assert.strictEqual(m.short_name, "My Hub"); assert.strictEqual(m.theme_color, "#0e76bc");
      assert.deepStrictEqual(m.icons.map((i) => [i.src, i.sizes, i.purpose || "any"]),
        [["../../icons/hub-" + c + "-192.png", "192x192", "any"], ["../../icons/hub-" + c + "-512.png", "512x512", "any"], ["../../icons/hub-" + c + "-512.png", "512x512", "maskable"]]);
      const apple = new URL(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"), page.url()).href;
      assert.strictEqual(apple, "http://localhost:8731/icons/hub-" + c + "-apple-180.png");
      assert.strictEqual(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute("content"), "My Hub");
      for (const u of m.icons.map((i) => new URL(i.src, href).href).concat([apple])) {
        const r = await page.request.get(u);
        assert.strictEqual(r.status(), 200, u); assert.strictEqual(r.headers()["content-type"], "image/png", u);
      }
      // Same shared scripts and styles as /hub/ (one copy of the logic).
      const shared = await page.evaluate(() => [...document.querySelectorAll("script[src],link[rel=stylesheet]")].map((e) => (e.src || e.href).replace(location.origin, "")));
      ["/frame.css", "/signin.css", "/config.js", "/signin-ui.js", "/frame.js", "/signin.js", "/push.js"].forEach((f) => assert.ok(shared.includes(f), f));
    });
  }
  await check("service worker v8 caches the app icons and the My Hub flag icons", async () => {
    await page.goto("http://localhost:8731/uw/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const keys = await page.evaluate(async () => (await (await caches.open("qb-shell-v8")).keys()).map((r) => r.url));
    for (const a of ["store", "uw", "hub", "sales", "store-test", "uw-test", "hub-test", "sales-test", "hub-co", "hub-mx", "hub-us"])
      for (const z of ["192", "512", "apple-180"]) assert.ok(keys.includes("http://localhost:8731/icons/" + a + "-" + z + ".png"), a + "-" + z);
  });
  await check("frame fills the screen with no safe-area inset, and stays clear of an iPhone status bar", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const p of ["/uw/", "/store/", "/hub/", "/sales/", "/test/uw/", "/test/hub/"]) {
      await page.goto("http://localhost:8731" + p);
      await page.waitForSelector("#qb-app", { state: "attached" });
      const r = await page.locator("#qb-app").evaluate((f) => { const b = f.getBoundingClientRect(); return [b.top, b.bottom, b.width]; });
      assert.deepStrictEqual(r, [0, 844, 390], p);
    }
    // Chromium has no notch: add frame.css again with the inset as 47px (iPhone status bar) to check the layout.
    const css47 = fs.readFileSync(path.join(ROOT, "frame.css"), "utf8").replace(/env\(safe-area-inset-top,0px\)/g, "47px");
    assert.ok(css47.includes("top:47px"));
    await page.goto("http://localhost:8731/hub/");
    await page.waitForSelector("#qb-app", { state: "attached" });
    await page.addStyleTag({ content: css47 });
    const r = await page.locator("#qb-app").evaluate((f) => { const b = f.getBoundingClientRect(); return [b.top, b.bottom]; });
    assert.deepStrictEqual(r, [47, 844]);
    await page.goto("http://localhost:8731/demo/");   // demo: frame still right under the gold bar
    await page.waitForSelector("#qb-app", { state: "attached" });
    const box = () => page.locator("#qb-app").evaluate((f) => { const b = f.getBoundingClientRect(); return [b.top, b.bottom]; });
    const before = await box();
    await page.addStyleTag({ content: css47 });
    assert.deepStrictEqual(await box(), before);
    assert.ok(before[0] > 30 && before[1] === 844, String(before));
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
