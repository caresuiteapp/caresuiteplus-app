import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { test } from 'node:test';

// DOM behavior model only: this does not calculate layout or verify visual appearance.
const source = await readFile(new URL('../public/platform-runtime.js', import.meta.url), 'utf8');
const release = 'caresuite-platform-runtime-controls-20261007';
const open = { release, maintenanceMode: false, registrationEnabled: true, notice: '' };
const flush = () => new Promise(resolve => setTimeout(resolve, 15));
function fixture({ path = '/landingpage/', hostname = 'www.caresuiteplus.app', settings = open } = {}) {
  const requests = [], timers = [], documentEvents = {}, windowEvents = {}, observers = [];
  let value = settings, offline = false;
  const location = { hostname, pathname: path, href: `https://${hostname}${path}?password=never-read`, origin: `https://${hostname}` };
  const document = { readyState: 'complete', visibilityState: 'visible', activeElement: null,
    addEventListener: (name, fn) => { (documentEvents[name] ??= []).push(fn); } };
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.attributes = new Map(); this.style = { overflow: '' }; this._text = ''; }
    set textContent(value) { this._text = value; for (const node of this.children) node.parent = null; this.children = []; }
    get textContent() { return this._text + this.children.map(x => x.textContent).join(''); }
    set id(value) { this.setAttribute('id', value); } get id() { return this.getAttribute('id'); }
    set href(value) { this.setAttribute('href', value); } get href() { return new URL(this.getAttribute('href'), location.href).href; }
    get isConnected() { return this === document.body || this === document.head || Boolean(this.parent?.isConnected); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.has(key) ? this.attributes.get(key) : null; }
    hasAttribute(key) { return this.attributes.has(key); }
    removeAttribute(key) { this.attributes.delete(key); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    prepend(node) { node.parent = this; this.children.unshift(node); }
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; } }
    focus() { document.activeElement = this; }
    addEventListener(name, fn) { (this.events ??= {})[name] = fn; }
    querySelectorAll(selector) {
      const all = []; const visit = node => { for (const child of node.children) { all.push(child); visit(child); } }; visit(this);
      return all.filter(node => (selector.includes('a[href]') && node.tagName === 'A' && node.hasAttribute('href')) || (selector.includes('button') && node.tagName === 'BUTTON' && !node.disabled));
    }
  }
  document.body = new Node('body'); document.head = new Node('head'); document.createElement = tag => new Node(tag);
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  document.getElementById = id => { let found = null; const visit = node => { if (node.id === id) found = node; for (const child of node.children) visit(child); }; visit(document.body); return found; };
  const page = new Node('main'), original = new Node('input'); original.value = 'unsaved private draft'; page.append(original);
  const link = new Node('a'); link.href = '/auth/register'; page.append(link); document.body.append(page); original.focus();
  const context = createContext({ URL, Response, AbortController, console, setTimeout, clearTimeout,
    setInterval: (fn, delay) => timers.push({ fn, delay }),
    MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} },
    navigator: { doNotTrack: '1', globalPrivacyControl: true }, document,
    window: { location, addEventListener: (name, fn) => { (windowEvents[name] ??= []).push(fn); } },
    fetch: async (url, init) => { requests.push({ url, init }); if (offline) throw new Error('offline'); return new Response(JSON.stringify({ runtime: value }), { status: 200 }); },
  });
  runInContext(source, context);
  const byClass = name => { const found = []; const visit = node => { if (node.className === name) found.push(node); for (const child of node.children) visit(child); }; visit(document.body); return found; };
  return { requests, timers, document, page, original, link, observers, context, byClass, Node,
    settings: next => { value = next; }, offline: () => { offline = true; }, async poll() { timers[0].fn(); await flush(); } };
}

