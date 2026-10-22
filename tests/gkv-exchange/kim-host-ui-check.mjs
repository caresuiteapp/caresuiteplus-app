/** Actual React component with synthetic API states; DOM behavior, not visual proof.
 * Uses the project's existing esbuild/happy-dom, installs nothing. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import { runInThisContext } from 'node:vm';
import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const source = `import * as React from 'react'; import {createRoot} from 'react-dom/client';
import {KimHostPanel} from './src/components/office/gkv/GkvKimHost.web';
import {gkvExchangeCss} from './src/screens/office/gkvExchangeStyles.web';
globalThis.kimPanel={React,createRoot,KimHostPanel,css:gkvExchangeCss};`;
const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
  tsconfigRaw: {}, format: 'iife', platform: 'browser', jsx: 'automatic', alias: { '@': resolve('src') },
  define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'existing-api-boundary', setup(b) {
    b.onResolve({ filter: /gkvExchange\/repository.web$/ }, () => ({ path: 'api-boundary', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const requestKimHost=(...args)=>globalThis.kimHostTest(...args);' }));
  } }] });
const tenantId = randomUUID(), base = { version: 1, tenantId, configured: true, environment: 'test', state: 'ready', canStart: true,
  requestId: null, startedAt: null, completedAt: null, report: null, errorCode: null };
const passed = { ...base, state: 'passed', requestId: randomUUID(), report: { version: 2, documentVerification: { checkedAt: Date.now(), reportSha256: 'b'.repeat(64) }, runId: randomUUID(), completedAt: Date.now(), transcriptSha256: 'a'.repeat(64),
  transcript: ['GetJobNumber','SignDocument','EncryptDocument','DecryptDocument','VerifyDocument'].map(operation => ({ operation })) } };
const window = new Window();
for (const key of ['window','document','HTMLElement','HTMLInputElement','Event','MouseEvent','Node']) globalThis[key] = key === 'window' ? window : window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const OriginalChannel = globalThis.MessageChannel, channels = [];
globalThis.MessageChannel = class extends OriginalChannel { constructor() { super(); channels.push(this); } };
runInThisContext(bundle.outputFiles[0].text);
const { React, createRoot, KimHostPanel, css } = globalThis.kimPanel;
const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
const calls = []; let state = base;
globalThis.kimHostTest = async (...args) => { calls.push(args); return state; };
const render = async (id = tenantId, canCheck = true) => React.act(async () => root.render(React.createElement(KimHostPanel, { key: id, tenantId: id, roleKey: 'verwaltung', canCheck })));
const button = name => [...container.querySelectorAll('button')].find(b => b.textContent === name);
try {
  await render(); assert.match(container.textContent, /Bereit für die Anschlussprüfung/); assert.equal(button('Kartenprüfung starten').disabled, false);
  state = { ...base, configured: false, state: 'unconfigured', canStart: false };
  await React.act(async () => button('Prüfstatus abfragen').click());
  assert.match(container.textContent, /Host noch nicht angebunden/); assert.equal(button('Kartenprüfung starten').disabled, true);
  state = base; await React.act(async () => button('Prüfstatus abfragen').click());
  let release; globalThis.kimHostTest = (...args) => { calls.push(args); return new Promise(r => { release = r; }); };
  await React.act(async () => button('Kartenprüfung starten').click());
  assert.equal(button('Kartenprüfung starten').disabled, true); assert.equal(calls.at(-1)[2], 'start'); assert.match(calls.at(-1)[3], /^[a-f0-9-]{36}$/);
  await React.act(async () => release(passed)); assert.match(container.textContent, /Kryptografischer Durchlauf erfolgreich/);
  assert.equal(container.querySelectorAll('.gx-kim-checks li').length, 5); assert.ok(button('Prüfprotokoll herunterladen'));
  assert.match(container.textContent, /noch nicht vor/); assert.match(container.textContent, /gesondert nachzuweisen/);
  state = { ...passed, report: { ...passed.report, version: 1, documentVerification: undefined, transcript: passed.report.transcript.slice(0, 4) } };
  globalThis.kimHostTest = async () => state;
  await React.act(async () => button('Prüfstatus abfragen').click()); assert.match(container.textContent, /Älteres Prüfprotokoll/);
  assert.doesNotMatch(container.textContent, /als gültig bestätigt/);
  state = { ...passed, canStart: false, nextStartAt: Date.now() + 29000 };
  await React.act(async () => button('Prüfstatus abfragen').click()); assert.match(container.textContent, /Ein neuer Durchlauf ist ab/); assert.equal(button('Kartenprüfung starten').disabled, true);
  for (const [receiveBlock, text] of [['active', 'Kartenempfang läuft am Host'], ['review', 'Kartenempfang benötigt Überprüfung'], ['cooldown', 'Wartezeit nach Kartenempfang']]) {
    state = { ...base, canStart: false, receiveBlock, nextStartAt: receiveBlock === 'cooldown' ? Date.now() + 29000 : null };
    await React.act(async () => button('Prüfstatus abfragen').click());
    assert.ok(container.textContent.includes(text)); assert.equal(button('Kartenprüfung starten').disabled, true);
    assert.doesNotMatch(container.textContent, /Bereit für die Anschlussprüfung/);
  }
  state = { ...base, state: 'failed', requestId: randomUUID(), canStart: false, errorCode: 'KIM_CONNECTOR_CMS_VERIFY_INCONCLUSIVE' };
  await React.act(async () => button('Prüfstatus abfragen').click()); assert.match(container.textContent, /nicht vollständig abschließen/); assert.ok(button('Prüfprotokoll herunterladen'));
  globalThis.kimHostTest = async () => { throw new Error('Verbindung unterbrochen'); };
  await React.act(async () => button('Prüfstatus abfragen').click()); assert.match(container.querySelector('[role=alert]').textContent, /Verbindung unterbrochen/);
  await render(randomUUID(), false); assert.equal(button('Kartenprüfung starten'), undefined); assert.doesNotMatch(container.textContent, /erfolgreich/);
  // A completion belonging to the old tenant cannot render in the new scope.
  const old = randomUUID(), next = randomUUID(); globalThis.kimHostTest = id => id === old ? new Promise(r => { release = r; }) : Promise.resolve({ ...base, tenantId: next });
  await render(old); await render(next); await React.act(async () => release(passed)); assert.doesNotMatch(container.textContent, /erfolgreich/);
  console.log('KIM host UI: permission, load, missing host, start lock, result, error and tenant-change behavior passed.');
  if (process.argv[2]) {
    const dir = resolve(process.argv[2]); await mkdir(dir, { recursive: true });
    const states = { ready: base, passed, unconfigured: { ...base, configured: false, environment: null, state: 'unconfigured', canStart: false },
      running: { ...base, state: 'running', canStart: false }, failed: { ...base, state: 'failed', canStart: false, errorCode: 'KIM_CONNECTOR_PIN_NOT_VERIFIED' },
      receiveActive: { ...base, canStart: false, receiveBlock: 'active', nextStartAt: null },
      receiveReview: { ...base, canStart: false, receiveBlock: 'review', nextStartAt: null },
      receiveCooldown: { ...base, canStart: false, receiveBlock: 'cooldown', nextStartAt: Date.now() + 29000 } };
    await writeFile(resolve(dir, 'index.html'), `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CareSuite · lokale Oberflächenprüfung</title><style>body{margin:0;background:#eef4f7;font-family:Arial,sans-serif}main{max-width:1180px;margin:0 auto;padding:24px;box-sizing:border-box}#fixture{font:13px Arial;padding:12px 24px;background:#e2ebf1}${css}</style><div id="fixture">Lokale Prüfung mit synthetischen Zuständen · <select id="state">${Object.keys(states).map(s => `<option>${s}</option>`).join('')}</select></div><main class="gx"><div id="root"></div></main><script>${bundle.outputFiles[0].text}</script><script>const states=${JSON.stringify(states)};let current=states.ready;globalThis.kimHostTest=async()=>current;const root=kimPanel.createRoot(document.getElementById('root'));let n=0;function render(){root.render(kimPanel.React.createElement(kimPanel.KimHostPanel,{key:++n,tenantId:${JSON.stringify(tenantId)},roleKey:'verwaltung',canCheck:true}))}document.getElementById('state').onchange=e=>{current=states[e.target.value];render()};render();</script></html>`);
  }
} finally { await React.act(async () => root.unmount()); await window.happyDOM.abort(); for (const c of channels) { c.port1.close(); c.port2.close(); } }
