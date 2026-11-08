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

// A modal drawer on small screens; the panel becomes a normal sidebar on desktop.
export function setupDrawer({ panel, trigger, backdrop, dismiss, background, desktop }) {
  const doc = panel.ownerDocument;
  let open = false;
  let previousInert = [];

  function setOpen(next, restoreFocus = true) {
    if (next === open || (next && desktop.matches)) return;
    open = next;
    panel.classList.toggle("open", open);
    backdrop.hidden = !open;
    doc.documentElement.classList.toggle("locked", open);
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      previousInert = [...background].map((el) => [el, el.inert]);
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      dismiss[0].focus({ preventScroll: true });
      for (const [el] of previousInert) el.inert = true;
    } else {
      for (const [el, inert] of previousInert) el.inert = inert;
      previousInert = [];
      panel.removeAttribute("role");
      panel.removeAttribute("aria-modal");
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
  }

  trigger.addEventListener("click", () => setOpen(true));
  for (const el of [...dismiss, backdrop]) el.addEventListener("click", () => setOpen(false));
  panel.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      const controls = [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]')]
        .filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
      const first = controls[0] ?? panel;
      const last = controls.at(-1) ?? panel;
      if (!controls.length || (e.shiftKey ? doc.activeElement === first : doc.activeElement === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      }
    }
  });
  desktop.addEventListener("change", () => {
    if (desktop.matches && open) {
      setOpen(false, false);
      panel.focus({ preventScroll: true });
    }
  });
}

export function registerServiceWorker() {
  const local = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  if ("serviceWorker" in navigator && !local) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
