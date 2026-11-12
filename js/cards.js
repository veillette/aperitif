import { h } from "./dom.js";
import { cardMeta, cardSpec } from "./data.js";

export function cocktailPhoto(c, { className, size, alt = "", lazy = false }) {
  return c.photo ? h("img", {
    class: className, src: c.photo, width: size, height: size, alt,
    decoding: "async", loading: lazy ? "lazy" : null,
    onerror: (event) => { event.currentTarget.hidden = true; },
  }) : null;
}

// Callers supply navigation context; all recipe cards share the same markup.
export function cocktailCard(c, data, { href, extra, actions } = {}) {
  const details = [
    h("h3", {}, c.name),
    h("p", { class: "meta" }, cardMeta(c, data)),
    h("p", { class: "spec" }, cardSpec(c, data)),
    extra,
  ];
  const photo = cocktailPhoto(c, { className: "card-photo", size: 68, lazy: true });
  const body = photo ? [h("div", { class: "card-content" }, photo, h("div", {}, details))] : details;
  if (!actions) return h("li", {}, h("a", { class: "card", href }, ...body));
  return h("li", {},
    h("div", { class: "card saved-card" },
      h("a", { class: "card-link", href }, ...body),
      actions));
}