test('public operational checks work with privacy signals and never send tracking or form data', async () => {
  const f = fixture(); await flush(); assert.equal(f.requests.length, 1);
  const { url, init } = f.requests[0]; assert.equal(url.includes('?'), false); assert.equal(init.method, 'GET');
  assert.equal(init.credentials, 'omit'); assert.equal(init.body, undefined); assert.equal(init.headers.Authorization, undefined);
  assert.equal(JSON.stringify(f.requests).includes('private'), false); assert.equal(JSON.stringify(f.requests).includes('never-read'), false);
});
test('public preview hosts do not read or change production operational state', async () => {
  const f = fixture({ hostname: 'preview.vercel.app' }); await flush(); assert.equal(f.requests.length, 0); assert.equal(f.timers.length, 0);
});
test('public maintenance hides interaction and displays reachable support and platform administration links', async () => {
  const f = fixture({ settings: { ...open, maintenanceMode: true, notice: 'Kurze Wartung' } }); await flush();
  assert.equal(f.page.hasAttribute('inert'), true); assert.equal(f.page.getAttribute('aria-hidden'), 'true');
  const overlay = f.byClass('cs-public-runtime-overlay')[0]; assert.ok(overlay); assert.equal(f.document.activeElement, overlay);
  const paths = overlay.querySelectorAll('a[href]').map(node => new URL(node.href).pathname);
  assert.deepEqual(paths, ['/support', '/datenschutz', '/impressum', '/platform/login']);
  assert.equal(f.original.value, 'unsaved private draft');
});
test('static support and legal pages remain interactive during maintenance', async () => {
  for (const path of ['/datenschutz', '/impressum/', '/support', '/nutzungsbedingungen']) {
    const f = fixture({ path, settings: { ...open, maintenanceMode: true } }); await flush();
    assert.equal(f.byClass('cs-public-runtime-overlay').length, 0); assert.equal(f.page.hasAttribute('inert'), false);
  }
});
test('maintenance can be removed without replacing page contents or losing existing access attributes', async () => {
  const f = fixture({ settings: { ...open, maintenanceMode: true } }); f.page.setAttribute('aria-hidden', 'false'); await flush();
  // The new block saved the pre-existing attributes before changing them.
  f.settings(open); await f.poll(); assert.equal(f.byClass('cs-public-runtime-overlay').length, 0);
  assert.equal(f.page.hasAttribute('inert'), false); assert.equal(f.page.getAttribute('aria-hidden'), 'false');
  assert.equal(f.page.children[0], f.original); assert.equal(f.original.value, 'unsaved private draft');
  assert.equal(f.document.activeElement, f.original);
});
test('platform notices remain literal text and can be updated and removed', async () => {
  const dangerous = '<img src=x onerror="private()">'; const f = fixture({ settings: { ...open, notice: dangerous } }); await flush();
  const notice = f.byClass('cs-public-runtime-notice')[0]; assert.equal(notice.textContent, dangerous); assert.equal(notice.children.length, 0);
  f.settings({ ...open, notice: 'Neuer Hinweis' }); await f.poll(); assert.equal(notice.textContent, 'Neuer Hinweis');
  f.settings(open); await f.poll(); assert.equal(f.byClass('cs-public-runtime-notice').length, 0);
});
test('invalid releases and offline rechecks do not reopen a confirmed public maintenance block', async () => {
  const f = fixture({ settings: { ...open, maintenanceMode: true } }); await flush();
  f.settings({ ...open, release: 'old' }); await f.poll(); assert.equal(f.page.hasAttribute('inert'), true);
  f.offline(); await f.poll(); assert.equal(f.byClass('cs-public-runtime-overlay').length, 1);
});
test('registration links receive and lose the paused status as the control changes', async () => {
  const f = fixture({ settings: { ...open, registrationEnabled: false } }); await flush();
  assert.equal(f.link.getAttribute('aria-disabled'), 'true'); assert.equal(f.page.hasAttribute('inert'), false);
  assert.equal(new URL(f.link.href).pathname, '/auth/register');
  f.settings(open); await f.poll(); assert.equal(f.link.getAttribute('aria-disabled'), null); assert.equal(f.link.getAttribute('title'), null);
});
test('new body overlays cannot gain interaction while public maintenance is active', async () => {
  const f = fixture({ settings: { ...open, maintenanceMode: true } }); await flush();
  const newContent = new f.Node('section'); f.document.body.append(newContent); f.observers[0].fn();
  assert.equal(newContent.hasAttribute('inert'), true);
  f.settings(open); await f.poll(); assert.equal(newContent.hasAttribute('inert'), false);
});
test('loading the helper twice keeps one operational lifecycle', async () => {
  const f = fixture(); runInContext(source, f.context); await flush(); assert.equal(f.requests.length, 1); assert.equal(f.timers.length, 1);
});
