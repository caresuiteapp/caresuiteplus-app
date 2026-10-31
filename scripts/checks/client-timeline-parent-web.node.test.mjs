import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes as strip } from 'node:module';
const root = resolve(new URL('../../', import.meta.url).pathname), read = p => readFileSync(resolve(root, p), 'utf8');
// Reuse the existing actual whole Parent/SharedQuery/current-native-permission/SELECT/write leaf fixture.
// Only expose additional actual Parent locals; no replacement Parent, read service, mapper or runtime rights.
let fixture = read('scripts/checks/client-native-parent-web.node.test.mjs');
fixture = fixture.slice(0, fixture.indexOf("test('Actual Parent"));
fixture = fixture.replace(/^const root=.*$/m, `const root=${JSON.stringify(root)},read=p=>readFileSync(resolve(root,p),'utf8');`);
// Resolve the actual validator helper before evaluating the fixture from a data URL.
fixture = fixture.replace("new URL('./helpers/current-intake-validation.mjs',import.meta.url).href", JSON.stringify(new URL('./helpers/current-intake-validation.mjs',import.meta.url).href));
fixture = fixture.replace("const apiFields='", "const apiFields='timelineAccess,timelineControllersRef,");
fixture = fixture.replace('render();return {get api()', 'render();return {get nativeSdk(){return nativeDb;},get api()');
// Explicit native SDK status is required by the139 note reader before any insert.
fixture = fixture.replace('return{data:singleRow?rows[0]??null:rows,error:null};', 'return{data:singleRow?rows[0]??null:rows,error:null,status:200};');
fixture += '\nexport { harness, ready, id, deferred };';
const { harness, ready, id, deferred } = await import('data:text/javascript;base64,' + Buffer.from(fixture).toString('base64'));
const action = await import(pathToFileURL(resolve(root, 'src/lib/clients/clientTimelineNoteAction.web.ts')).href);
const timeline = await import(pathToFileURL(resolve(root, 'src/lib/clients/clientTimelineOriginals.web.ts')).href);
const native = await import(pathToFileURL(resolve(root, 'src/lib/clients/clientRecordNativeOriginal.web.ts')).href);
const { woundUuid } = await import(pathToFileURL(resolve(root, 'src/lib/pflege/woundCareDomain.ts')).href);
const { withServiceQueryTimeout } = await import(pathToFileURL(resolve(root, 'src/lib/services/queryTimeout.ts')).href);
const rights = (...extra) => new Set(['office.clients.view', ...extra.map(value => 'office.clients.' + value)]);
const make = (t, options = {}) => { const h = harness({ rights: rights('view_sensitive', 'edit'), ...options }); t.after(() => h.unmount()); return h; };
const current = h => h.api.timelineAccess;
const note = (h, value) => { const access = current(h), controller = h.api.timelineControllersRef.current.forOwner(access.nativeOwnerKey); controller.change(value, controller.snapshot().version); return controller; };
const moduleBody = p => strip(read(p).replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, ''));
function panel(h) {
 const source = read('src/screens/business/office/ClientRecordTimelinePanel.web.tsx');
 const helpers = strip(source.slice(source.indexOf('function capture<'), source.indexOf('function originalValue')));
 const start = source.indexOf('export function ClientRecordTimelinePanel');
 const end = source.indexOf('  return <View style={styles.panel}>\n    <SectionPanel title="Verlauf / Timeline"', start);
 const prefix = strip(source.slice(start, end).replace('export ', '') + '\nreturn {save,query,read,notesRead,write,state,controller,ownPool,mayReadOriginal};}');
 const deps = { ...action, ...timeline, ...native, woundUuid, withServiceQueryTimeout, getSupabaseClient: () => h.nativeSdk, fromUnknownTable: (db, table) => db.from(table), toGermanSupabaseError: e => e.message };
 const reader = new Function(...Object.keys(deps), moduleBody('src/lib/clients/clientTimelineOriginalRead.web.ts') + ';return fetchClientTimelineOriginalReadWeb;')(...Object.values(deps));
 const writer = new Function(...Object.keys(deps), moduleBody('src/lib/clients/clientTimelineNoteWrite.web.ts') + ';return writeClientTimelineNoteWeb;')(...Object.values(deps));
 let slot = 0, api, savedQueryData = null; const slots = [], cleanups = [];
 const useRef = initial => { const n = slot++; return slots[n] ?? (slots[n] = { current: initial }); };
 const useState = initial => { const n = slot++; if (!Object.hasOwn(slots, n)) slots[n] = initial; return [slots[n], value => slots[n] = typeof value === 'function' ? value(slots[n]) : value]; };
 const useEffect = fn => { slot++; const clear = fn(); if (clear) cleanups.push(clear); };
 const useAsyncQuery = (fetch, _deps, options) => { const query = { loading: false, refreshing: false, error: null, refreshError: null, previewData: null, tableMissing: false, cacheMeta: { fromCache: false, partialDetail: false }, data: savedQueryData, fetch, options, refresh: async () => { const result = await fetch(); if (result.ok) { savedQueryData = result.data; query.data = result.data; } return result; } }; return query; };
 const run = new Function('useRef', 'useState', 'useEffect', 'useAsyncQuery', 'useAuroraAdaptiveText', 'fetchClientTimelineOriginalReadWeb', 'writeClientTimelineNoteWeb', 'assertClientTimelineCapture', helpers + '\n' + prefix + ';return ClientRecordTimelinePanel;')(useRef, useState, useEffect, useAsyncQuery, () => ({}), reader, writer, action.assertClientTimelineCapture);
 return { render: () => { slot = 0; api = run({ access: current(h), controllers: h.api.timelineControllersRef.current }); return api; }, dispose: () => cleanups.forEach(fn => fn()) };
}

