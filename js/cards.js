import { h } from "./dom.js";
import { cardMeta, cardSpec } from "./data.js";

// Callers supply navigation context; all recipe cards share the same markup.
export function cocktailCard(c, data, { href, extra } = {}) {
  return h("li", {},
    h("a", { class: "card", href },
      h("h3", {}, c.name),
      h("p", { class: "meta" }, cardMeta(c, data)),
      h("p", { class: "spec" }, cardSpec(c, data)),
      extra));
}
