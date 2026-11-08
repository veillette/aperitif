// Index page: the filterable recipe list and the "My bar" view.
import { h, store, registerServiceWorker } from "./dom.js";
import {
  FACETS, SORTS, loadData, parseState, stateToParams, emptyState, activeCount,
  filterCocktails, facetOptions, facetCounts, isBottle, whatCanIMake, cardMeta, cardSpec,
} from "./data.js";

const FACET_LABELS = {
  base: "Base spirit", citrus: "Citrus", family: "Family", method: "Method", glass: "Glass", tag: "Tags",
};
const BAR_KEY = "aperitif.bar";
const $ = (id) => document.getElementById(id);

let data;
let state;
const chipRefs = {}; // facet -> Map(value -> button)
const ingRefs = new Map(); // ingredient id -> checkbox
let bar = new Set(store.get(BAR_KEY, []));

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function card(c, extra) {
  return h("li", {},
    h("a", { class: "card", href: `recipe.html?c=${encodeURIComponent(c.slug)}` },
      h("h3", {}, c.name),
      h("p", { class: "meta" }, cardMeta(c, data)),
      h("p", { class: "spec" }, cardSpec(c, data)),
      extra,
    ),
  );
}

// ── Filters ────────────────────────────────────────────────────────────────

function toggle(list, value) {
  const i = list.indexOf(value);
  if (i === -1) list.push(value);
  else list.splice(i, 1);
}

function buildFacets() {
  const root = $("facets");
  for (const facet of FACETS) {
    const options = facetOptions(data, facet);
    if (options.length < 2) continue;
    const refs = new Map();
    const chips = options.map(([value, label]) => {
      const btn = h("button", {
        type: "button", class: "chip", "aria-pressed": "false",
        onclick: () => { toggle(state[facet], value); update(); },
      }, label, h("span", { class: "n" }));
      refs.set(value, btn);
      return btn;
    });
    chipRefs[facet] = refs;
    root.append(h("fieldset", { class: "facet" }, h("legend", {}, FACET_LABELS[facet]), h("div", { class: "chips" }, chips)));
  }

  // Ingredients: a searchable checklist grouped by category.
  const matchBtns = ["all", "any"].map((m) =>
    h("button", {
      type: "button", class: "seg", dataset: { match: m }, "aria-pressed": "false",
      onclick: () => { state.match = m; update(); },
    }, m === "all" ? "All of" : "Any of"));
  const find = h("input", {
    type: "search", class: "ing-find", placeholder: "Find an ingredient…", autocomplete: "off",
    "aria-label": "Find an ingredient",
    oninput: (e) => filterChecklist(groups, e.target.value),
  });
  const groups = Object.entries(data.vocab.category).map(([cat, label]) => {
    const ids = Object.keys(data.ingredients)
      .filter((id) => data.ingredients[id].category === cat && data.usage.has(id))
      .sort((a, b) => data.ingredients[a].name.localeCompare(data.ingredients[b].name));
    if (!ids.length) return null;
    const items = ids.map((id) => {
      const box = h("input", {
        type: "checkbox", value: id,
        onchange: () => { toggle(state.ing, id); update(); },
      });
      ingRefs.set(id, box);
      return h("label", { class: "check", dataset: { name: data.ingredients[id].name.toLocaleLowerCase() } },
        box, h("span", {}, data.ingredients[id].name), h("span", { class: "n" }, String(data.usage.get(id))));
    });
    return h("div", { class: "check-group" }, h("h3", {}, label), items);
  }).filter(Boolean);

  root.append(h("fieldset", { class: "facet" },
    h("legend", {}, "Ingredients"),
    h("div", { class: "segmented", role: "group", "aria-label": "Match" }, matchBtns),
    find,
    h("div", { class: "checklist" }, groups),
  ));
}

function filterChecklist(groups, query) {
  const q = query.trim().toLocaleLowerCase();
  for (const group of groups) {
    let shown = 0;
    for (const label of group.querySelectorAll("label")) {
      const hit = !q || label.dataset.name.includes(q);
      label.hidden = !hit;
      shown += hit;
    }
    group.hidden = shown === 0;
  }
}

function syncFacets() {
  for (const [facet, refs] of Object.entries(chipRefs)) {
    const counts = facetCounts(data, state, facet);
    for (const [value, btn] of refs) {
      const on = state[facet].includes(value);
      const n = counts.get(value) ?? 0;
      btn.setAttribute("aria-pressed", String(on));
      btn.querySelector(".n").textContent = n;
      btn.disabled = !on && n === 0;
    }
  }
  for (const [id, box] of ingRefs) box.checked = state.ing.includes(id);
  for (const btn of document.querySelectorAll(".seg")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.match === state.match));
  }
}

function renderActive() {
  const chip = (label, onRemove) =>
    h("button", { type: "button", class: "chip active", "aria-label": `Remove ${label}`, onclick: onRemove }, label, " ✕");
  const chips = [];
  if (state.q.trim()) chips.push(chip(`“${state.q.trim()}”`, () => { state.q = ""; $("q").value = ""; update(); }));
  for (const facet of FACETS) {
    for (const value of state[facet]) {
      const label = facetOptions(data, facet).find(([v]) => v === value)?.[1] ?? value;
      chips.push(chip(label, () => { toggle(state[facet], value); update(); }));
    }
  }
  for (const id of state.ing) {
    chips.push(chip(data.ingredients[id]?.name ?? id, () => { toggle(state.ing, id); update(); }));
  }
  if (chips.length > 1) chips.push(h("button", { type: "button", class: "link-btn", onclick: clearAll }, "Clear all"));
  $("active").replaceChildren(...chips);
}

