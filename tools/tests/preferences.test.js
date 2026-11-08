import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepare, bottleGroups, isBottle, whatCanIMake } from "../../js/data.js";
import { loadBar, saveBar, loadUnit, saveUnit } from "../../js/preferences.js";

const data = prepare(JSON.parse(readFileSync(new URL("../../data/cocktails.json", import.meta.url), "utf8")));

test("checklist covers every used bottle, including beer, and excludes pantry ingredients", () => {
  const groups = bottleGroups(data);
  const ids = groups.flatMap((g) => g.ids);
  assert.deepEqual(new Set(ids), new Set([...data.usage.keys()].filter((id) => isBottle(data, id))));
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.includes("lager") && ids.includes("stout"));
  for (const slug of ["mezcalada", "stout-flip"]) {
    const drink = data.bySlug.get(slug);
    const bar = new Set(drink.ingredientIds.filter((id) => ids.includes(id)));
    assert.ok(whatCanIMake(data, bar).ready.includes(drink));
  }
});

test("preferences tolerate invalid JSON, wrong shapes, stale IDs and blocked storage", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let saved;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem() { return saved; },
    setItem(key, value) { saved = value; },
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });
  for (const value of [null, "{", "null", "{}", "42", '"gin"', "true"]) {
    saved = value;
    assert.deepEqual([...loadBar(data)], []);
    assert.equal(loadUnit(), "ml");
  }
  saved = JSON.stringify(["lager", "stout", "lager", "lime-juice", "removed", "__proto__", null, 1, {}]);
  assert.deepEqual([...loadBar(data)], ["lager", "stout"]);
  saveBar(new Set(["lager"]));
  assert.deepEqual([...loadBar(data)], ["lager"]);
  saveUnit("oz");
  assert.equal(loadUnit(), "oz");
  saveUnit("invalid");
  assert.equal(loadUnit(), "ml");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  assert.deepEqual([...loadBar(data)], []);
  assert.equal(loadUnit(), "ml");
  assert.doesNotThrow(() => saveBar(new Set(["lager"])));
  assert.doesNotThrow(() => saveUnit("oz"));
});
