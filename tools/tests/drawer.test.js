import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDrawer } from "../../js/dom.js";

// Minimal DOM boundary: exercise focus and modal state without a runtime dependency.
function fixture() {
  const doc = { activeElement: null };
  function element() {
    const listeners = new Map();
    const attrs = new Map();
    const classes = new Set();
    return {
      ownerDocument: doc, inert: false, hidden: false, disabled: false, tabIndex: 0,
      classList: {
        toggle(name, on) { on ? classes.add(name) : classes.delete(name); },
        contains(name) { return classes.has(name); },
      },
      setAttribute(name, value) { attrs.set(name, value); },
      removeAttribute(name) { attrs.delete(name); },
      getAttribute(name) { return attrs.get(name); },
      focus() { doc.activeElement = this; },
      getClientRects() { return this.hidden ? [] : [{}]; },
      addEventListener(type, handler) { listeners.set(type, handler); },
      emit(type, props = {}) {
        const event = { prevented: false, preventDefault() { this.prevented = true; }, ...props };
        listeners.get(type)?.(event);
        return event;
      },
    };
  }
  doc.documentElement = element();
  const [panel, trigger, backdrop, close, first, last, disabled, hidden] = Array.from({ length: 8 }, element);
  disabled.disabled = true;
  hidden.hidden = true;
  panel.querySelectorAll = () => [first, close, last, disabled, hidden];
  const background = [element(), element(), element()];
  background[2].inert = true;
  const desktop = element();
  desktop.matches = false;
  setupDrawer({ panel, trigger, backdrop, dismiss: [close, last], background, desktop });
  return { doc, panel, trigger, backdrop, close, first, last, background, desktop };
}

test("drawer makes the background inert and wraps Tab past visible enabled controls", () => {
  const f = fixture();
  f.trigger.emit("click");
  assert.equal(f.doc.activeElement, f.close);
  assert.ok(f.background.every((el) => el.inert));
  assert.equal(f.panel.getAttribute("role"), "dialog");
  assert.equal(f.panel.getAttribute("aria-modal"), "true");
  f.last.focus();
  assert.equal(f.panel.emit("keydown", { key: "Tab" }).prevented, true);
  assert.equal(f.doc.activeElement, f.first);
  assert.equal(f.panel.emit("keydown", { key: "Tab", shiftKey: true }).prevented, true);
  assert.equal(f.doc.activeElement, f.last);
  f.close.focus();
  assert.equal(f.panel.emit("keydown", { key: "Tab" }).prevented, false);
});

for (const action of ["close", "last", "backdrop", "Escape"]) {
  test(`${action} dismisses the drawer and restores background state and focus`, () => {
    const f = fixture();
    f.trigger.emit("click");
    if (action === "Escape") f.panel.emit("keydown", { key: "Escape" });
    else f[action].emit("click");
    assert.equal(f.doc.activeElement, f.trigger);
    assert.deepEqual(f.background.map((el) => el.inert), [false, false, true]);
    assert.equal(f.panel.getAttribute("role"), undefined);
    assert.equal(f.panel.getAttribute("aria-modal"), undefined);
    assert.equal(f.trigger.getAttribute("aria-expanded"), "false");
    assert.equal(f.backdrop.hidden, true);
    assert.equal(f.doc.documentElement.classList.contains("locked"), false);
  });
}

test("switching to desktop releases the modal and focuses the sidebar", () => {
  const f = fixture();
  f.trigger.emit("click");
  f.desktop.matches = true;
  f.desktop.emit("change");
  assert.equal(f.doc.activeElement, f.panel);
  assert.equal(f.panel.classList.contains("open"), false);
  assert.equal(f.doc.documentElement.classList.contains("locked"), false);
  assert.deepEqual(f.background.map((el) => el.inert), [false, false, true]);
  f.trigger.emit("click");
  assert.equal(f.panel.classList.contains("open"), false);
});
