// Loading, filtering and sorting. Everything except loadData() is pure, so the
// tests in tools/tests can run it under Node.

// Facets shown as chip groups. Within a facet, values are OR'ed; facets are AND'ed.
export const FACETS = ["base", "citrus", "family", "method", "glass", "tag"];
// Ingredient categories assumed to be on hand in "My bar" (only bottles are tracked).
export const PANTRY = new Set(["citrus", "juice", "sweetener", "dairy-egg", "mixer", "other"]);
export const SORTS = { name: "Name", base: "Base spirit", family: "Family" };

let cache;
export function loadData(url = "data/cocktails.json") {
  cache ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json().then(prepare);
  });
  return cache;
}

// Adds lookups and a search haystack to the raw JSON.
export function prepare(raw) {
  const data = { ...raw, bySlug: new Map(), usage: new Map() };
  for (const c of raw.cocktails) {
    data.bySlug.set(c.slug, c);
    c.ingredientIds = c.ingredients.map((i) => i.id);
    for (const id of new Set(c.ingredientIds)) data.usage.set(id, (data.usage.get(id) ?? 0) + 1);
    c.haystack = [c.name, c.garnish ?? "", ...c.tags, ...c.ingredientIds.map((id) => raw.ingredients[id].name)]
      .join(" ")
      .toLocaleLowerCase();
  }
  // Tags, most used first.
  const tagCount = new Map();
  for (const c of raw.cocktails) for (const t of c.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  data.tags = [...tagCount.keys()].sort((a, b) => tagCount.get(b) - tagCount.get(a) || a.localeCompare(b));
  return data;
}

// Values a cocktail has for a facet. Citrus-free drinks count as "none".
export function facetValues(c, facet) {
  switch (facet) {
    case "base": return c.base;
    case "citrus": return c.citrus.length ? c.citrus : ["none"];
    case "tag": return c.tags;
    default: return [c[facet]];
  }
}

// Options for a facet, in display order: [value, label].
export function facetOptions(data, facet) {
  if (facet === "tag") return data.tags.map((t) => [t, t]);
  const vocab = data.vocab[{ base: "spirit" }[facet] ?? facet];
  const used = new Set(data.cocktails.flatMap((c) => facetValues(c, facet)));
  return Object.entries(vocab).filter(([v]) => used.has(v));
}

export function emptyState() {
  return { q: "", ing: [], match: "all", sort: "name", ...Object.fromEntries(FACETS.map((f) => [f, []])) };
}

export function parseState(params) {
  const s = emptyState();
  const list = (k) => (params.get(k) ?? "").split(",").filter(Boolean);
  s.q = params.get("q") ?? "";
  for (const f of FACETS) s[f] = list(f);
  s.ing = list("ing");
  if (params.get("match") === "any") s.match = "any";
  if (params.get("sort") in SORTS) s.sort = params.get("sort");
  return s;
}

// Only non-default values are written, so URLs stay short.
export function stateToParams(s) {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set("q", s.q.trim());
  for (const f of FACETS) if (s[f].length) p.set(f, s[f].join(","));
  if (s.ing.length) p.set("ing", s.ing.join(","));
  if (s.match === "any" && s.ing.length) p.set("match", "any");
  if (s.sort !== "name") p.set("sort", s.sort);
  return p;
}

export function activeCount(s) {
  return FACETS.reduce((n, f) => n + s[f].length, 0) + s.ing.length + (s.q.trim() ? 1 : 0);
}

export function matches(c, s) {
  for (const f of FACETS) {
    if (s[f].length && !facetValues(c, f).some((v) => s[f].includes(v))) return false;
  }
  if (s.ing.length) {
    const has = (id) => c.ingredientIds.includes(id);
    if (s.match === "any" ? !s.ing.some(has) : !s.ing.every(has)) return false;
  }
  const words = s.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => c.haystack.includes(w));
}

export function sortCocktails(list, sort, data) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const rankBy = (vocab, value) => {
    const order = Object.keys(vocab);
    return (c) => order.indexOf(value(c));
  };
  const rank = {
    base: rankBy(data.vocab.spirit, (c) => c.base[0]),
    family: rankBy(data.vocab.family, (c) => c.family),
  }[sort];
  return [...list].sort(rank ? (a, b) => rank(a) - rank(b) || byName(a, b) : byName);
}

export function filterCocktails(data, s) {
  return sortCocktails(data.cocktails.filter((c) => matches(c, s)), s.sort, data);
}

// How many drinks each facet value would show, given every other active filter.
export function facetCounts(data, s, facet) {
  const others = { ...s, [facet]: [] };
  const counts = new Map();
  for (const c of data.cocktails) {
    if (!matches(c, others)) continue;
    for (const v of new Set(facetValues(c, facet))) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

export const isBottle = (data, id) => !PANTRY.has(data.ingredients[id].category);

// Bottles a drink needs that are not in the bar.
export function missingBottles(c, bar, data) {
  return [...new Set(c.ingredientIds)].filter((id) => isBottle(data, id) && !bar.has(id));
}

// { ready: [...], oneAway: [{ cocktail, missing }] }, both sorted by name.
export function whatCanIMake(data, bar) {
  const ready = [];
  const oneAway = [];
  for (const c of data.cocktails) {
    const missing = missingBottles(c, bar, data);
    if (missing.length === 0) ready.push(c);
    else if (missing.length === 1) oneAway.push({ cocktail: c, missing: missing[0] });
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  ready.sort(byName);
  oneAway.sort((a, b) => byName(a.cocktail, b.cocktail));
  return { ready, oneAway };
}

// Drinks sharing the most ingredients (Jaccard), excluding the drink itself.
export function related(c, data, n = 4) {
  const mine = new Set(c.ingredientIds);
  return data.cocktails
    .filter((o) => o !== c)
    .map((o) => {
      const theirs = new Set(o.ingredientIds);
      const shared = [...mine].filter((id) => theirs.has(id)).length;
      return { o, score: shared / (mine.size + theirs.size - shared) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.o.name.localeCompare(b.o.name))
    .slice(0, n)
    .map((x) => x.o);
}

// Card subtitle: "Whiskey · Stir · Coupe", or the family when there is no base spirit.
export function cardMeta(c, data) {
  const base = c.base[0] === "none" ? data.vocab.family[c.family] : c.base.map((b) => data.vocab.spirit[b]).join(" & ");
  // Set drops repeats like "Highball · Build · Highball".
  return [...new Set([base, data.vocab.method[c.method], data.vocab.glass[c.glass]])].join(" · ");
}

export function cardSpec(c, data) {
  return c.ingredients.map((i) => data.ingredients[i.id].name).join(" · ");
}
