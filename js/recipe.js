// Recipe page: recipe.html?c=<slug>
import { h, registerServiceWorker } from "./dom.js";
import { loadData, related, cardMeta, cardSpec } from "./data.js";
import { loadBar, loadUnit, saveUnit } from "./preferences.js";
import { cocktailCard } from "./cards.js";
import { formatAmount } from "./units.js";
import { browseContext, recipeURL, recipeSequence, setupSwipe } from "./navigation.js";
import { readSaved, saveControls, syncSaveControls } from "./saved.js";

const params = new URLSearchParams(location.search);
const from = browseContext(params.get("from"), location.href);
const group = ["ready", "away"].includes(params.get("group")) ? params.get("group") : null;
let sequence = [];
let saved = readSaved();

const $ = (id) => document.getElementById(id);
const index = (params) => `./?${new URLSearchParams(params)}`;

let data;
let cocktail;
let unit = loadUnit();

function specRows() {
  return cocktail.ingredients.map((ing) => {
    const name = data.ingredients[ing.id].name;
    return h("tr", {},
      h("td", { class: "amount" }, formatAmount(ing, unit)),
      h("td", { class: "item" },
        h("a", { href: index({ ing: ing.id }) }, name),
        ing.note ? h("span", { class: "note" }, `, ${ing.note}`) : null));
  });
}

function render() {
  const c = cocktail;
  const v = data.vocab;
  document.title = `${c.name} · Aperitif`;
  document.querySelector('meta[name="description"]').content = `${c.name}: ${cardSpec(c, data)}.`;

  const service = [
    ["Method", v.method[c.method]],
    ["Glass", v.glass[c.glass]],
    ["Ice", v.ice[c.ice]],
    c.garnish && ["Garnish", c.garnish],
  ].filter(Boolean);

  const more = [
    ...c.base.filter((b) => b !== "none").map((b) => [`${v.spirit[b]} drinks`, { base: b }]),
    [`${v.family[c.family]} drinks`, { family: c.family }],
    ...c.citrus.map((ci) => [`Drinks with ${v.citrus[ci].toLowerCase()}`, { citrus: ci }]),
  ];

  const others = related(c, data);

  const position = sequence.findIndex((o) => o.slug === c.slug);
  const neighbor = (offset, label) => {
    const drink = sequence[position + offset];
    return drink
      ? h("a", { href: recipeURL(drink.slug, from, group), rel: offset < 0 ? "prev" : "next" }, `${label}: ${drink.name}`)
      : h("span", { "aria-disabled": "true" }, label);
  };

  $("recipe").replaceChildren(
    h("article", { class: "recipe" },
      h("h1", {}, c.name),
      saveControls(c, saved),
      h("p", { class: "meta" }, cardMeta(c, data)),
      h("table", { class: "spec" }, h("caption", { class: "visually-hidden" }, "Ingredients"), h("tbody", { id: "spec" }, specRows())),
      h("dl", { class: "service" }, service.map(([k, val]) => h("div", {}, h("dt", {}, k), h("dd", {}, val)))),
      c.notes ? h("p", { class: "notes" }, c.notes) : null,
      c.tags.length
        ? h("ul", { class: "tags", "aria-label": "Tags" }, c.tags.map((t) => h("li", {}, h("a", { class: "chip", href: index({ tag: t }) }, t))))
        : null,
      h("nav", { class: "more", "aria-label": "Similar drinks" },
        more.map(([label, params]) => h("a", { class: "chip", href: index(params) }, `${label} →`))),
    ),
    h("nav", { class: "recipe-navigation", "aria-label": "Recipe navigation" },
      neighbor(-1, "← Previous"), neighbor(1, "Next →")),
    h("p", { class: "swipe-hint" }, "Swipe left for next · right for previous"),
    others.length
      ? h("section", { class: "related" }, h("h2", {}, "Shares ingredients with"),
          h("ol", { class: "cards" }, others.map((o) =>
            cocktailCard(o, data, {
              href: recipeURL(o.slug, from, group),
              actions: saveControls(o, saved),
            }))))
      : null,
  );
}

function setUnit(next) {
  unit = next;
  saveUnit(unit);
  for (const btn of document.querySelectorAll("[data-unit]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.unit === unit));
  }
  if (cocktail) $("spec").replaceChildren(...specRows());
}

async function main() {
  registerServiceWorker();
  for (const btn of document.querySelectorAll("[data-unit]")) {
    btn.addEventListener("click", () => setUnit(btn.dataset.unit));
  }
  setUnit(unit);

  if (from) $("back").href = from;

  try {
    data = await loadData();
  } catch (err) {
    $("recipe").replaceChildren(h("p", { class: "empty" }, `Could not load recipes (${err.message}).`));
    return;
  }
  const slug = new URLSearchParams(location.search).get("c");
  cocktail = data.bySlug.get(slug);
  if (!cocktail) {
    document.title = "Not found · Aperitif";
    $("recipe").replaceChildren(h("p", { class: "empty" }, "No such drink. ", h("a", { href: "./" }, "Browse all drinks")));
    return;
  }
  sequence = recipeSequence(data, cocktail.slug, from, group, loadBar(data), saved);
  render();
  setupSwipe($("recipe"), (direction) => {
    const position = sequence.findIndex((c) => c.slug === cocktail.slug);
    const next = sequence[position + direction];
    if (next) location.assign(recipeURL(next.slug, from, group));
  });
  const refreshSaved = () => { saved = readSaved(); render(); syncSaveControls(saved); };
  addEventListener("pageshow", refreshSaved);
  addEventListener("storage", refreshSaved);
}

main();
