// node --test tools/tests/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  prepare, parseState, stateToParams, emptyState, filterCocktails, facetCounts,
  whatCanIMake, related, sortCocktails,
} from "../../js/data.js";
import { fraction, formatAmount } from "../../js/units.js";

const data = prepare(JSON.parse(readFileSync(new URL("../../data/cocktails.json", import.meta.url), "utf8")));
const get = (slug) => data.bySlug.get(slug);
const slugs = (list) => list.map((c) => c.slug);
const query = (qs) => filterCocktails(data, parseState(new URLSearchParams(qs)));

test("every ingredient used is in the vocabulary", () => {
  for (const c of data.cocktails) for (const i of c.ingredients) assert.ok(data.ingredients[i.id], `${c.slug}: ${i.id}`);
});

test("base spirit and citrus are derived", () => {
  assert.deepEqual(get("daiquiri").base, ["rum"]);
  assert.deepEqual(get("daiquiri").citrus, ["lime"]);
  assert.deepEqual(get("vieux-carre").base, ["whiskey", "brandy"]);
  assert.deepEqual(get("vesper").base, ["gin"], "15 ml vodka is not a co-base");
  assert.deepEqual(get("negroni").citrus, []);
  assert.deepEqual(get("americano").base, ["none"]);
  assert.ok(get("paloma").citrus.includes("grapefruit"), "grapefruit soda counts");
});

test("lemon vs lime vs no citrus", () => {
  const lemon = query("citrus=lemon");
  assert.ok(lemon.every((c) => c.citrus.includes("lemon")));
  assert.ok(slugs(lemon).includes("sidecar") && !slugs(lemon).includes("daiquiri"));
  const none = query("citrus=none");
  assert.ok(slugs(none).includes("manhattan") && none.every((c) => c.citrus.length === 0));
});

test("facets AND together, values within a facet OR", () => {
  const ginLemon = slugs(query("base=gin&citrus=lemon"));
  assert.ok(ginLemon.includes("bees-knees") && !ginLemon.includes("gimlet") && !ginLemon.includes("sidecar"));
  const ginOrRum = query("base=gin,rum");
  assert.ok(ginOrRum.every((c) => c.base.some((b) => b === "gin" || b === "rum")));
});

test("ingredient filter: all vs any", () => {
  const all = slugs(query("ing=campari,sweet-vermouth"));
  assert.deepEqual(all.sort(), ["americano", "boulevardier", "negroni"]);
  const any = query("ing=campari,aperol&match=any");
  assert.ok(slugs(any).includes("jungle-bird") && slugs(any).includes("paper-plane"));
});

test("search matches name, ingredient and garnish words", () => {
  assert.deepEqual(slugs(query("q=corpse")), ["corpse-reviver-2"]);
  assert.ok(slugs(query("q=chartreuse")).includes("last-word"));
  assert.ok(slugs(query("q=nutmeg")).includes("brandy-alexander"));
  assert.deepEqual(query("q=zzzz"), []);
});

test("URL state round-trips and omits defaults", () => {
  const qs = "q=sour&base=gin,rum&citrus=lime&ing=lime-juice&match=any&sort=family";
  assert.equal(stateToParams(parseState(new URLSearchParams(qs))).toString(), new URLSearchParams(qs).toString());
  assert.equal(stateToParams(emptyState()).toString(), "");
});

test("facet counts ignore the facet's own selection", () => {
  const s = parseState(new URLSearchParams("base=gin"));
  const counts = facetCounts(data, s, "base");
  assert.equal(counts.get("rum"), query("base=rum").length);
});

test("sorting", () => {
  const sample = [get("martini"), get("daiquiri"), get("americano")];
  const names = slugs(sortCocktails(sample, "name", data));
  assert.deepEqual(names, ["americano", "daiquiri", "martini"]);
  assert.deepEqual(slugs(sample), ["martini", "daiquiri", "americano"], "sorting preserves the input order");
  const byBase = sortCocktails(data.cocktails, "base", data);
  assert.equal(byBase[0].base[0], "gin");
  assert.equal(byBase.at(-1).base[0], "none");
  for (const sort of ["toString", "constructor", "__proto__"]) {
    assert.equal(parseState(new URLSearchParams({ sort })).sort, "name", sort);
  }
});

test("my bar: pantry items are assumed, bottles are not", () => {
  const { ready, oneAway } = whatCanIMake(data, new Set(["white-rum"]));
  assert.ok(slugs(ready).includes("daiquiri") && slugs(ready).includes("mojito"));
  const pickford = oneAway.find((x) => x.cocktail.slug === "mary-pickford");
  assert.equal(pickford?.missing, "maraschino");
  assert.equal(whatCanIMake(data, new Set()).ready.length, 0);
  const mezcalada = whatCanIMake(data, new Set(["mezcal"])).oneAway
    .find((x) => x.cocktail.slug === "mezcalada");
  assert.equal(mezcalada?.missing, "lager", "beer must be owned rather than assumed on hand");
  assert.ok(slugs(whatCanIMake(data, new Set(["mezcal", "lager"])).ready).includes("mezcalada"));
});

test("related drinks share ingredients", () => {
  const r = slugs(related(get("negroni"), data));
  assert.ok(r.includes("boulevardier") && !r.includes("negroni"));
});

test("oz formatting rounds to eighths", () => {
  assert.equal(fraction(22.5 / 30), "¾");
  assert.equal(fraction(2), "2");
  assert.equal(fraction(45 / 30), "1½");
  assert.equal(formatAmount({ amount: 22.5, unit: "ml" }, "oz"), "¾ oz");
  assert.equal(formatAmount({ amount: 7.5, unit: "ml" }, "oz"), "¼ oz");
  assert.equal(formatAmount({ amount: 22.5, unit: "ml" }, "ml"), "22.5 ml");
  assert.equal(formatAmount({ amount: 2, unit: "dash" }), "2 dashes");
  assert.equal(formatAmount({ amount: 1, unit: "dash" }), "1 dash");
  assert.equal(formatAmount({ amount: 0.5, unit: "dash" }), "½ dash");
  assert.equal(formatAmount({ amount: 8, unit: "leaf" }), "8 leaves");
  assert.equal(formatAmount({ amount: 0.5, unit: "piece" }), "½");
  assert.equal(formatAmount({ amount: 1, unit: "top" }), "Top");
});
