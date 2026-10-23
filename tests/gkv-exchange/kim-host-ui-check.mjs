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
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const requestKimHost=(...args)=>globalThis.kimHostTest(...args); export const requestKimHostCommand=(_tenant,_role,command,signal)=>globalThis.kimReceiveTest(command,signal);' }));
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
const receiveEmpty = { version: 1, kind: 'card-receive-list', configured: false, environment: null, mailboxId: null,
  canStart: false, blockReason: null, nextStartAt: null, before: null, nextCursor: null, items: [] };
globalThis.kimReceiveTest = async command => ({ ...receiveEmpty, tenantId: command.tenantId });
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
  // Exercise the actual receive component through the same API boundary as the
  // app. Fixtures contain identifiers and metadata only, never patient data.
  const mailboxId = randomUUID(), original = { version: 1, kind: 'card-receive', tenantId, mailboxId, requestId: randomUUID(), messageId: randomUUID(),
    originalSha256: 'a'.repeat(64), environment: 'test', state: 'prepared', createdAt: Date.now() - 3000, startedAt: null, completedAt: null,
    reviewRequired: false, canStart: true, nextStartAt: null, errorCode: null, result: null };
  let job = original, receiveRelease, loseStart = false; const receiveCalls = [];
  const receivePage = () => ({ ...receiveEmpty, tenantId, configured: true, environment: 'test', mailboxId,
    canStart: job.canStart, blockReason: job.state === 'running' ? 'active' : job.reviewRequired ? 'review' : null, items: [job] });
  globalThis.kimReceiveTest = async command => { receiveCalls.push(command);
    if (command.action === 'receive-start') { if (loseStart) throw new Error('Verbindung unterbrochen'); return new Promise(resolve => { receiveRelease = resolve; }); }
    return command.action === 'receive-list' ? receivePage() : job;
  };
  state = base; globalThis.kimHostTest = async () => state;
  await render(); assert.equal(container.querySelectorAll('.gx-receive-jobs button').length, 1);
  assert.equal(button('Empfang prüfen'), undefined);
  await React.act(async () => container.querySelector('.gx-receive-jobs button').click());
  assert.equal(button('Empfang prüfen').disabled, false);
  await React.act(async () => button('Empfang prüfen').click());
  assert.equal(button('Empfang prüfen').disabled, true); assert.equal(container.querySelector('.gx-receive-jobs button').disabled, true);
  assert.equal(button('Kartenprüfung starten').disabled, true);
  assert.equal(receiveCalls.at(-1).requestId, original.requestId);
  job = { ...original, state: 'running', startedAt: Date.now(), reviewRequired: true, canStart: false };
  await React.act(async () => receiveRelease(job)); assert.match(container.textContent, /Beim Verlassen der Ansicht/);
  assert.doesNotMatch(container.querySelector('#gx-kim-receive-detail').textContent, /Administration muss/);
  job = { ...job, state: 'completed', completedAt: Date.now(), result: { kind: 'diagnostic', sha256: 'b'.repeat(64), octets: 500,
    diagnosisCode: 'XCS_DOCUMENT', cardState: 'rejected', cardStage: 'document', documentResult: 'INVALID', verificationReportSha256: 'c'.repeat(64),
    identityStatus: 'unverified', deliveryStatus: 'diagnostic-only', hardwareEvidence: 'not-attested', tiEvidence: 'not-attested' } };
  await React.act(async () => button('Empfangsstatus abfragen').click());
  assert.match(container.textContent, /Ungültig/); assert.match(container.textContent, /Überprüfung erforderlich/); assert.equal(button('Empfang prüfen').disabled, true);
  assert.ok(button('Statusprotokoll herunterladen')); assert.doesNotMatch(container.textContent, /Kryptografischer Durchlauf erfolgreich/);
  job = original; loseStart = true;
  await React.act(async () => button('Empfangsstatus abfragen').click());
  await React.act(async () => button('Empfang prüfen').click());
  assert.match(container.textContent, /Startantwort konnte nicht bestätigt/); assert.equal(button('Empfang prüfen').disabled, true);
  assert.equal(button('Kartenprüfung starten').disabled, true);
  const starts = receiveCalls.filter(c => c.action === 'receive-start').length;
  await React.act(async () => button('Empfangsstatus abfragen').click()); assert.equal(button('Empfang prüfen').disabled, false);
  assert.equal(receiveCalls.filter(c => c.action === 'receive-start').length, starts);
  await render(tenantId, false); assert.equal(button('Empfang prüfen'), undefined); assert.equal(button('Empfangsstatus abfragen'), undefined);
  console.log('KIM host UI: permission, load, missing host, start lock, result, error and tenant-change behavior passed.');
  console.log('KIM receive UI: list, selection, explicit start, lock, negative document, uncertain start and permission behavior passed.');
  if (process.argv[2]) {
    const dir = resolve(process.argv[2]); await mkdir(dir, { recursive: true });
    const states = { ready: base, passed, unconfigured: { ...base, configured: false, environment: null, state: 'unconfigured', canStart: false },
      running: { ...base, state: 'running', canStart: false }, failed: { ...base, state: 'failed', canStart: false, errorCode: 'KIM_CONNECTOR_PIN_NOT_VERIFIED' },
      receiveActive: { ...base, canStart: false, receiveBlock: 'active', nextStartAt: null },
      receiveReview: { ...base, canStart: false, receiveBlock: 'review', nextStartAt: null },
      receiveCooldown: { ...base, canStart: false, receiveBlock: 'cooldown', nextStartAt: Date.now() + 29000 } };
    await writeFile(resolve(dir, 'index.html'), `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CareSuite · lokale Oberflächenprüfung</title><style>body{margin:0;background:#eef4f7;font-family:Arial,sans-serif}main{max-width:1180px;margin:0 auto;padding:24px;box-sizing:border-box}#fixture{font:13px Arial;padding:12px 24px;background:#e2ebf1}${css}</style><div id="fixture">Lokale Prüfung mit synthetischen Zuständen · <select id="state">${Object.keys(states).map(s => `<option>${s}</option>`).join('')}</select></div><main class="gx"><div id="root"></div></main><script>${bundle.outputFiles[0].text}</script><script>const states=${JSON.stringify(states)};let current=states.ready;globalThis.kimHostTest=async()=>current;globalThis.kimReceiveTest=async c=>({...${JSON.stringify(receiveEmpty)},tenantId:c.tenantId});const root=kimPanel.createRoot(document.getElementById('root'));let n=0;function render(){root.render(kimPanel.React.createElement(kimPanel.KimHostPanel,{key:++n,tenantId:${JSON.stringify(tenantId)},roleKey:'verwaltung',canCheck:true}))}document.getElementById('state').onchange=e=>{current=states[e.target.value];render()};render();</script></html>`);
  }
} finally { await React.act(async () => root.unmount()); await window.happyDOM.abort(); for (const c of channels) { c.port1.close(); c.port2.close(); } }
