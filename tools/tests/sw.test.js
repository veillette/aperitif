import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("activation removes only old Aperitif caches and claims clients", async () => {
  const handlers = {};
  const deleted = [];
  let claimed = false;
  vm.runInNewContext(readFileSync(new URL("../../sw.js", import.meta.url), "utf8"), {
    self: {
      addEventListener(type, handler) { handlers[type] = handler; },
      clients: { claim() { claimed = true; } },
    },
    caches: {
      async keys() { return ["aperitif-dev", "aperitif-old", "other-app-offline"]; },
      async delete(key) { deleted.push(key); },
    },
  });
  let activation;
  handlers.activate({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ["aperitif-old"]);
  assert.equal(claimed, true);
});
