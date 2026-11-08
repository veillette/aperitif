// Tiny DOM builder. Text is always set as text, never parsed as HTML.
//   h("a", { href: "x", class: "card" }, "Label", h("span", {}, "more"))
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "dataset") Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

// localStorage can be missing or throw (private mode, blocked storage).
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* not persisted; the page still works */
    }
  },
};

export function registerServiceWorker() {
  const local = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  if ("serviceWorker" in navigator && !local) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
