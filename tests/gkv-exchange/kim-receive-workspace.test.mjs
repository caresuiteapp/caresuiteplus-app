import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readKimHostCommand, readKimReceiveList, unconfiguredKimReceiveList, KIM_RECEIVE_PAGE_SIZE } from '../../src/lib/gkvExchange/kimReceiveContract.ts';
import { KimReceiveWorkspace } from '../../src/lib/gkvExchange/kimReceiveWorkspace.ts';
import { postKimHostCommand } from '../../src/lib/gkvExchange/kimHostClient.ts';

const tenantId = randomUUID(), mailboxId = randomUUID(), now = Date.now() - 10000;
const prepared = (i = 0) => ({ version: 1, kind: 'card-receive', tenantId, mailboxId, requestId: randomUUID(), messageId: randomUUID(), originalSha256: 'a'.repeat(64),
  environment: 'test', state: 'prepared', createdAt: now - i, startedAt: null, completedAt: null, reviewRequired: false, canStart: true, nextStartAt: null, errorCode: null, result: null });
const cursor = job => ({ createdAt: job.createdAt, requestId: job.requestId });
const list = (items = [prepared()], before = null, more = false, blockReason = null) => ({ version: 1, kind: 'card-receive-list', tenantId, configured: true,
  environment: 'test', mailboxId, canStart: blockReason === null, blockReason, nextStartAt: blockReason === 'cooldown' ? Date.now() + 20000 : null,
  before, nextCursor: more ? cursor(items.at(-1)) : null, items });
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('KIM receive list: pages and empty/unconfigured results are scoped snapshots', () => {
  const items = Array.from({ length: KIM_RECEIVE_PAGE_SIZE }, (_, i) => prepared(i)), page = list(items, null, true);
  const copy = readKimReceiveList(page, tenantId); page.items[0].canStart = false;
  assert.equal(copy.items[0].canStart, true); assert.deepEqual(copy.nextCursor, cursor(items.at(-1)));
  const before = cursor(items.at(-1)); assert.deepEqual(readKimReceiveList(list([], before), tenantId, before).items, []);
  assert.equal(readKimReceiveList(unconfiguredKimReceiveList(tenantId), tenantId).configured, false);
  assert.deepEqual(readKimReceiveList(unconfiguredKimReceiveList(tenantId, before), tenantId, before).before, before);
});
for (const [name, change] of [
  ['foreign tenant', p => { p.tenantId = randomUUID(); }], ['foreign item tenant', p => { p.items[0].tenantId = randomUUID(); }],
  ['foreign mailbox', p => { p.items[0].mailboxId = randomUUID(); }], ['different environment', p => { p.items[0].environment = 'production'; }],
  ['unknown message contents', p => { p.items[0].bytes = 'PRIVATE'; }], ['certificate contents', p => { p.expectedSignerCertificate = 'leaf'; }],
  ['missing cursor echo', p => { delete p.before; }], ['wrong cursor echo', p => { p.before = cursor(p.items[0]); }],
  ['invalid continuation', p => { p.nextCursor = cursor(p.items[0]); }], ['too many entries', p => { p.items = Array.from({ length: 11 }, (_, i) => prepared(i)); }],
  ['duplicate request', p => { p.items.push({ ...p.items[0], createdAt: now - 1, messageId: randomUUID() }); }],
  ['duplicate message', p => { p.items.push({ ...p.items[0], createdAt: now - 1, requestId: randomUUID() }); }],
  ['ascending order', p => { p.items.push(prepared(-1)); }], ['unsorted time tie', p => { p.items.push(prepared()); p.items.sort((a, b) => a.requestId < b.requestId ? -1 : 1); }],
  ['false start during review', p => { p.blockReason = 'review'; }], ['unknown gate', p => { p.canStart = false; p.blockReason = 'override'; }],
  ['array gate', p => { p.canStart = false; p.blockReason = ['review']; }], ['blocked item in ready snapshot', p => { p.items[0].canStart = false; }],
  ['missing cooldown date', p => { p.canStart = false; p.blockReason = 'cooldown'; p.items[0].canStart = false; }],
  ['unconfigured data', p => { p.configured = false; }], ['missing environment', p => { delete p.environment; }],
  ['oversized reply', p => { p.padding = 'x'.repeat(33000); }],
]) test('KIM receive list: rejects ' + name, () => { const page = list(); change(page); assert.throws(() => readKimReceiveList(page, tenantId), /KIM_HOST_RESPONSE/); });
test('KIM receive list: continuation must be strictly older than the requested cursor and end at the last row', () => {
  const items = Array.from({ length: 10 }, (_, i) => prepared(i)), before = cursor(prepared(-1));
  assert.equal(readKimReceiveList(list(items, before, true), tenantId, before).items.length, 10);
  assert.throws(() => readKimReceiveList(list(items, cursor(items[0]), true), tenantId, cursor(items[0])), /KIM_HOST_RESPONSE/);
  const page = list(items, before, true); page.nextCursor = cursor(items[0]);
  assert.throws(() => readKimReceiveList(page, tenantId, before), /KIM_HOST_RESPONSE/);
});
test('KIM receive list: every gate produces coherent prepared and terminal rows', () => {
  for (const blockReason of ['active','review','cooldown']) {
    const page = list([], null, false, blockReason);
    page.items = [{ ...prepared(), canStart: false, nextStartAt: page.nextStartAt }];
    assert.equal(readKimReceiveList(page, tenantId).blockReason, blockReason);
  }
});
for (const before of [{}, [], 'cursor', { createdAt: now }, { createdAt: '1', requestId: randomUUID() },
  { createdAt: -1, requestId: randomUUID() }, { createdAt: 8640000000000001, requestId: randomUUID() },
  { createdAt: now, requestId: randomUUID(), tenantId }, { createdAt: now, requestId: [randomUUID()] }]) {
  test('KIM receive command: rejects malformed cursor ' + JSON.stringify(before), () => {
    assert.throws(() => readKimHostCommand({ tenantId, action: 'receive-list', before }), /KIM_HOST_INPUT/);
  });
}
test('KIM receive command: cursor is restricted to list and cannot carry a request or limit override', () => {
  const before = cursor(prepared());
  assert.deepEqual(readKimHostCommand({ tenantId, action: 'receive-list', before }), { tenantId, action: 'receive-list', before });
  for (const input of [{ tenantId, action: 'receive-list', requestId: randomUUID() }, { tenantId, action: 'receive-list', limit: 100000 },
    { tenantId, action: 'receive-status', requestId: randomUUID(), before }, { tenantId, action: 'status', before }]) {
    assert.throws(() => readKimHostCommand(input), /KIM_HOST_INPUT/);
  }
});