test('Actual Parent exposes only a frozen empty timeline generation token; all native raw sidecars stay private', async t => {
 const h = make(t); await ready(h); const access = current(h), receipt = h.api.parentRead.liveOriginalReceipt(), a = access.captureRead(), b = access.captureWrite();
 assert.ok(a && b); assert.notEqual(a.owner, receipt.owner); assert.deepEqual(Reflect.ownKeys(a.owner), []); assert.ok(Object.isFrozen(a.owner)); assert.equal(a.owner, b.owner); assert.equal(a.key, b.key);
 assert.deepEqual(Object.keys(a).sort(), ['assertCurrentRead', 'clientId', 'key', 'owner', 'tenantId']); assert.equal(JSON.stringify(access).includes('raw_history'), false); assert.equal(JSON.stringify(a).includes('recordNative'), false);
 assert.equal(receipt.recordNative.parts.history.length, 5); assert.equal(receipt.fullNative.parts.history[0].raw_history.at, '2026-10-08 10:00:00.123456+00:00'); assert.equal(h.nativeWrites.length, 0);
});
test('Repeated captures use the same opaque generation and exact receipt key without comparing callback identities', async t => {
 const h = make(t); await ready(h); const first = current(h).captureRead(); h.render(); const next = current(h).captureRead(); assert.equal(next.owner, first.owner); assert.equal(next.key, first.key); assert.doesNotThrow(first.assertCurrentRead);
});
test('Basic View without Sensitive or Edit preserves own internal notes, denies raw timeline and new notes', async t => {
 const h = make(t, { rights: rights() }); h.tables.client_notes.push({ id: id(700), tenant_id: id(1), client_id: id(4), content: 'Actual original note', is_internal: true, category: 'care', created_by: id(2), created_at: '2026-10-08 10:00:00.123456+00:00', updated_at: null }); await ready(h);
 const access = current(h); assert.equal(access.captureRead(), null); assert.equal(access.captureWrite(), null); assert.ok(access.captureInternalNotesRead()); assert.equal(access.internalNotes.length, 1); assert.equal(access.internalNotes[0].content, 'Actual original note');
});
test('Basic View/Edit without Sensitive permits a separate manual-note capture but no raw timeline read', async t => {
 const h = make(t, { rights: rights('edit') }); await ready(h); const access = current(h); assert.equal(access.captureRead(), null); assert.ok(access.captureInternalNotesRead()); const write = access.captureWrite(); assert.ok(write); assert.doesNotThrow(write.assertCurrentWrite); assert.equal(write.actorName, null);
});
test('Sensitive View without Edit retains both readonly factories and blocks manual insertion', async t => {
 const h = make(t, { rights: rights('view_sensitive') }); await ready(h); assert.ok(current(h).captureRead()); assert.ok(current(h).captureInternalNotesRead()); assert.equal(current(h).captureWrite(), null);
});
for (const hook of [0, 1]) for (const name of ['captureRead', 'captureInternalNotesRead', 'captureWrite']) test(`Native permission hook ${hook} refresh synchronously denies retained ${name} before render`, async t => {
 const h = make(t); await ready(h); const access = current(h), capture = access[name](); h.permissionAPIs[hook].refreshPermissions(); assert.equal(access[name](), null); assert.throws(capture.assertCurrentRead); if (name === 'captureWrite') assert.throws(capture.assertCurrentWrite); assert.equal(h.nativeWrites.length, 0);
});
for (const hook of [0, 1]) test(`Same-native rights regrant on hook ${hook} never revives the old read/write capture`, async t => {
 const h = make(t); await ready(h); const read = current(h).captureRead(), write = current(h).captureWrite(), nativeKey = current(h).nativeOwnerKey; h.permissionAPIs[hook].refreshPermissions(); h.render(); await ready(h);
 assert.equal(current(h).nativeOwnerKey, nativeKey); assert.throws(read.assertCurrentRead); assert.throws(write.assertCurrentWrite); assert.ok(current(h).captureRead()); assert.ok(current(h).captureWrite());
});
for (const key of ['recordQuery', 'fullQuery']) test(`Fresh ${key} changes the explicit receipt key and invalidates prior read/write without native revision guesses`, async t => {
 const h = make(t); await ready(h); const before = current(h).captureRead(); await h.api.parentRead[key].refresh(); h.render(); const after = current(h).captureRead(); assert.ok(after); assert.equal(after.owner, before.owner); assert.notEqual(after.key, before.key); assert.throws(before.assertCurrentRead);
});
for (const change of ['token', 'client', 'tenant', 'role', 'actor', 'portal', 'expiry']) test(`Actual native ${change} change denies retained Parent timeline capture`, async t => {
 const h = make(t); await ready(h); const read = current(h).captureRead(), write = current(h).captureWrite();
 if (change === 'token') h.state.token = 'token-B';
 if (change === 'client') h.state.clientId = id(8);
 if (change === 'tenant') h.state.tenantId = id(8);
 if (change === 'role') h.state.profile = { ...h.state.profile, roleKey: 'nurse' };
 if (change === 'actor') { h.state.user = { id: id(8) }; h.state.profile = { ...h.state.profile, id: id(8) }; }
 if (change === 'portal') h.state.portalSession = { id: id(8) };
 if (change === 'expiry') h.state.expiresAt = Date.now() - 1;
 h.render(); assert.equal(current(h).captureRead(), null); assert.equal(current(h).captureWrite(), null); assert.throws(read.assertCurrentRead); assert.throws(write.assertCurrentWrite);
});
test('Actual Parent cleanup denies all retained factories without unmounting or clearing the parent-owned note store', async t => {
 const h = make(t); await ready(h); const access = current(h), store = h.api.timelineControllersRef.current, controller = note(h, 'Original dirty note'); h.unmount(); assert.equal(access.captureRead(), null); assert.equal(access.captureInternalNotesRead(), null); assert.equal(access.captureWrite(), null); assert.equal(store.forOwner(access.nativeOwnerKey), controller); assert.equal(controller.snapshot().draft, 'Original dirty note');
});
test('Parent-owned controller survives native A to B to A with original uncertain request; no reinsert inferred', async t => {
 const h = make(t); await ready(h); const access = current(h), controller = note(h, 'Original uncertain note'), attempt = controller.begin(access.captureWrite(), controller.snapshot().version); assert.ok(attempt); controller.finish(attempt, { ok: false, uncertain: true, error: 'Unknown insert' });
 h.state.clientId = id(8); h.render(); assert.notEqual(h.api.timelineControllersRef.current.forOwner(current(h).nativeOwnerKey), controller); h.state.clientId = id(4); h.render(); assert.equal(h.api.timelineControllersRef.current.forOwner(current(h).nativeOwnerKey), controller); assert.equal(controller.snapshot().original, attempt); assert.equal(controller.snapshot().draft, 'Original uncertain note'); assert.equal(controller.begin(access.captureWrite(), controller.snapshot().version), null); assert.equal(h.nativeWrites.length, 0);
});
test('Known acknowledgement blocks the same original receipt and permits a distinct explicit note only after a fresh read', async t => {
 const h = make(t); await ready(h); const controller = note(h, 'First note'), attempt = controller.begin(current(h).captureWrite(), controller.snapshot().version); assert.ok(attempt); controller.finish(attempt, { ok: true, nativeId: id(90) }); note(h, 'Second explicit note'); assert.equal(controller.begin(current(h).captureWrite(), controller.snapshot().version), null); await h.api.parentRead.fullQuery.refresh(); h.render(); assert.ok(controller.begin(current(h).captureWrite(), controller.snapshot().version));
});
test('Actual Parent to Panel readonly composition queries the three native original pools without legacy fetch or writes', async t => {
 const h = make(t); for (let i = 0; i < 5; i++) h.tables.client_audit_entries.push({id:id(800+i),tenant_id:id(1),client_id:id(4),created_at:'2026-10-08 10:00:00.123456+00:00',actor_name:null,action:'Original '+i,details:'Native audit'}); await ready(h); const p = panel(h); t.after(p.dispose); const view = p.render(), result = await view.query.fetch(); assert.equal(result.ok, true, result.error); assert.equal(result.data.receipt.entries.length, 5); assert.equal(result.data.owner, current(h).captureRead().owner); assert.equal(h.nativeWrites.length, 0); assert.equal(h.rpcCalls.length, 0); assert.equal(h.legacyCalls.length, 0); assert.ok(h.selectCalls.some(call => call.table === 'client_document_events'));
});
test('Actual Parent to Panel Basic View/Edit avoids sensitive timeline query and executes one explicit scoped native note insert', async t => {
 const h = make(t, { rights: rights('edit'), nativeIntercept: (_table, mode, payload) => mode === 'insert' ? { data: { ...payload, id: id(90), created_at: '2026-10-08 10:00:00.654321+00:00' }, error: null, status: 201 } : undefined }); await ready(h); const p = panel(h); t.after(p.dispose); let view = p.render(); assert.equal(view.read, null); assert.ok(view.notesRead); assert.equal(view.query.options.enabled, false); assert.ok(view.write); view.controller.change('Explicit native note', view.state.version); view = p.render(); await view.save(); assert.equal(h.nativeWrites.length, 1); assert.equal(h.nativeWrites[0].table, 'client_timeline_events'); assert.equal(h.nativeWrites[0].payload.client_id, id(4)); assert.equal(view.controller.snapshot().acknowledgement.nativeId, id(90));
});
for (const hook of [0, 1]) test(`Actual Parent to Panel stale query/save from permission hook ${hook} cannot dispatch native reads or inserts`, async t => {
 const h = make(t); await ready(h); const p = panel(h); t.after(p.dispose); let view = p.render(); view.controller.change('Retained original', view.state.version); view = p.render(); const selects = h.selectCalls.length; h.permissionAPIs[hook].refreshPermissions(); assert.equal((await view.query.fetch()).ok, false); await view.save(); assert.equal(h.selectCalls.length, selects); assert.equal(h.nativeWrites.length, 0); assert.equal(view.controller.snapshot().draft, 'Retained original');
});
for (const hook of [0, 1]) test(`Actual Parent to Panel deferred native root response rejects hook ${hook} revocation before any source page`, async t => {
 const h = make(t); await ready(h); const gate = deferred(), entered = deferred(); h.state.selectIntercept = call => { if (call.table === 'clients' && call.columns === 'id,tenant_id') { entered.resolve(); return gate.promise; } };
 const p = panel(h); t.after(p.dispose); const view = p.render(), reading = view.query.fetch(); await entered.promise; const calls = h.selectCalls.length; h.permissionAPIs[hook].refreshPermissions(); gate.resolve({ data: { id: id(4), tenant_id: id(1) }, error: null, status: 200 }); const result = await reading;
 assert.equal(result.ok, false); assert.equal(h.selectCalls.length, calls); assert.equal(h.nativeWrites.length, 0);
});
test('Actual Parent to Panel old deferred root cannot consume after same-native new grants and whole original receipts', async t => {
 const h = make(t); await ready(h); const gate = deferred(), entered = deferred(); let held = false; h.state.selectIntercept = call => { if (!held && call.table === 'clients' && call.columns === 'id,tenant_id') { held = true; entered.resolve(); return gate.promise; } };
 const p = panel(h); t.after(p.dispose); const view = p.render(), reading = view.query.fetch(); await entered.promise; h.permissionAPIs[1].refreshPermissions(); h.render(); await ready(h); assert.ok(current(h).captureRead()); const calls = h.selectCalls.length; gate.resolve({ data: { id: id(4), tenant_id: id(1) }, error: null, status: 200 }); const result = await reading;
 assert.equal(result.ok, false); assert.equal(h.selectCalls.length, calls); assert.equal(h.nativeWrites.length, 0);
});
test('Actual native note acknowledgement after Read loss retains immutable original draft and cannot replay after fresh regrant', async t => {
 const h = make(t); await ready(h); const gate = deferred(), entered = deferred(); let payload; h.state.nativeIntercept = (_table, mode, value) => { if (mode === 'insert') { payload = value; entered.resolve(); return gate.promise; } };
 const p = panel(h); t.after(p.dispose); let view = p.render(); view.controller.change('Original held note', view.state.version); view = p.render(); const controller = view.controller, saving = view.save(); await entered.promise; assert.equal(controller.snapshot().busy, true); const attempt = controller.snapshot().original;
 h.permissionAPIs[0].refreshPermissions(); h.render(); gate.resolve({ data: { ...payload, id: id(90), created_at: '2026-10-08 10:00:00.654321+00:00', extra_original: { raw: 0 } }, error: null, status: 201 }); await saving;
 assert.equal(controller.snapshot().acknowledged, true); assert.equal(controller.snapshot().draft, 'Original held note'); assert.equal(controller.snapshot().original, attempt); assert.equal(controller.snapshot().acknowledgement.nativeOriginal.created_at, '2026-10-08 10:00:00.654321+00:00'); assert.deepEqual(controller.snapshot().acknowledgement.nativeOriginal.extra_original, { raw: 0 }); assert.equal(h.nativeWrites.length, 1);
 await ready(h); await h.api.parentRead.fullQuery.refresh(); h.render(); view = p.render(); await view.save(); assert.equal(h.nativeWrites.length, 1); assert.equal(controller.snapshot().draft, 'Original held note');
});
test('Actual note SDK ambiguous response locks the original attempt across tab disposal and fresh Parent receipts', async t => {
 const h = make(t, { nativeIntercept: (_table, mode) => mode === 'insert' ? { data: null, error: { code: '42501', message: 'Ambiguous transport response' }, status: 0 } : undefined }); await ready(h); const p = panel(h); let view = p.render(); view.controller.change('Unknown original note', view.state.version); view = p.render(); await view.save(); const controller = view.controller, attempt = controller.snapshot().original; assert.equal(controller.snapshot().uncertain, true); assert.equal(h.nativeWrites.length, 1); p.dispose(); await h.api.parentRead.fullQuery.refresh(); h.render(); const q = panel(h); t.after(q.dispose); view = q.render(); assert.equal(view.controller, controller); assert.equal(view.state.original, attempt); await view.save(); assert.equal(h.nativeWrites.length, 1); assert.equal(controller.snapshot().draft, 'Unknown original note');
});
test('Actual note malformed native root response causes definitive preinsert failure, retaining a correctable local draft', async t => {
 const h = make(t, { selectIntercept: call => call.table === 'clients' && call.columns === 'id,tenant_id' ? { data: { id: id(4), tenant_id: id(1) }, error: null } : undefined }); await ready(h); const p = panel(h); t.after(p.dispose); let view = p.render(); view.controller.change('Correctable before insert', view.state.version); view = p.render(); await view.save(); assert.equal(h.nativeWrites.length, 0); assert.equal(view.controller.snapshot().uncertain, false); assert.equal(view.controller.snapshot().draft, 'Correctable before insert'); assert.equal(view.controller.change('Explicit correction', view.controller.snapshot().version), true);
});

test('Fresh top-level native grants cannot revive a prior Timeline response without a fresh native source read', async t => {
 const h = make(t); await ready(h); const p = panel(h); t.after(p.dispose); let view = p.render(); assert.equal((await view.query.refresh()).ok, true); view = p.render(); assert.equal(view.ownPool, true); const oldResponse = view.query.data, before = current(h).captureRead(), parentBefore = h.api.parentRead.liveOriginalReceipt();
 h.permissionAPIs[0].refreshPermissions(); h.render(); await ready(h); const parentAfter = h.api.parentRead.liveOriginalReceipt(); assert.equal(parentAfter.owner, parentBefore.owner); assert.equal(parentAfter.recordTicket, parentBefore.recordTicket); assert.equal(parentAfter.fullTicket, parentBefore.fullTicket);
 view = p.render(); assert.equal(view.query.data, oldResponse); assert.equal(view.ownPool, false); assert.notEqual(current(h).captureRead().owner, before.owner); assert.equal((await view.query.refresh()).ok, true); view = p.render(); assert.equal(view.ownPool, true);
});
