// Inventory controls and results for the My bar view.
import { h } from "./dom.js";
import { isBottle, whatCanIMake, bottleRecommendations } from "./data.js";
import { ingredientChecklist, filterChecklist } from "./checklist.js";
import { loadBar, saveBar as persistBar, loadPantry, savePantry as persistPantry } from "./preferences.js";

export function setupBarView({ data, card }) {
  const $ = (id) => document.getElementById(id);
  const bar = loadBar(data);
  const pantry = loadPantry(data);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function buildBottles() {
    const { groups } = ingredientChecklist(data, {
      include: (id) => isBottle(data, id),
      checked: (id) => bar.has(id),
      onChange: (id, checked) => {
        checked ? bar.add(id) : bar.delete(id);
        saveBar();
      },
    });
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
    persistBar(bar);
    renderBar();
  }

  function renderBar() {
    const { ready, oneAway, pantryMissing } = whatCanIMake(data, bar, pantry.enabled ? pantry.unavailable : new Set());
    const recommendations = bottleRecommendations(data, oneAway);
    $("bottle-count").textContent = `(${bar.size})`;
    $("ready-count").textContent = `(${ready.length})`;
    $("away-count").textContent = `(${recommendations.length})`;
    const none = (text) => [h("li", { class: "empty" }, text)];
    $("ready").replaceChildren(...(ready.length
      ? ready.map((c) => card(c, null, "ready"))
      : none(bar.size ? "Nothing ready. Check the pantry and bottle suggestions below." : "Tick a few bottles to start.")));
    $("away").replaceChildren(...(recommendations.length
      ? recommendations.map(({ id, cocktails }) => h("li", {},
          h("details", { class: "recommendation" },
            h("summary", {}, h("span", {}, data.ingredients[id].name),
              h("span", { class: "muted" }, `Unlocks ${plural(cocktails.length, "drink")}`)),
            h("ol", { class: "cards" }, cocktails.map((c) => card(c, null, "away"))))))
      : none("No single bottle unlocks another drink with your current pantry.")));
    $("pantry-missing-section").hidden = !pantryMissing.length;
    $("pantry-missing-count").textContent = `(${pantryMissing.length})`;
    $("pantry-missing").replaceChildren(...pantryMissing.map(({ cocktail, missing }) =>
      card(cocktail, h("p", { class: "need" }, `Need: ${missing.map((id) => data.ingredients[id].name).join(", ")}`), "pantry")));
  }

  function buildPantry() {
    $("track-pantry").checked = pantry.enabled;
    $("pantry-options").hidden = !pantry.enabled;
    const { groups } = ingredientChecklist(data, {
      include: (id) => !isBottle(data, id),
      checked: (id) => !pantry.unavailable.has(id),
      showCounts: false,
      onChange: (id, checked) => {
        checked ? pantry.unavailable.delete(id) : pantry.unavailable.add(id);
        savePantry();
      },
    });
    $("pantry-list").replaceChildren(...groups);
    $("pantry-q").addEventListener("input", (e) => filterChecklist(groups, e.target.value));
    $("track-pantry").addEventListener("change", (e) => {
      pantry.enabled = e.target.checked;
      $("pantry-options").hidden = !pantry.enabled;
      savePantry();
    });
  }

  function savePantry() {
    persistPantry(pantry);
    renderBar();
  }

  buildBottles();
  buildPantry();
  return { render: renderBar };
}