function workspace(transport) { return new KimReceiveWorkspace(tenantId, transport, () => {}); }
test('KIM receive workspace: mount and selection only read; explicit start keeps the prepared request ID and does not double start', async () => {
  let job = prepared(); const calls = [], pending = defer();
  const work = workspace(async command => { calls.push(command); if (command.action === 'receive-start') return pending.promise;
    return command.action === 'receive-list' ? list([job], null, false, job.state === 'running' ? 'active' : null) : job; });
  try {
    await work.refresh(); await work.select(job.requestId); assert.deepEqual(calls.map(c => c.action), ['receive-list','receive-status']);
    const run = work.start(); await work.start(); await work.next(); await work.select(job.requestId);
    assert.equal(calls.filter(c => c.action === 'receive-start').length, 1); assert.equal(calls.at(-1).requestId, job.requestId);
    job = { ...job, state: 'running', startedAt: Date.now(), reviewRequired: true, canStart: false }; pending.resolve(job); await run;
    assert.equal(work.view.job.state, 'running'); assert.equal(work.view.page.blockReason, 'active'); await work.start();
    assert.equal(calls.filter(c => c.action === 'receive-start').length, 1);
  } finally { work.dispose(); }
});
test('KIM receive workspace: start response loss locks navigation and replay until the exact job is reconciled', async () => {
  let job = prepared(), calls = [];
  const work = workspace(async c => { calls.push(c); if (c.action === 'receive-start') throw new Error('Verbindung unterbrochen'); return c.action === 'receive-list' ? list([job]) : job; });
  try {
    await work.refresh(); await work.select(job.requestId); await work.start(); assert.equal(work.view.uncertain, true);
    await work.start(); await work.first(); await work.select(job.requestId); assert.equal(calls.filter(c => c.action === 'receive-start').length, 1);
    await work.refresh(); assert.equal(work.view.uncertain, false); assert.equal(work.view.job.state, 'prepared');
    assert.equal(calls.filter(c => c.action === 'receive-start').length, 1, 'reconciliation never starts automatically');
  } finally { work.dispose(); }
});
test('KIM receive workspace: failed detail reconciliation cannot unlock an uncertain start even with a valid list', async () => {
  const job = prepared(); let fail = false;
  const work = workspace(async c => { if (c.action === 'receive-list') return list([job]); if (fail) throw new Error('offline'); if (c.action === 'receive-start') { fail = true; throw new Error('lost'); } return job; });
  try { await work.refresh(); await work.select(job.requestId); await work.start(); await work.refresh(); assert.equal(work.view.uncertain, true); assert.match(work.view.detailError, /offline/); }
  finally { work.dispose(); }
});
test('KIM receive workspace: a late selection response is ignored even if transport ignores abort', async () => {
  const first = prepared(), second = prepared(1), pending = defer(); let oldSignal;
  const work = workspace(async (c, signal) => { if (c.action === 'receive-list') return list([first, second]); if (c.requestId === first.requestId) { oldSignal = signal; return pending.promise; } return second; });
  try {
    await work.refresh(); const old = work.select(first.requestId); await work.select(second.requestId);
    assert.equal(oldSignal.aborted, true); pending.resolve(first); await old; assert.equal(work.view.job.requestId, second.requestId); assert.equal(work.view.busy, null);
  } finally { work.dispose(); }
});
test('KIM receive workspace: a late list cannot overwrite navigation and failed navigation preserves the current cursor', async () => {
  const items = Array.from({ length: 10 }, (_, i) => prepared(i)), first = list(items, null, true), before = first.nextCursor;
  const second = list([prepared(11)], before), pending = defer(); let reads = 0, fail = false;
  const work = workspace(async c => { if (fail) throw new Error('offline'); if (!c.before && ++reads === 2) return pending.promise; return c.before ? second : first; });
  try {
    await work.refresh(); const old = work.refresh(); await work.next(); assert.equal(work.view.pageNumber, 2);
    pending.resolve(first); await old; assert.deepEqual(work.view.page.before, before);
    fail = true; await work.previous(); assert.equal(work.view.pageNumber, 2); assert.deepEqual(work.view.page.before, before);
    fail = false; await work.previous(); assert.equal(work.view.pageNumber, 1); assert.equal(work.view.page.before, null);
  } finally { work.dispose(); }
});
test('KIM receive workspace: disposal aborts old scope, suppresses late updates and prevents any further command', async () => {
  const pending = defer(), updates = []; let signal, calls = 0;
  const work = new KimReceiveWorkspace(tenantId, async (_c, s) => { signal = s; calls++; return pending.promise; }, v => updates.push(v));
  const old = work.refresh(); work.dispose(); const count = updates.length; assert.equal(signal.aborted, true);
  pending.resolve(list()); await old; await work.refresh(); await work.start(); assert.equal(updates.length, count); assert.equal(calls, 1);
});
for (const field of ['requestId','mailboxId','messageId','originalSha256','createdAt','environment']) test('KIM receive workspace: changed ' + field + ' cannot replace the selected original', async () => {
  const job = prepared(), wrong = { ...job, [field]: field === 'createdAt' ? now - 1 : field === 'environment' ? 'production' : field === 'originalSha256' ? 'b'.repeat(64) : randomUUID() };
  let starts = 0;
  const work = workspace(async c => { if (c.action === 'receive-start') starts++; return c.action === 'receive-list' ? list([job]) : wrong; });
  try { await work.refresh(); await work.select(job.requestId); assert.ok(work.view.detailError); await work.start(); assert.equal(starts, 0); assert.equal(work.view.job.originalSha256, job.originalSha256); }
  finally { work.dispose(); }
});
test('KIM receive workspace: detail and list refresh independently, preserving a usable reconciled job after list failure', async () => {
  const job = prepared(); let fail = false, readCount = 0;
  const work = workspace(async c => { readCount++; if (fail && c.action === 'receive-list') throw new Error('Liste nicht erreichbar'); return c.action === 'receive-list' ? list([job]) : job; });
  try { await work.refresh(); await work.select(job.requestId); fail = true; await work.refresh(); assert.match(work.view.listError, /nicht erreichbar/); assert.equal(work.view.detailError, ''); assert.equal(readCount, 4); await work.start(); assert.equal(readCount, 4); }
  finally { work.dispose(); }
});
test('KIM receive workspace: synchronous transport failure is handled as an error state', async () => {
  const work = workspace(() => { throw new Error('offline'); });
  try { await work.refresh(); assert.equal(work.view.busy, null); assert.match(work.view.listError, /offline/); }
  finally { work.dispose(); }
});

