import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const [output, flag] = process.argv.slice(2);
assert.ok(output && (!flag || flag === '--assets-only'), 'Usage: node .github/site-smoke.mjs <output> [--assets-only]');
const root = resolve(output);
const config = JSON.parse(await readFile(new URL('./site-smoke.json', import.meta.url), 'utf8'));
const rootFiles = await readdir(root, { recursive: true, withFileTypes: true });
const worker = await readFile(join(root, 'sw.js'), 'utf8');

function localPath(relative) {
  const file = resolve(root, relative);
  assert.ok(file.startsWith(root + sep), 'Path leaves the deployment directory: ' + relative);
  return file;
}

function urlsIn(shell) {
  const match = worker.match(new RegExp('^const ' + shell + ' = (\\[[\\s\\S]*?\\]);', 'm'));
  assert.ok(match, 'Missing precache array: ' + shell);
  // Existing handwritten workers use JS array literals with trailing commas.
  return new Set([...match[1].matchAll(/["']([^"'\r\n]+)["']/g)].map(([, path]) =>
    decodeURIComponent(path.replace(/^\.\//, '') || 'index.html')));
}

const precached = urlsIn(config.shell ?? 'files');
const files = rootFiles.filter((entry) => entry.isFile()).map(({ parentPath, name }) =>
  join(parentPath, name).slice(root.length + 1).split(sep).join('/'));

for (const path of precached) {
  assert.ok((await stat(localPath(path)).catch(() => null))?.isFile(), 'Precached file missing: ' + path);
}
const required = config.shell
  ? files.filter((file) => /\.(?:js|css)$/.test(file) && file !== 'sw.js' &&
      config.shellRoots.some((path) => path === '.' || file.startsWith(path + '/')))
  : files.filter((file) => file !== 'sw.js');
assert.ok(required.length, 'No deployment assets were found');
for (const file of required) {
  assert.ok(precached.has(file), 'Missing from precache: ' + file);
}
for (const file of ['index.html', 'manifest.webmanifest']) {
  assert.ok(precached.has(file), 'Missing from precache: ' + file);
}
console.log('Verified', required.length, 'required offline assets.');
if (flag === '--assets-only') process.exit(0);

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};
const prefix = '/pages-preview/';
const probe = prefix + '__smoke__.html';
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) throw new Error('Path outside the preview');
    if (url.pathname === probe) {
      response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Service worker check</title>');
      return;
    }
    const file = localPath(decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(data);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import('playwright');
const browser = await chromium.launch();
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const base = origin + prefix;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15_000);
  const problems = [];
  let offline = false;
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('response', (response) => {
    if (new URL(response.url()).origin !== origin || response.ok()) return;
    if (response.status() >= 400 && (!offline || response.request().resourceType() !== 'image')) {
      problems.push(response.status() + ' ' + response.url());
    }
  });

  // Check the real deployment worker on localhost, even if the site skips automatic registration in development.
  await page.goto(origin + probe);
  await page.evaluate(() => navigator.serviceWorker.register('./sw.js').then(() => true));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 60_000 });
  const assertPage = async ({ path, selector, text }) => {
    const url = new URL(path, base);
    assert.ok(url.href.startsWith(base), 'Smoke route leaves the preview: ' + path);
    await page.goto('about:blank'); // Hash-only links must reopen in a fresh document.
    const response = await page.goto(url.href);
    assert.ok(response?.ok(), 'Navigation failed: ' + url.href);
    await page.locator('button[data-copy-link]').first().waitFor();
    assert.equal((await page.locator(selector).textContent()).trim(), text);
  };
  for (const route of config.routes) await assertPage(route);

  offline = true;
  await page.context().setOffline(true);
  for (const route of config.routes) await assertPage(route);
  assert.deepEqual(problems, [], 'First-party assets and scripts must load');
  console.log('Verified deployment subpath, direct content links and offline navigation.');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((close) => server.close(close));
}
