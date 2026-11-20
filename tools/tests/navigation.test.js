import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepare, bottleRecommendations, emptyState, filterCocktails, parseState, whatCanIMake } from "../../js/data.js";
import { browseContext, recipeURL, recipeSequence, swipeDirection, setupSwipe } from "../../js/navigation.js";

const data = prepare(JSON.parse(readFileSync(new URL("../../data/cocktails.json", import.meta.url), "utf8")));
const base = "https://example.com/aperitif/recipe.html?c=adonis";

test("context accepts only this deployment's index and round trips through recipe links", () => {
  for (const value of ["./?base=gin", "index.html?base=gin", "/aperitif/?base=gin"]) {
    assert.equal(browseContext(value, base), "./?base=gin");
  }
  for (const value of [null, "https://evil.com/aperitif/", "//evil.com/", "/", "recipe.html", "javascript:alert(1)", "https://user:pass@example.com/aperitif/"]) {
    assert.equal(browseContext(value, base), null);
  }
  const url = new URL(recipeURL("last-word", "./?base=gin&sort=family", "ready"), base);
  assert.equal(url.searchParams.get("from"), "./?base=gin&sort=family");
  assert.equal(url.searchParams.get("group"), "ready");
});

test("sequences follow filters and sorting, falling back for direct or excluded drinks", () => {
  const expected = filterCocktails(data, parseState(new URLSearchParams("base=gin&sort=family")));
  assert.deepEqual(recipeSequence(data, { slug: expected[0].slug, from: "./?base=gin&sort=family" }), expected);
  const all = filterCocktails(data, emptyState());
  assert.deepEqual(recipeSequence(data, { slug: "adonis" }), all);
  assert.deepEqual(recipeSequence(data, { slug: "adonis", from: "./?base=gin" }), all);
  const singleton = recipeSequence(data, { slug: "adonis", from: "./?q=Adonis" });
  assert.equal(singleton.length, 1);
  assert.equal(singleton[-1], undefined);
  assert.equal(singleton[1], undefined);
});

test("My bar groups remain separate and reflect current bottles", () => {
  const bar = new Set(["gin", "sweet-vermouth", "dry-vermouth", "campari"]);
  const { ready, oneAway } = whatCanIMake(data, bar);
  const away = bottleRecommendations(data, oneAway).flatMap(({ cocktails }) => cocktails);
  for (const [group, list] of [["ready", ready], ["away", away]]) {
    assert.ok(list.length);
    assert.deepEqual(recipeSequence(data, { slug: list[0].slug, from: "./?view=bar", group, bar }), list);
  }
});

test("My bar navigation honors pantry availability in every group", () => {
  const bar = new Set(["white-rum"]);
  const unavailable = new Set(["lime-juice"]);
  const results = whatCanIMake(data, bar, unavailable);
  const groups = {
    ready: results.ready,
    away: bottleRecommendations(data, results.oneAway).flatMap(({ cocktails }) => cocktails),
    pantry: results.pantryMissing.map(({ cocktail }) => cocktail),
  };
  for (const [group, list] of Object.entries(groups)) {
    assert.ok(list.length, group);
    assert.deepEqual(recipeSequence(data, {
      slug: list[0].slug, from: "./?view=bar", group, bar, unavailable,
    }), list, group);
  }
  assert.ok(groups.pantry.some((c) => c.slug === "daiquiri"));
});

test("swipe direction requires sufficient horizontal movement", () => {
  assert.equal(swipeDirection(-50, 0), 1);
  assert.equal(swipeDirection(50, 0), -1);
  for (const [dx, dy] of [[49, 0], [100, 100], [60, 40], [0, 100]]) assert.equal(swipeDirection(dx, dy), 0);
});

function fixture() {
  const handlers = {};
  const navigations = [];
  setupSwipe({ addEventListener: (type, fn) => { handlers[type] = fn; } }, (direction) => navigations.push(direction));
  const touch = (x, y = 0, identifier = 1) => ({ clientX: x, clientY: y, identifier });
  const emit = (type, touches, changedTouches = [], interactive = false) => handlers[type]({ touches, changedTouches, target: { closest: () => interactive } });
  return { emit, touch, navigations };
}

test("one gesture navigates once, with either direction", () => {
  const { emit, touch, navigations } = fixture();
  for (const end of [-80, 80]) {
    emit("touchstart", [touch(0)]);
    emit("touchend", [], [touch(end)]);
    emit("touchend", [], [touch(end)]);
  }
  assert.deepEqual(navigations, [1, -1]);
});

test("cancellation, multitouch, vertical scrolling, controls and mismatched fingers do not navigate", () => {
  for (const action of ["cancel", "multi", "vertical", "control", "mismatch"]) {
    const { emit, touch, navigations } = fixture();
    emit("touchstart", [touch(0)], [], action === "control");
    if (action === "cancel") emit("touchcancel", []);
    if (action === "multi") emit("touchstart", [touch(0), touch(1, 0, 2)]);
    if (action === "vertical") emit("touchmove", [touch(0, 60)]);
    emit("touchend", [], [touch(-100, 0, action === "mismatch" ? 2 : 1)]);
    assert.deepEqual(navigations, [], action);
  }
});
