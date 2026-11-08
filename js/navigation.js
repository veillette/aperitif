import { emptyState, filterCocktails, parseState, whatCanIMake } from "./data.js";

// Context is a relative index URL within the current deployment directory.
export function browseContext(value, pageURL) {
  if (!value) return null;
  try {
    const base = new URL("./", pageURL);
    const url = new URL(value, base);
    if (url.origin !== base.origin || ![base.pathname, `${base.pathname}index.html`].includes(url.pathname)
        || url.username || url.password) return null;
    return `./${url.search}`;
  } catch { return null; }
}

export function recipeURL(slug, from, group) {
  const params = new URLSearchParams({ c: slug });
  if (from) params.set("from", from);
  if (from && group) params.set("group", group);
  return `recipe.html?${params}`;
}

export function recipeSequence(data, slug, from, group, bar) {
  const all = () => filterCocktails(data, emptyState());
  if (!from) return all();
  const params = new URLSearchParams(from.split("?")[1] ?? "");
  let list;
  if (params.get("view") === "bar") {
    const results = whatCanIMake(data, bar);
    list = group === "ready" ? results.ready
      : group === "away" ? results.oneAway.map(({ cocktail }) => cocktail) : [];
  } else list = filterCocktails(data, parseState(params));
  return list.some((c) => c.slug === slug) ? list : all();
}

export function swipeDirection(dx, dy) {
  return Math.abs(dx) >= 50 && Math.abs(dx) > 1.5 * Math.abs(dy) ? (dx < 0 ? 1 : -1) : 0;
}

export function setupSwipe(element, navigate) {
  let start;
  const reset = () => { start = null; };
  element.addEventListener("touchstart", (event) => {
    reset();
    if (event.touches.length !== 1 || event.target.closest('a, button, input, select, textarea, label, summary, [contenteditable], [role="button"]')) return;
    const touch = event.touches[0];
    start = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  element.addEventListener("touchmove", (event) => {
    if (!start) return;
    const touch = event.touches[0];
    if (event.touches.length !== 1 || touch.identifier !== start.id
        || Math.abs(touch.clientY - start.y) > Math.abs(touch.clientX - start.x)) reset();
  }, { passive: true });
  element.addEventListener("touchcancel", reset, { passive: true });
  element.addEventListener("touchend", (event) => {
    const origin = start;
    reset();
    if (!origin || event.touches.length) return;
    const touch = [...event.changedTouches].find((t) => t.identifier === origin.id);
    if (!touch) return;
    const direction = swipeDirection(touch.clientX - origin.x, touch.clientY - origin.y);
    if (direction) navigate(direction);
  }, { passive: true });
}