test('KIM browser host client: strict identifiers, same-origin URL, no cache and no automatic retry', async () => {
  const command = { tenantId, action: 'receive-start', requestId: randomUUID() }, calls = [], controller = new AbortController();
  await assert.rejects(postKimHostCommand(command, 'TOKEN', controller.signal, async (url, options) => { calls.push({ url, options }); throw new Error('network'); }), /network/);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/gkv/kim-host'); assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.signal, controller.signal); assert.deepEqual(JSON.parse(calls[0].options.body), command);
  await assert.rejects(postKimHostCommand({ ...command, original: 'PRIVATE' }, 'TOKEN', undefined, async () => { assert.fail('must not fetch'); }), /KIM_HOST_INPUT/);
});
for (const [status, pattern] of [[401, /anmelden/], [403, /Abrechnungsrechte/], [503, /weiterlaufen/]]) test('KIM browser host client: safe error for HTTP ' + status, async () => {
  await assert.rejects(postKimHostCommand({ tenantId, action: 'receive-list' }, 'TOKEN', undefined,
    async () => new Response('PRIVATE HOST CONTENT', { status })), pattern);
});
test('KIM browser host client: response size, UTF-8 and JSON are bounded before contract validation', async () => {
  for (const bytes of ['x'.repeat(32769), new Uint8Array([255, 254]), '{broken']) {
    await assert.rejects(postKimHostCommand({ tenantId, action: 'receive-list' }, 'TOKEN', undefined, async () => new Response(bytes)), /unlesbar/);
  }
  const value = list(); assert.deepEqual(await postKimHostCommand({ tenantId, action: 'receive-list' }, 'TOKEN', undefined, async () => Response.json(value)), value);
});