function clearAll() {
  state = { ...emptyState(), sort: state.sort };
  $("q").value = "";
  update();
}

function update() {
  const results = filterCocktails(data, state);
  const n = activeCount(state);
  $("count").textContent = plural(results.length, "drink");
  $("show-results").textContent = `Show ${plural(results.length, "drink")}`;
  $("filter-badge").hidden = n === 0;
  $("filter-badge").textContent = n;
  $("list").replaceChildren(...(results.length
    ? results.map((c) => card(c))
    : [h("li", { class: "empty" }, "No drinks match these filters. ",
        h("button", { type: "button", class: "link-btn", onclick: clearAll }, "Clear filters"))]));
  syncFacets();
  renderActive();
  const params = stateToParams(state);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

// ── Mobile filter drawer ───────────────────────────────────────────────────

function setDrawer(open) {
  $("filters").classList.toggle("open", open);
  $("backdrop").hidden = !open;
  document.documentElement.classList.toggle("locked", open);
  $("open-filters").setAttribute("aria-expanded", String(open));
  (open ? $("close-filters") : $("open-filters")).focus({ preventScroll: true });
}

// ── My bar ─────────────────────────────────────────────────────────────────

function buildBottles() {
  const cats = ["spirit", "liqueur", "fortified-wine", "wine", "bitters"];
  const groups = cats.map((cat) => {
    const ids = [...data.usage.keys()]
      .filter((id) => data.ingredients[id].category === cat && isBottle(data, id))
      .sort((a, b) => data.ingredients[a].name.localeCompare(data.ingredients[b].name));
    if (!ids.length) return null;
    return h("div", { class: "check-group" }, h("h3", {}, data.vocab.category[cat]),
      ids.map((id) => h("label", { class: "check", dataset: { name: data.ingredients[id].name.toLocaleLowerCase() } },
        h("input", {
          type: "checkbox", value: id, checked: bar.has(id),
          onchange: (e) => { e.target.checked ? bar.add(id) : bar.delete(id); saveBar(); },
        }),
        h("span", {}, data.ingredients[id].name),
        h("span", { class: "n" }, String(data.usage.get(id))))));
  }).filter(Boolean);
  $("bottle-list").replaceChildren(...groups);
  $("bottle-q").addEventListener("input", (e) => filterChecklist(groups, e.target.value));
  $("bottles-clear").addEventListener("click", () => {
    bar.clear();
    for (const box of $("bottle-list").querySelectorAll("input")) box.checked = false;
    saveBar();
  });
  // Collapse the checklist on phones once a bar is set up, so results come first.
  if (bar.size && matchMedia("(max-width: 1023px)").matches) $("bottles").open = false;
}

function saveBar() {
  store.set(BAR_KEY, [...bar]);
  renderBar();
}

function renderBar() {
  const { ready, oneAway } = whatCanIMake(data, bar);
  $("bottle-count").textContent = `(${bar.size})`;
  $("ready-count").textContent = `(${ready.length})`;
  $("away-count").textContent = `(${oneAway.length})`;
  const none = (text) => [h("li", { class: "empty" }, text)];
  $("ready").replaceChildren(...(ready.length ? ready.map((c) => card(c)) : none(bar.size ? "Nothing yet. Check the list below for what to buy next." : "Tick a few bottles to start.")));
  $("away").replaceChildren(...(oneAway.length
    ? oneAway.map(({ cocktail, missing }) => card(cocktail, h("p", { class: "need" }, `Need: ${data.ingredients[missing].name}`)))
    : none("—")));
}

// ── Views ──────────────────────────────────────────────────────────────────

function showView() {
  const view = new URLSearchParams(location.search).get("view") === "bar" ? "bar" : "recipes";
  for (const el of document.querySelectorAll("[data-for]")) el.hidden = el.dataset.for !== view;
  for (const a of document.querySelectorAll(".views a")) {
    if (a.dataset.view === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (view === "bar") renderBar();
  else {
    state = parseState(new URLSearchParams(location.search));
    $("q").value = state.q;
    $("sort").value = state.sort;
    update();
  }
}

async function main() {
  registerServiceWorker();
  try {
    data = await loadData();
  } catch (err) {
    $("list").replaceChildren(h("li", { class: "empty" }, `Could not load recipes (${err.message}).`));
    return;
  }
  state = parseState(new URLSearchParams(location.search));
  buildFacets();
  buildBottles();
  $("sort").replaceChildren(...Object.entries(SORTS).map(([v, label]) => h("option", { value: v }, `Sort: ${label}`)));
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });
  $("q").addEventListener("input", (e) => { state.q = e.target.value; update(); });
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  $("clear-all").addEventListener("click", clearAll);
  $("open-filters").addEventListener("click", () => setDrawer(true));
  $("close-filters").addEventListener("click", () => setDrawer(false));
  $("show-results").addEventListener("click", () => setDrawer(false));
  $("backdrop").addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("filters").classList.contains("open")) setDrawer(false);
  });
  for (const a of document.querySelectorAll(".views a")) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      history.pushState(null, "", a.getAttribute("href"));
      showView();
      scrollTo(0, 0);
    });
  }
  addEventListener("popstate", showView);
  showView();
}

main();
