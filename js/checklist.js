// Shared ingredient checklists for filters, bottles and pantry availability.
import { h } from "./dom.js";
import { ingredientGroups } from "./data.js";

export function ingredientChecklist(data, { include, checked = () => false, onChange, showCounts = true }) {
  const inputs = new Map();
  const groups = ingredientGroups(data, include).map(({ label, ids }) =>
    h("div", { class: "check-group" }, h("h3", {}, label), ids.map((id) => {
      const name = data.ingredients[id].name;
      const input = h("input", {
        type: "checkbox", value: id, checked: checked(id),
        onchange: (event) => onChange(id, event.target.checked),
      });
      inputs.set(id, input);
      return h("label", { class: "check", dataset: { name: name.toLocaleLowerCase() } },
        input, h("span", {}, name),
        showCounts ? h("span", { class: "n" }, String(data.usage.get(id))) : null);
    })));
  return { groups, inputs };
}

export function filterChecklist(groups, query) {
  const q = query.trim().toLocaleLowerCase();
  for (const group of groups) {
    let shown = 0;
    for (const label of group.querySelectorAll("label")) {
      const hit = !q || label.dataset.name.includes(q);
      label.hidden = !hit;
      shown += hit;
    }
    group.hidden = shown === 0;
  }
}
