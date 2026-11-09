// Shared local recipe lists and accessible save controls.
import { h, store } from "./dom.js";
import { SAVED_LISTS } from "./data.js";

export function readSaved() {
  return Object.fromEntries(Object.keys(SAVED_LISTS).map((list) => {
    const value = store.get(`aperitif.${list}`, []);
    return [list, new Set(Array.isArray(value) ? value.filter((v) => typeof v === "string") : [])];
  }));
}

export function saveControls(cocktail, saved, onChange = () => {}) {
  return h("div", { class: "save-actions", role: "group", "aria-label": `Save ${cocktail.name}` },
    Object.entries(SAVED_LISTS).map(([list, label]) => h("button", {
      type: "button", class: "chip", "aria-pressed": String(saved[list].has(cocktail.slug)),
      "aria-label": `${label}: ${cocktail.name}`, dataset: { saveList: list, saveSlug: cocktail.slug },
      onclick: () => {
        const selected = saved[list];
        selected.has(cocktail.slug) ? selected.delete(cocktail.slug) : selected.add(cocktail.slug);
        store.set(`aperitif.${list}`, [...selected]);
        syncSaveControls(saved);
        onChange();
      },
    }, label)));
}

export function syncSaveControls(saved) {
  for (const button of document.querySelectorAll("[data-save-list]")) {
    button.setAttribute("aria-pressed", String(saved[button.dataset.saveList].has(button.dataset.saveSlug)));
  }
}
