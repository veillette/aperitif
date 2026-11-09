import { h } from "./dom.js";
import { cardMeta, cardSpec } from "./data.js";

// Callers supply navigation context; all recipe cards share the same markup.
export function cocktailCard(c, data, { href, extra, actions } = {}) {
  const body = [
    h("h3", {}, c.name),
    h("p", { class: "meta" }, cardMeta(c, data)),
    h("p", { class: "spec" }, cardSpec(c, data)),
    extra,
  ];
  if (!actions) return h("li", {}, h("a", { class: "card", href }, ...body));
  return h("li", {},
    h("div", { class: "card saved-card" },
      h("a", { class: "card-link", href }, ...body),
      actions));
}
