import { store } from "./dom.js";
import { isBottle } from "./data.js";

const BAR_KEY = "aperitif.bar";
const UNIT_KEY = "aperitif.unit";

export function loadBar(data) {
  const saved = store.get(BAR_KEY, []);
  return new Set((Array.isArray(saved) ? saved : []).filter((id) =>
    typeof id === "string" && Object.hasOwn(data.ingredients, id) && isBottle(data, id)));
}

export function saveBar(bar) {
  store.set(BAR_KEY, [...bar]);
}

export function loadUnit() {
  return store.get(UNIT_KEY, "ml") === "oz" ? "oz" : "ml";
}

export function saveUnit(unit) {
  store.set(UNIT_KEY, unit === "oz" ? "oz" : "ml");
}
