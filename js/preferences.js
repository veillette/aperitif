import { store } from "./dom.js";
import { isBottle } from "./data.js";

const BAR_KEY = "aperitif.bar";
const UNIT_KEY = "aperitif.unit";
const PANTRY_KEY = "aperitif.pantry";

function ingredientSet(value, data, include) {
  return new Set((Array.isArray(value) ? value : []).filter((id) =>
    typeof id === "string" && Object.hasOwn(data.ingredients, id) && include(id)));
}

export function loadBar(data) {
  return ingredientSet(store.get(BAR_KEY, []), data, (id) => isBottle(data, id));
}

export function saveBar(bar) {
  store.set(BAR_KEY, [...bar]);
}

export function loadPantry(data) {
  const saved = store.get(PANTRY_KEY, {});
  return {
    enabled: saved?.enabled === true,
    unavailable: ingredientSet(saved?.unavailable, data, (id) => !isBottle(data, id)),
  };
}

export function savePantry({ enabled, unavailable }) {
  store.set(PANTRY_KEY, { enabled: enabled === true, unavailable: [...unavailable] });
}

export function loadUnit() {
  return store.get(UNIT_KEY, "ml") === "oz" ? "oz" : "ml";
}

export function saveUnit(unit) {
  store.set(UNIT_KEY, unit === "oz" ? "oz" : "ml");
}
