import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

let implementation;
try {
  implementation = await import('../src/lib/platform/webRelease.ts');
} catch (error) {
  if (error.code !== 'ERR_UNKNOWN_FILE_EXTENSION') throw error;
  const ts = createRequire(import.meta.url)('typescript');
  const source = readFileSync(new URL('../src/lib/platform/webRelease.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  implementation = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { webEntryScript, webEntryScriptFromHtml, latestWebEntryScript } = implementation;
const origin = 'https://www.caresuiteplus.app';
// The actual old and new bundles observed on the same authenticated tab.
const oldEntry = '/_expo/static/js/web/entry-21482a9b77e86c82a1e976541fa85825.js';
const newEntry = '/_expo/static/js/web/entry-2e473c9b81ae0788dd40303fd51ef33e.js';
const html = entry => `<!doctype html><script src="/_expo/static/js/web/_layout-123.js"></script><script src="${entry}" defer></script>`;
const response = (body, type = 'text/html; charset=utf-8', ok = true) => ({
  ok, headers: { get: () => type }, text: async () => body,
});

test('initial bundle identity ignores route chunks and external scripts', () => {
  assert.equal(webEntryScript([`${origin}${oldEntry}`, '/_expo/static/js/web/index-abc.js', `https://other.example${newEntry}`], origin), origin + oldEntry);
  assert.equal(webEntryScript([oldEntry, oldEntry], origin), origin + oldEntry);
  assert.equal(webEntryScript(['/route.js', 'invalid URL', `data:text/javascript,${oldEntry}`], origin), null);
});

test('ambiguous or altered entry URLs do not claim a release', () => {
  assert.equal(webEntryScript([oldEntry, newEntry], origin), null);
  assert.equal(webEntryScript([oldEntry + '?token=private'], origin), null);
  assert.equal(webEntryScript([oldEntry + '#fragment'], origin), null);
});

test('real HTML src attributes identify the deployed bundle', () => {
  assert.equal(webEntryScriptFromHtml(html(newEntry), origin), origin + newEntry);
  assert.equal(webEntryScriptFromHtml(`<SCRIPT defer SRC='${oldEntry}'></SCRIPT>`, origin), origin + oldEntry);
  assert.equal(webEntryScriptFromHtml(`<!--${html(newEntry)}--><script data-src="${oldEntry}"></script>`, origin), null);
});

test('same release stays current; a changed deployed bundle is detected', async () => {
  const signal = new AbortController().signal;
  const loaded = webEntryScript([oldEntry], origin);
  assert.equal(await latestWebEntryScript(origin, signal, async () => response(html(oldEntry))), loaded);
  const latest = await latestWebEntryScript(origin, signal, async () => response(html(newEntry)));
  assert.notEqual(latest, loaded);
  assert.equal(latest, origin + newEntry);
});

test('release checks request public HTML without cookies or browser cache', async () => {
  const signal = new AbortController().signal;
  await latestWebEntryScript(origin, signal, async (url, options) => {
    assert.equal(url, origin + '/index.html');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, signal);
    return response(html(newEntry));
  });
});

test('offline, error and protection responses do not invent an update', async () => {
  const signal = new AbortController().signal;
  for (const value of [response(html(newEntry), 'text/html', false), response('{"error":"unavailable"}', 'application/json'), response('<html>Please sign in</html>')]) {
    assert.equal(await latestWebEntryScript(origin, signal, async () => value), null);
  }
  assert.equal(await latestWebEntryScript(origin, signal, async () => { throw new Error('offline'); }), null);
});

test('aborted or unexpectedly large responses cannot publish a release identity', async () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(await latestWebEntryScript(origin, controller.signal, async () => response(html(newEntry))), null);
  assert.equal(await latestWebEntryScript(origin, new AbortController().signal, async () => response(' '.repeat(1_000_001) + html(newEntry))), null);
});
