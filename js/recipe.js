// Recipe page: recipe.html?c=<slug>
import { h, store, registerServiceWorker } from "./dom.js";
import { loadData, related, cardMeta, cardSpec } from "./data.js";
import { formatAmount } from "./units.js";

const UNIT_KEY = "aperitif.unit";
const $ = (id) => document.getElementById(id);
const index = (params) => `./?${new URLSearchParams(params)}`;

let data;
let cocktail;
let unit = store.get(UNIT_KEY, "ml") === "oz" ? "oz" : "ml";

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

  $("recipe").replaceChildren(
    h("article", { class: "recipe" },
      h("h1", {}, c.name),
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
    others.length
      ? h("section", { class: "related" }, h("h2", {}, "Shares ingredients with"),
          h("ol", { class: "cards" }, others.map((o) =>
            h("li", {}, h("a", { class: "card", href: `recipe.html?c=${encodeURIComponent(o.slug)}` },
              h("h3", {}, o.name), h("p", { class: "meta" }, cardMeta(o, data)), h("p", { class: "spec" }, cardSpec(o, data)))))))
      : null,
  );
}

function setUnit(next) {
  unit = next;
  store.set(UNIT_KEY, unit);
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

  // Back to the filtered list the reader came from, when there is one.
  const ref = document.referrer && new URL(document.referrer);
  if (ref && ref.origin === location.origin && !ref.pathname.endsWith("recipe.html")) {
    $("back").href = ref.href;
  }

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
  render();
}

main();
