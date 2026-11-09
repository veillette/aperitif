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

// Runs sw.js against fake Cache Storage and fetch.
function worker({ cached, network }) {
  const handlers = {};
  const stored = new Map();
  const added = [];
  const cache = {
    async addAll(requests) { added.push(...requests); },
    async match() { return cached; },
    async put(key, res) { stored.set(key, res); },
  };
  vm.runInNewContext(readFileSync(new URL("../../sw.js", import.meta.url), "utf8"), {
    self: { addEventListener(type, handler) { handlers[type] = handler; }, skipWaiting() {} },
    location: { origin: "https://example.test" },
    URL,
    Request: class { constructor(url, init) { Object.assign(this, { url }, init); } },
    caches: { async open() { return cache; } },
    fetch: async () => { if (!network) throw new Error("offline"); return network; },
  });
  const fire = (type, props) => {
    const pending = [];
    let response;
    handlers[type]({ ...props, waitUntil(p) { pending.push(p); }, respondWith(p) { response = p; } });
    return { response, done: Promise.all(pending) };
  };
  return { fire, stored, added };
}
const get = (path) => ({ request: { method: "GET", url: `https://example.test${path}` } });
const response = (body) => ({ ok: true, body, clone() { return response(body); } });

test("install bypasses the HTTP cache", async () => {
  const { fire, added } = worker({});
  await fire("install", {}).done;
  assert.ok(added.length > 0 && added.every((r) => r.cache === "reload"));
  assert.ok(added.some((r) => r.url === "js/saved.js"), "saved controls must work offline");
});

test("a cache hit is served and refreshed in the background", async () => {
  const sw = worker({ cached: response("old"), network: response("new") });
  const { response: res, done } = sw.fire("fetch", get("/recipe.html?c=daiquiri"));
  assert.equal((await res).body, "old");
  await done;
  assert.equal(sw.stored.get("/recipe.html").body, "new");
});

test("a miss goes to the network; offline with a hit still serves it", async () => {
  const miss = worker({ network: response("new") });
  assert.equal((await miss.fire("fetch", get("/data/cocktails.json")).response).body, "new");
  const offline = worker({ cached: response("old") });
  const { response: res, done } = offline.fire("fetch", get("/"));
  assert.equal((await res).body, "old");
  await done;
});
