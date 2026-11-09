import { after, afterEach, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
import { chromium } from "playwright";

// Serve under a Pages-style subpath, on an available port, without an external server.
const root = fileURLToPath(new URL("../../", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
let server, browser, context, page, base, errors;
before(async () => {
  server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (!path.startsWith("/aperitif/")) { res.writeHead(404).end(); return; }
      const file = resolve(root, path.slice("/aperitif/".length) || "index.html");
      if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${server.address().port}/aperitif/`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
});
beforeEach(async () => {
  context = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(8000);
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
afterEach(async () => {
  await context?.close();
  assert.deepEqual(errors, [], "no uncaught browser errors");
});
async function open(path = "") {
  await page.goto(base + path);
  await page.locator(path.startsWith("recipe.html") ? "h1" : "#bottle-list input").first().waitFor({ state: "attached" });
}
async function fits() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow at 360px");
}
async function swipe(dx, dy = 0, navigates = true) {
  const before = page.url();
  // Browser-dispatched touches exercise the actual DOM listeners; no app helpers are called.
  await page.locator("h1").evaluate((el, { dx, dy }) => {
    const touch = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [touch(180, 180)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [touch(180 + dx, 180 + dy)] }));
  }, { dx, dy });
  if (navigates) {
    await page.waitForURL((url) => url.href !== before, { waitUntil: "domcontentloaded" });
    await page.locator("h1").waitFor();
  } else {
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(page.url(), before);
  }
}

test("mobile filters preserve context; drawer traps focus and restores it on Escape", async () => {
  await open();
  await page.locator("#open-filters").click();
  assert.equal(await page.locator("#filters").getAttribute("aria-modal"), "true");
  assert.equal(await page.locator("#close-filters").evaluate((el) => el === document.activeElement), true);
  await page.locator("#show-results").focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.locator("#clear-all").evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.locator("#show-results").evaluate((el) => el === document.activeElement), true);
  await page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Base spirit" }) }).getByRole("button", { name: /^Gin/ }).click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#open-filters").evaluate((el) => el === document.activeElement), true);
  assert.equal(await page.locator(".results").evaluate((el) => el.inert), false);
  await page.locator("#sort").selectOption("family");
  await page.locator("#q").fill("chartreuse");
  await page.waitForURL((url) => url.searchParams.get("q") === "chartreuse");
  const listURL = page.url();
  assert.equal(new URL(listURL).searchParams.get("base"), "gin");
  assert.equal(new URL(listURL).searchParams.get("sort"), "family");
  await fits();
  await page.locator("#list .card a, #list a.card").first().click();
  await page.locator("h1").waitFor();
  assert.equal(new URL(await page.locator("#back").getAttribute("href"), base).href, listURL);
  await page.locator("#back").click();
  await page.locator("#list .card").first().waitFor();
  assert.equal(page.url(), listURL);
});

test("swipes and links follow sorted results, stop at ends, retain units and support history", async () => {
  await open("?base=gin&sort=family");
  const cards = await page.locator("#list .card").evaluateAll((els) => els.map((el) => {
    const link = el.matches("a") ? el : el.querySelector("a");
    return { href: link.href, name: el.querySelector("h3").textContent };
  }));
  assert.ok(cards.length > 2);
  await page.locator("#list .card a, #list a.card").first().click();
  await page.locator("h1").waitFor();
  assert.equal(await page.locator(".recipe-navigation [aria-disabled]").count(), 1);
  await swipe(100, 0, false);
  await page.locator('[data-unit="oz"]').click();
  await swipe(-100);
  assert.equal(await page.locator("h1").innerText(), cards[1].name);
  assert.equal(await page.locator('[data-unit="oz"]').getAttribute("aria-pressed"), "true");
  await fits();
  await swipe(100);
  assert.equal(await page.locator("h1").innerText(), cards[0].name);
  await page.goBack({ waitUntil: "commit" });
  await page.locator("h1").waitFor();
  assert.equal(await page.locator("h1").innerText(), cards[1].name);
  await swipe(-20, 100, false);
  await page.locator('[rel="next"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(cards[2].href, { waitUntil: "domcontentloaded" });
  await open(cards.at(-1).href.slice(base.length));
  assert.equal(await page.locator('[rel="next"]').count(), 0);
  await swipe(-100, 0, false);
  await open("recipe.html?c=adonis&from=.%2F%3Fq%3DAdonis");
  assert.equal(await page.locator(".recipe-navigation [aria-disabled]").count(), 2);
});

test("beer can be checked, saved and used to make Mezcalada and Stout Flip", async () => {
  await open("?view=bar");
  await page.locator('#bottle-list input[value="mezcal"]').check();
  await page.locator('#away .card').filter({ hasText: "Mezcalada" }).waitFor({ state: "attached" });
  await page.locator('#bottle-list input[value="lager"]').check();
  await page.locator('#bottle-list input[value="stout"]').check();
  await page.locator('#bottle-list input[value="spiced-rum"]').check();
  await page.locator('#ready .card').filter({ hasText: "Mezcalada" }).waitFor();
  await page.locator('#ready .card').filter({ hasText: "Stout Flip" }).waitFor();
  await page.reload();
  await page.locator('#ready .card').filter({ hasText: "Mezcalada" }).waitFor();
  assert.equal(await page.locator('#bottle-list input[value="lager"]').isChecked(), true);
  for (const group of ["ready", "away"]) {
    if (group === "away") {
      await page.locator("#away details.recommendation").first().evaluate((el) => { el.open = true; });
    }
    const card = page.locator(`#${group} .card`).first();
    const name = await card.locator("h3").innerText();
    await card.locator("a").or(card).first().click();
    await page.locator("h1").waitFor();
    assert.equal(await page.locator("h1").innerText(), name);
    assert.equal(new URL(page.url()).searchParams.get("group"), group);
    assert.equal(await page.locator("#back").getAttribute("href"), "./?view=bar");
    await page.locator("#back").click();
    await page.locator(`#${group} .card`).first().waitFor({ state: group === "away" ? "attached" : "visible" });
  }
  await fits();
});

for (const saved of ["null", "{}", '"gin"', "{", '["lager","stout","lager","removed",null,{},"lime-juice"]']) {
  test(`malformed or stale preferences do not break either page: ${saved}`, async () => {
    await context.addInitScript((value) => {
      localStorage.setItem("aperitif.bar", value);
      localStorage.setItem("aperitif.unit", "{}");
    }, saved);
    await open("?view=bar");
    assert.equal(await page.locator("#bottle-count").innerText(), saved.startsWith("[") ? "(2)" : "(0)");
    await open("recipe.html?c=adonis&from=.%2F%3Fview%3Dbar&group=ready");
    assert.equal(await page.locator('[data-unit="ml"]').getAttribute("aria-pressed"), "true");
    await page.locator('[rel="next"]').waitFor();
  });
}

test("blocked storage still allows bottle selection and unit switching", async () => {
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  await open("?view=bar");
  await page.locator('#bottle-list input[value="stout"]').check();
  await page.locator('#bottle-list input[value="spiced-rum"]').check();
  await page.locator('#ready .card').filter({ hasText: "Stout Flip" }).click();
  await page.locator("h1").waitFor();
  await page.locator('[data-unit="oz"]').click();
  assert.equal(await page.locator('[data-unit="oz"]').getAttribute("aria-pressed"), "true");
});

test("a cached installation supports cold offline recipe navigation and shared cards", async () => {
  await open("recipe.html?c=negroni");
  // Normal localhost previews skip registration; explicitly install the real worker for this test.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((done) => navigator.serviceWorker.addEventListener("controllerchange", done, { once: true }));
  });
  const expected = await page.locator('[rel="next"]').getAttribute("href");
  await context.setOffline(true);
  await page.reload();
  await page.locator("h1").waitFor();
  assert.equal(await page.locator("h1").innerText(), "Negroni");
  await page.locator('[rel="next"]').click();
  await page.waitForURL(new URL(expected, base).href);
  await page.locator("h1").waitFor();
  const related = page.locator(".related .card").first();
  const name = await related.locator("h3").innerText();
  await related.locator("a").or(related).first().click();
  await page.locator("h1").waitFor();
  assert.equal(await page.locator("h1").innerText(), name);
  await fits();
});
