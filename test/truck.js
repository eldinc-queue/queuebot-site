/**
 * Sign-in truck checks (round 11, boards 152 to 155), shared by test/site.page.js and test/preview.page.js.
 *   truckChecks(page, check, url): url is a page that shows the sign-in screen (no session), e.g. .../test/uw/
 * Google's script is blocked in these tests, so Google's button is the stand-in inside #qd-gbtn.
 */
"use strict";
const assert = require("assert");

// Everything about the truck that the checks need, read in the page.
function state() {
  const door = document.getElementById("qb-door");
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const trks = [...document.querySelectorAll(".qd-trk")];
  const shown = trks.filter(vis);
  const anims = document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".qd-trk"));
  const ids = [...document.querySelectorAll(".qd-trk svg [id]")].map((e) => e.id);
  const g = document.getElementById("qd-gbtn");
  const r = g && g.getBoundingClientRect();
  const top = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const t = shown[0], tr = t && t.getBoundingClientRect();
  const overlap = !!(tr && r && tr.left < r.right && tr.right > r.left && tr.top < r.bottom && tr.bottom > r.top);
  const run = t && t.querySelector(".qd-trk-run");
  return {
    doorShown: !!door && !door.hidden, count: trks.length, shown: shown.length, small: !!t && t.classList.contains("qd-trk-sm"),
    height: tr ? Math.round(tr.height) : 0, pointer: t ? getComputedStyle(t).pointerEvents : "",
    running: anims.filter((a) => a.playState === "running").map((a) => a.animationName),
    allAnims: anims.length, ids: ids, idsUnique: new Set(ids).size === ids.length,
    gbtn: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
    gbtnOnTop: !!(g && top && g.contains(top)), overlap: overlap,
    speed: t ? getComputedStyle(t.querySelector(".qd-trk-speed")).display : "",
    runTransform: run ? getComputedStyle(run).transform : "",
    nose: t ? t.querySelector(".qd-trk-svg").getBoundingClientRect().right : 0,
    line: t ? (() => { const l = t.querySelector(".qd-trk-line").getBoundingClientRect(); return { l: l.left, r: l.right }; })() : null,
    road: getComputedStyle(document.documentElement).getPropertyValue("--qd-road").trim(),
    cardClip: (document.querySelector(".qd-signin .qd-card") && getComputedStyle(document.querySelector(".qd-signin .qd-card")).clipPath) || "",
    scrollW: door ? door.scrollWidth : 0
  };
}
// Moves every truck animation to the same point in the 8 second loop (ms), so a check can look at several moments.
function seek(ms) { document.getAnimations().forEach((a) => { if (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(".qd-trk")) a.currentTime = ms; }); }

async function open(page, url, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url);
  await page.locator("#qb-door #qd-gfake").waitFor();
  await page.evaluate(() => document.fonts && document.fonts.ready);
}

async function truckChecks(page, check, url) {
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
  await check("truck: computer (1440): on the track, animating, nothing else running", async () => {
    await open(page, url, 1440, 900);
    const s = await page.evaluate(state);
    assert.strictEqual(s.shown, 1, "one truck shown");
    assert.ok(!s.small && s.height === 120, "the 120px computer track, got " + s.height);
    assert.ok(await page.locator(".qd-hero .qd-trk").isVisible(), "in the left half");
    assert.strictEqual(await page.locator(".qd-track").count(), 0, "the five little cars are gone");
    assert.strictEqual(s.pointer, "none");
    assert.ok(s.running.includes("qdTrkRun") && s.running.includes("qdTrkSpin") && s.running.includes("qdTrkWave"), s.running.join(","));
    assert.ok(!s.running.includes("qdTrkRunSm"), "the hidden phone strip is not running");
    assert.ok(s.idsUnique && s.ids.length >= 14, "gradient ids unique per copy");
    const d = await page.locator(".qd-trk-run").first().evaluate((e) => e.getAnimations()[0].effect.getTiming().duration);
    assert.strictEqual(d, 8000, "8 second loop");
    assert.strictEqual(await page.locator(".qd-trk script, .qd-trk img, .qd-trk use").count(), 0, "inline SVG only, nothing fetched");
    const marks = await page.locator(".qd-trk image").evaluateAll((l) => l.map((e) => e.getAttribute("href") || ""));
    assert.ok(marks.length >= 1 && marks.every((h) => h.indexOf("data:image/png;base64,") === 0), "the door's MG mark is inline (data: URI), nothing fetched");
  });
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await check("truck: Google's button is the top element at its centre all through the loop, no overlap, no layout shift (" + w + ")", async () => {
      await open(page, url, w, h);
      let first = null;
      for (const ms of [0, 1000, 2500, 4000, 5300, 6400, 7900]) {
        await page.evaluate(seek, ms);
        const s = await page.evaluate(state);
        assert.ok(s.gbtnOnTop, "button covered at " + ms + "ms");
        assert.ok(!s.overlap, "track overlaps the button at " + ms + "ms");
        if (!first) first = s.gbtn; else assert.deepStrictEqual(s.gbtn, first, "the button moved at " + ms + "ms");
      }
      await page.locator("#qd-gfake").click({ trial: true, timeout: 2000 });
    });
  }
  await check("truck: phone (390): the 88px strip under the logo, animating, page fits, card not cut", async () => {
    await open(page, url, 390, 844);
    const s = await page.evaluate(state);
    assert.strictEqual(s.shown, 1);
    assert.ok(s.small && s.height === 88, "88px strip, got " + s.height);
    assert.ok(await page.locator(".qd-side > .qd-ptrk .qd-trk").isVisible());
    assert.ok(s.running.includes("qdTrkRunSm") && !s.running.includes("qdTrkRun"), s.running.join(","));
    assert.ok(s.scrollW <= 390, "no sideways scroll");
    assert.strictEqual(s.cardClip, "none", "no cut corner over Practice on the demo on the phone");
    assert.ok(await page.locator(".qd-foot a", { hasText: "Practice on the demo" }).isVisible());
  });
  await check("truck: light theme has its own road colour", async () => {
    await page.emulateMedia({ colorScheme: "light" });
    await open(page, url, 1440, 900);
    const light = (await page.evaluate(state)).road;
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = (await page.evaluate(state)).road;
    assert.ok(light && dark && light !== dark, light + " / " + dark);
  });
  await check("truck: reduced motion: parked just past the finish line, flag still, no speed lines, nothing running", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      await open(page, url, w, h);
      const s = await page.evaluate(state);
      assert.strictEqual(s.allAnims, 0, "no animations at " + w);
      assert.strictEqual(s.speed, "none");
      assert.ok(s.nose > s.line.l && s.nose < s.line.r + 8, "nose just past the line at " + w + ": nose " + s.nose + ", line " + s.line.l + "-" + s.line.r);
      assert.ok(s.gbtnOnTop && !s.overlap);
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });
  await check("truck: gone once the sign-in screen hides, back when it shows again", async () => {
    await open(page, url, 1440, 900);
    await page.evaluate(() => window.QB_SIGNIN_UI.hide());
    let s = await page.evaluate(state);
    assert.ok(!s.doorShown && s.count === 0 && s.allAnims === 0, JSON.stringify({ shown: s.doorShown, count: s.count, anims: s.allAnims }));
    await page.evaluate(() => window.QB_SIGNIN_UI.show());
    s = await page.evaluate(state);
    assert.ok(s.doorShown && s.shown === 1 && s.running.includes("qdTrkRun"));
    assert.ok(s.idsUnique);
  });
}

module.exports = { truckChecks, state, seek };
