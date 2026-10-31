import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { captureClientParentDetail, captureClientParentRecord, clientParentReadScope } from '../../src/lib/clients/clientRecordRead.web.ts';
import { woundUuid } from '../../src/lib/pflege/woundCareDomain.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(root + path, 'utf8');
const body = path => stripTypeScriptTypes(read(path).replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, ''));
const compose = (path, deps, names) => new Function(...Object.keys(deps), body(path) + ';return {' + names.join(',') + '};')(...Object.values(deps));
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const Clock = class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-11T12:34:56.789Z'])); } };
const catalog = compose('src/lib/permissions/staticRolePermissions.ts', {}, ['getPermissionsForRole', 'PERMISSION_DENIED_MESSAGES', 'PERMISSION_LABELS']);
const checks = compose('src/lib/permissions/check.ts', catalog, ['checkPermissionWithList', 'permissionError']);
const { enforcePermission } = compose('src/lib/permissions/enforce.ts', checks, ['enforcePermission']);
const { REMOTE_CLIENT_DELETED_STATUS } = compose('src/lib/services/clients/clientStatusBridge.ts', {}, ['REMOTE_CLIENT_DELETED_STATUS']);
const { toGermanSupabaseError } = compose('src/lib/supabase/errors.ts', {}, ['toGermanSupabaseError']);
const { resolveOfficeDocumentTitle } = compose('src/lib/office/officeDocumentDisplay.ts', { getSystemIntakeTemplateByKey: () => null }, ['resolveOfficeDocumentTitle']);
const detail = (tenant = id(1), client = id(4)) => ({ id: client, tenantId: tenant,
  core: { id: client, tenantId: tenant, diagnoses: ['whole original'] }, addresses: [], history: [{ raw: 'a' }, { raw: 'b' }],
  raw: { at: '2026-10-25T02:30:00.123456+02:00', optional: undefined } });
function receipt(actor = id(2)) {
  const scope = clientParentReadScope({ clientId: id(4), userId: actor, profileId: actor, profileTenant: id(1), profileRole: 'business_admin',
    serviceTenant: id(1), runtimeTenant: id(1), runtimeRole: 'business_admin', portalSession: false, canRead: true, canSensitive: true, canEdit: true });
  return { scopeKey: scope.key, owner: {}, recordTicket: 1, fullTicket: 2,
    record: captureClientParentRecord({ detail: detail(), careContexts: [], tabs: [] }, scope), full: captureClientParentDetail(detail(), scope), scope };
}
const doc = (overrides = {}) => ({ templateKey: 'privacy_consent_default', documentType: 'privacy_consent', title: 'Original Datenschutz',
  status: 'finalized', isRequired: true, version: 2, source: 'system', tenantTemplateId: null,
  previewHtml: '<p>raw preview</p>', finalizedHtml: '<p>raw finalized</p>', renderedPdfPath: null, missingPlaceholders: [], unresolvedKeys: [],
  previewOpenedAt: '2026-10-11 10:00:00.123456+00:00', finalizedAt: '2026-10-25T02:30:00.654321+02:00',
  signatures: { client: { role: 'client', dataUrl: 'data:image/png;base64,ORIGINAL', signedAt: '2026-10-25T02:30:00.123456+02:00', signerName: undefined },
    employee: { role: 'employee', dataUrl: 'data:image/png;base64,STAFF', signedAt: '2026-10-11 10:00:00.123456+00:00', signerName: 'Original Staff' } },
  unknownOriginal: { optional: undefined, history: ['z', 'a'] }, ...overrides });
const form = () => ({ intakeContractType: 'assist', intakeAssignmentEnabled: false, intakeDocuments: [doc({status:'preview_open',finalizedHtml:null,finalizedAt:null,signatures:{client:{role:'client',dataUrl:'',signedAt:'2026-10-25T02:30:00.123456+02:00',signerName:undefined},employee:{role:'employee',dataUrl:'',signedAt:'2026-10-11 10:00:00.123456+00:00',signerName:'Original Staff'}}})],
  unselectedOriginal: { raw: 'unchanged', optional: undefined, history: ['second', 'first'] } });

function harness(options = {}) {
  const calls = [], control = { original: receipt(), action: options.action ?? 'delete', actionTicket: {}, allowed: true,
    mode: 'supabase', tenantDenied: false, reads: 0, ...options };
  const defaultResult = call => {
    if (call.kind !== 'read') return { data: { id: id(40) }, error: null };
    if (call.table === 'clients') return { data: { status: 'active' }, error: null };
    if (call.table === 'assignments') return { data: null, error: null, count: 0 };
    if (call.table === 'client_intake_documents') return { data: call.cardinality ? { id: id(40) } : structuredClone(control.existingDocuments??[]), error: null };
    if (call.table === 'client_documents' && control.promotion === 'intake' && call.filters.some(([k]) => k === 'intake_document_id')) return { data: { id: id(41) }, error: null };
    if (call.table === 'client_documents' && control.promotion === 'file' && call.filters.some(([k]) => k === 'file_name')) return { data: { id: id(42), intake_document_id: null, source: 'upload', mime_type: 'application/pdf' }, error: null };
    return { data: null, error: null };
  };
  const db = { from(table) {
    const request = { table, kind: 'read', operation: 'select', filters: [] };
    const q = {
      select(selection, options) { request.selection = selection; if (options) request.options = structuredClone(options); return q; },
      eq(k, v) { request.filters.push([k, v]); if (request.kind === 'write' && table === 'clients' && k === 'tenant_id') control.beforeDispatchBuilder?.(request); return q; },
      not(k, op, v) { request.filters.push([k, op, v]); return q; }, limit(n) { request.limit = n; return q; },
      single() { request.cardinality = 'single'; return q; }, maybeSingle() { request.cardinality = 'maybeSingle'; if (request.kind === 'read' && table === 'clients') control.beforeDispatchBuilder?.(request); return q; },
      update(payload) { request.kind = 'write'; request.operation = 'update'; request.payload = structuredClone(payload); return q; },
      insert(payload) { request.kind = 'write'; request.operation = 'insert'; request.payload = structuredClone(payload); return q; },
      upsert(payload, options) { request.kind = 'write'; request.operation = 'upsert'; request.payload = structuredClone(payload); request.options = structuredClone(options); return q; },
      then(resolve, reject) { control.onNativeThen?.(request); return Promise.resolve().then(async () => {
        const call = structuredClone(request); calls.push(call);
        const override = await control.intercept?.(call, calls.length - 1, control);
        return override === undefined ? defaultResult(call) : override;
      }).then(resolve, reject); },
    };
    return q;
  } };
  control.db = db;
  const deps = { captureClientParentDetail, captureClientParentRecord, woundUuid,
    getSupabaseClient: () => control.db, toGermanSupabaseError, getServiceMode: () => control.mode,
    guardServiceTenant: () => control.tenantDenied ? { ok: false, error: 'denied' } : null,
    enforcePermission, DEMO_TENANT_ID: id(999), resolveOfficeDocumentTitle, REMOTE_CLIENT_DELETED_STATUS, Date: Clock };
  const { ClientRecordNativeWrites } = compose('src/lib/clients/clientRecordNativeWrites.web.ts', deps, ['ClientRecordNativeWrites']);
  const controller = new ClientRecordNativeWrites();
  const current = () => { control.reads++; return control.sourceAbsent ? null : { original: control.original, action: control.action, actionTicket: control.actionTicket, allowed: control.allowed }; };
  return { calls, control, db, deps, controller, current, capture: () => controller.capture(current), writes: () => calls.filter(c => c.kind === 'write') };
}

function sharedDelete(h) {
  const common = { ...h.deps, fromUnknownTable: (db, table) => db.from(table), SERVICE_ERRORS: { unexpected: 'unexpected', supabaseUnavailable: 'unavailable' } };
  const assignment = compose('src/lib/office/officeDeleteGuard.ts', common, ['assertNoActiveAssignmentsForClient']);
  const audit = compose('src/lib/services/clients/clientAuditHelper.ts', common, ['writeClientAudit', 'writeClientHistory']);
  const status = compose('src/lib/services/clients/clientStatusBridge.ts', {}, ['REMOTE_CLIENT_DELETED_STATUS']);
  const { supabaseClientRepository } = compose('src/lib/services/clients/clientRepository.supabase.ts', { ...common, ...assignment, ...audit, ...status }, ['supabaseClientRepository']);
  const { runService } = compose('src/lib/services/serviceRunner.ts', { ...common, setTimeout: callback => { callback(); return 0; } }, ['runService']);
  const { clientService } = compose('src/lib/services/clients/clientService.ts', { ...common, supabaseClientRepository, runService }, ['clientService']);
  return compose('src/lib/office/clientDetailService.ts', { ...common, clientService }, ['deleteClient']).deleteClient;
}
function sharedRecovery(h) {
  return compose('src/features/intakeDocuments/intakeDocumentRepository.ts', { ...h.deps, SERVICE_ERRORS: { supabaseUnavailable: 'unavailable' } }, ['persistIntakeDocumentsForClient']).persistIntakeDocumentsForClient;
}

test('Complete native Delete retains whole Office/service/repository/assignment/history/audit payloads and filters', async () => {
  const h = harness(), actual = await h.controller.delete(h.capture(), '  Native Actor  ');
  const legacy = harness(), previous = await sharedDelete(legacy)(id(4), id(1), 'business_admin', id(2), '  Native Actor  ');
  assert.equal(previous.ok, true); assert.equal(actual.status, 'acknowledged'); assert.equal(actual.currentAtReturn, true);
  assert.deepEqual(h.calls, legacy.calls); assert.equal(h.writes().length, 3);
  assert.deepEqual(actual.steps.map(s => s.outcome), Array(6).fill('acknowledged'));
  assert.ok(Object.isFrozen(actual)); assert.ok(Object.isFrozen(actual.steps)); assert.ok(Object.isFrozen(actual.steps[0]));
});
for (const promotion of ['insert','intake','file'])for(const status of ['finalized','signed','pending_signature']){
 test(`Native Recovery/${promotion}/${status} matches current shared original-preservation policy`,async()=>{
  const h=harness({action:'recovery',promotion}),input=form();input.intakeDocuments[0].status=status;
  const before=structuredClone(input),result=await h.controller.recover(h.capture(),input),legacy=harness({action:'recovery',promotion}),previous=await sharedRecovery(legacy)(id(1),id(4),input,id(2));
  assert.deepEqual(h.calls,legacy.calls);assert.deepEqual(input,before);
  if(status==='pending_signature'){
   assert.equal(previous.ok,true);assert.equal(result.status,'acknowledged');assert.equal(result.currentAtReturn,true);
   assert.equal(Object.hasOwn(h.writes().find(c=>c.table==='client_intake_documents').payload,'tenant_template_id'),true);
  }else{assert.equal(previous.ok,false);assert.equal(result.status,'blocked');assert.equal(result.writeStarted,false);assert.equal(h.writes().length,0);assert.match(result.error,/atomaren Serverabschluss/);}
  assert.equal(h.writes().filter(c=>c.table==='client_document_signatures').length,0);
 });
}
test('Empty original intake selection follows the existing native Consent path without invented signatures/promotions', async () => {
  const h = harness({ action: 'recovery' }), f = form(); f.intakeContractType = ''; f.intakeDocuments = [];
  assert.equal((await h.controller.recover(h.capture(), f)).status, 'acknowledged');
  assert.deepEqual(h.calls.map(c=>c.table),['client_intake_documents']);assert.equal(h.writes().length,0);
});
test('Whole original form is captured synchronously before first await, retaining raw times/undefined and all later payloads', async () => {
  const h = harness({ action: 'recovery' }), f = form(), before = structuredClone(f);
  let release; h.control.intercept = (_, index) => index === 0 ? new Promise(resolve => { release = resolve; }) : undefined;
  const pending = h.controller.recover(h.capture(), f); await Promise.resolve(); await Promise.resolve();
  f.intakeDocuments[0].title = 'changed'; f.intakeDocuments[0].signatures.client.signedAt = 'normalized'; f.intakeDocuments.length = 0;
  f.unselectedOriginal.history.reverse(); release(undefined);
  assert.equal((await pending).status, 'acknowledged');
  const legacy = harness({ action: 'recovery' }); await sharedRecovery(legacy)(id(1), id(4), before, id(2));
  assert.deepEqual(h.calls, legacy.calls);
});

for (const action of ['delete', 'recovery']) for (const loss of ['allowed', 'read', 'actionTicket', 'recordTicket', 'fullTicket', 'record', 'full', 'owner', 'account', 'mode', 'tenant', 'db', 'dispose']) {
  test(`Retained ${action} lease rejects current ${loss} loss before any native request`, async () => {
    const h = harness({ action }), lease = h.capture(); assert.ok(lease);
    if (loss === 'allowed') h.control.allowed = false;
    if (loss === 'read') h.control.original = { ...h.control.original, scope: { ...h.control.original.scope, canRead: false } };
    if (loss === 'actionTicket') h.control.actionTicket = {};
    if (['recordTicket', 'fullTicket'].includes(loss)) h.control.original = { ...h.control.original, [loss]: 99 };
    if (['record', 'full', 'owner'].includes(loss)) h.control.original = { ...h.control.original, [loss]: {} };
    if (loss === 'account') h.control.original = receipt(id(3));
    if (loss === 'mode') h.control.mode = 'demo';
    if (loss === 'tenant') h.control.tenantDenied = true;
    if (loss === 'db') h.control.db = null;
    if (loss === 'dispose') h.controller.dispose();
    const result = await (action === 'delete' ? h.controller.delete(lease) : h.controller.recover(lease, form()));
    assert.equal(result.status, 'blocked'); assert.equal(result.writeStarted, false); assert.equal(result.currentAtReturn, false); assert.equal(h.calls.length, 0);
  });
}
test('Fresh receipt wrapper with exact whole originals remains current, while recovery cannot borrow Delete-only permission', async () => {
  const h = harness({ action: 'recovery' }), lease = h.capture(); h.control.original = { ...h.control.original, scope: { ...h.control.original.scope, canEdit: false } };
  assert.equal((await h.controller.recover(lease, form())).status, 'blocked'); assert.equal(h.calls.length, 0);
  const positive = harness(); const same = positive.capture(); positive.control.original = { ...positive.control.original };
  assert.equal((await positive.controller.delete(same)).status, 'acknowledged');
});
test('Static role alone, signed data and unknown native owners cannot mint a private write lease', () => {
  for (const change of [h => h.control.allowed = false, h => h.control.action = 'edit', h => h.control.actionTicket = null,
    h => h.control.original = { ...h.control.original, recordTicket: 0 },
    h => h.control.original = { ...h.control.original, full: { ...h.control.original.full, tenantId: id(99) } },
    h => h.control.original = { ...h.control.original, scope: { ...h.control.original.scope, role: 'caregiver' } }]) {
    const h = harness({ action: 'recovery' }); change(h); assert.equal(h.capture(), null); assert.equal(h.calls.length, 0);
  }
});
test('Mutable outer or nested originals cannot retain a trusted original receipt after capture', () => {
  for (const key of ['record', 'full']) for (const outerFrozen of [false, true]) {
    const h = harness(), original = structuredClone(h.control.original[key]);
    if (outerFrozen) Object.freeze(original);
    h.control.original = { ...h.control.original, [key]: original };
    assert.equal(h.capture(), null); assert.equal(h.calls.length, 0);
    if (key === 'full') original.core.tenantId = id(99);
    else original.detail.core.tenantId = id(99);
    assert.equal(h.capture(), null); assert.equal(h.calls.length, 0);
  }
});
for (const key of ['recordTicket', 'fullTicket']) test(`Unsafe integer ${key} cannot recognize an original read generation`, () => {
  const h = harness(); h.control.original = { ...h.control.original, [key]: Number.MAX_SAFE_INTEGER + 1 };
  assert.equal(h.capture(), null); assert.equal(h.calls.length, 0);
});
test('Receipt-scope accessors cannot execute while minting a native write lease', () => {
  const h = harness(), scope = { ...h.control.original.scope }; let executed = 0;
  Object.defineProperty(scope, 'role', { enumerable: true, get() { executed++; return 'business_admin'; } });
  h.control.original = { ...h.control.original, scope };
  assert.equal(h.capture(), null); assert.equal(executed, 0); assert.equal(h.calls.length, 0);
});
test('Whole capture preserves unselected original form fields, unknown data and own undefined without aliasing', () => {
  const h = harness({ action: 'recovery' }), f = form();
  const { captureForm } = compose('src/lib/clients/clientRecordNativeWrites.web.ts', h.deps, ['captureForm']);
  const captured = captureForm(f); assert.deepEqual(captured, f); assert.notEqual(captured, f);
  assert.ok(Object.hasOwn(captured.unselectedOriginal, 'optional')); assert.ok(Object.isFrozen(captured.unselectedOriginal.history));
  f.unselectedOriginal.history.reverse(); assert.deepEqual(captured.unselectedOriginal.history, ['second', 'first']);
});

for (let boundary = 0; boundary < 6; boundary++) test(`Actual Delete await ${boundary + 1} checks current right before any next SDK step`, async () => {
  const h = harness(); h.control.intercept = (_, index) => { if (index === boundary) h.control.allowed = false; };
  const result = await h.controller.delete(h.capture());
  assert.equal(h.calls.length, boundary + 1);
  assert.equal(result.status, boundary === 5 ? 'acknowledged' : boundary < 3 ? 'blocked' : 'uncertain');
  assert.equal(result.writeStarted, boundary >= 3); assert.equal(result.currentAtReturn, false);
  assert.equal(result.steps.at(-1).outcome, 'acknowledged');
});
for (let boundary = 0; boundary < 5; boundary++) test(`Actual full Recovery await ${boundary + 1} stops next native step but preserves all known acknowledgements`, async () => {
  const h = harness({ action: 'recovery' }); h.control.intercept = (_, index) => { if (index === boundary) h.control.allowed = false; };
  const result = await h.controller.recover(h.capture(), form());
  assert.equal(h.calls.length,boundary+1);assert.equal(result.status,boundary===4?'acknowledged':boundary===0?'blocked':'uncertain');
  assert.equal(result.writeStarted,boundary>0); assert.equal(result.currentAtReturn, false); assert.equal(result.steps.at(-1).outcome, 'acknowledged');
});
for (const loss of ['actionTicket', 'recordTicket', 'fullTicket', 'record', 'full', 'owner', 'account', 'mode', 'tenant', 'db', 'liveOriginalAbsent']) {
  test(`Original ${loss} loss during the real ClientUpdate await preserves partial SDK ACK and prevents history/audit`, async () => {
    const h = harness(); h.control.intercept = (_, index) => {
      if (index !== 3) return;
      if (loss === 'actionTicket') h.control.actionTicket = {};
      if (['recordTicket', 'fullTicket'].includes(loss)) h.control.original = { ...h.control.original, [loss]: 99 };
      if (['record', 'full', 'owner'].includes(loss)) h.control.original = { ...h.control.original, [loss]: {} };
      if (loss === 'account') h.control.original = receipt(id(3));
      if (loss === 'mode') h.control.mode = 'demo';
      if (loss === 'tenant') h.control.tenantDenied = true;
      if (loss === 'db') h.control.db = {};
      if (loss === 'liveOriginalAbsent') h.control.sourceAbsent = true;
    };
    const result = await h.controller.delete(h.capture()); assert.equal(result.status, 'uncertain'); assert.equal(result.currentAtReturn, false);
    assert.equal(result.steps.at(-1).outcome, 'acknowledged'); assert.equal(h.writes().length, 1);
  });
}
test('Delete continuation uses its own current action right while unrelated Edit loss does not remove an actual Delete ACK', async () => {
  const h = harness(); h.control.intercept = (_, index) => { if (index === 3) h.control.original = { ...h.control.original, scope: { ...h.control.original.scope, canEdit: false } }; };
  const result = await h.controller.delete(h.capture()); assert.equal(result.status, 'acknowledged'); assert.equal(result.currentAtReturn, true); assert.equal(h.writes().length, 3);
});
test('Pending native mutation is never declared cancelled or replayed when the original lifetime disappears', async () => {
  const h = harness(); let release;
  h.control.intercept = (call, index) => index === 3 ? new Promise(resolve => { release = resolve; }) : undefined;
  const lease = h.capture(), pending = h.controller.delete(lease);
  while (!release) await Promise.resolve(); h.controller.dispose(); h.controller.mount();
  assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.writes().length, 1);
  release({ error: null }); const result = await pending;
  assert.equal(result.status, 'uncertain'); assert.equal(result.steps.at(-1).outcome, 'acknowledged');
  assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.writes().length, 1);
});

for (const action of ['delete', 'recovery']) {
  const length=action==='delete'?6:5;
  for (let failed = 0; failed < length; failed++) test(`${action} checks returned native error at required step ${failed + 1} and never starts a later step`, async () => {
    const h = harness({ action }); h.control.intercept = (_, index) => index === failed ? { data: null, error: { code: '42501', message: 'permission denied' } } : undefined;
    const result = await (action === 'delete' ? h.controller.delete(h.capture()) : h.controller.recover(h.capture(), form()));
    assert.equal(h.calls.length, failed + 1); assert.equal(result.steps.at(-1).outcome, 'failed');
    assert.equal(result.status,action==='delete'&&failed<3||action==='recovery'&&failed===0?'blocked':'uncertain'); assert.equal(result.currentAtReturn, false);
  });
}
for (const table of ['client_history_entries', 'client_audit_entries']) test(`Actual old ${table}.error was ignored; private chain now retains partial ACK and uncertainty`, async () => {
  const failure = call => call.table === table ? { error: { code: '42501', message: 'permission denied' } } : undefined;
  const legacy = harness(); legacy.control.intercept = failure;
  assert.equal((await sharedDelete(legacy)(id(4), id(1), 'business_admin', id(2), null)).ok, true); assert.equal(legacy.writes().length, 3);
  const h = harness(); h.control.intercept = failure; const result = await h.controller.delete(h.capture());
  assert.equal(result.status, 'uncertain'); assert.equal(result.steps.find(s => s.name === 'clients.softDelete').outcome, 'acknowledged');
  assert.equal(h.writes().length, table === 'client_history_entries' ? 2 : 3);
});
test('Current shared and private native document-event errors stop before consent or promotion', async () => {
  const failure = call => call.table === 'client_document_events' ? { error: { code: '42501', message: 'permission denied' } } : undefined;
  const legacy = harness({ action: 'recovery' }); legacy.control.intercept = failure;
  assert.equal((await sharedRecovery(legacy)(id(1),id(4),form(),id(2))).ok,false);assert.equal(legacy.calls.length,4);
  const h = harness({ action: 'recovery' }); h.control.intercept = failure;
  const result = await h.controller.recover(h.capture(), form());
  assert.equal(result.status, 'uncertain'); assert.deepEqual(h.calls.map(c=>c.table),['client_intake_documents','client_contract_selection','client_intake_documents','client_document_events']);assert.deepEqual(h.calls,legacy.calls);
});
for (const value of [undefined, null, {}, { error: undefined }, { error: false }, { error: 0 }, { error: '' }, { ok: true }]) test(`Malformed native mutation acknowledgement ${JSON.stringify(value)} cannot complete or release its owner`, async () => {
  const h = harness(); h.control.intercept = (call, index) => index === 3 ? Promise.resolve(value === undefined ? {} : value) : undefined;
  const result = await h.controller.delete(h.capture()); assert.equal(result.status, 'uncertain'); assert.equal(result.steps.at(-1).outcome, 'unresolved');
  assert.equal(h.writes().length, 1); assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.writes().length, 1);
});
test('Native error/data accessors are not executed as acknowledgement or identifier proofs', async () => {
  let calls = 0; const h = harness(); const response = {};
  Object.defineProperty(response, 'error', { enumerable: true, get() { calls++; return null; } });
  h.control.intercept = (_, index) => index === 3 ? response : undefined;
  assert.equal((await h.controller.delete(h.capture())).status, 'uncertain'); assert.equal(calls, 0);
  const r = harness({ action: 'recovery' }), data = {};
  Object.defineProperty(data, 'id', { enumerable: true, get() { calls++; return id(40); } });
  r.control.intercept=(_,index)=>index===2?{error:null,data}:undefined;
  assert.equal((await r.controller.recover(r.capture(), form())).status, 'uncertain'); assert.equal(calls, 0); assert.equal(r.calls.length,3);
});
for (const code of ['23505', '08006']) test(`Native document ${code} remains unconfirmed without automatic insert/query fallback`, async () => {
  const h = harness({ action: 'recovery' }); h.control.intercept=(call,index)=>index===2? { error: { code, message: 'native write error' } } : undefined;
  assert.equal((await h.controller.recover(h.capture(), form())).status, 'uncertain'); assert.equal(h.calls.length,3);
  assert.equal((await h.controller.recover(h.capture(), form())).status, 'blocked'); assert.equal(h.calls.length,3);
});
for (const stage of ['clients', 'client_intake_documents', 'client_audit_entries']) test(`Thrown native ${stage} result preserves an honest before-write/after-ingress outcome`, async () => {
  const action = stage === 'client_intake_documents' ? 'recovery' : 'delete', h = harness({ action });
  h.control.intercept = call => { if (call.table === stage) throw Error('transport lost'); };
  const result = await (action === 'delete' ? h.controller.delete(h.capture()) : h.controller.recover(h.capture(), form()));
  assert.equal(result.status,stage==='clients'||stage==='client_intake_documents'?'blocked':'uncertain'); assert.equal(result.steps.at(-1).outcome, 'unresolved');
});

for (const value of [null, undefined, -1, 0.5, '0', NaN]) test(`Unconfirmed assignment count ${String(value)} cannot authorize a native Delete`, async () => {
  const h = harness(); h.control.intercept = call => call.table === 'assignments' ? { data: null, count: value, error: null } : undefined;
  assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.writes().length, 0);
});
for (const status of ['inactive', 'archived', 'deceased', 'ARCHIVED']) test(`Existing native lifecycle guard retains ${status} client without writes`, async () => {
  const h = harness(); h.control.intercept = call => call.table === 'clients' ? { data: { status }, error: null } : undefined;
  assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.writes().length, 0);
});
for (const status of [REMOTE_CLIENT_DELETED_STATUS, REMOTE_CLIENT_DELETED_STATUS.toUpperCase()]) test(`Already native ${status} retains original deletion time/history/audit: actual legacy 3 write attempts, private 0`, async () => {
  const result = call => call.table === 'clients' && call.kind === 'read' ? { data: { status }, error: null } : undefined;
  const legacy = harness(); legacy.control.intercept = result;
  assert.equal((await sharedDelete(legacy)(id(4), id(1), 'business_admin', id(2), 'Original Actor')).ok, true);
  assert.equal(legacy.writes().length, 3); assert.equal(legacy.writes()[0].payload.deleted_at, new Clock().toISOString());
  const h = harness(), current = h.control.original;
  const originalData = { ...detail(), status, deletedAt: '2026-10-08 09:10:11.123456+00:00',
    history: [{ status: 'archiviert', raw: 'Original deletion evidence' }], audit: [{ raw: 'Original audit evidence' }] };
  h.control.original = { ...current, record: captureClientParentRecord({ detail: originalData, careContexts: [], tabs: [] }, current.scope),
    full: captureClientParentDetail(originalData, current.scope) };
  const original = h.control.original, before = structuredClone(originalData); h.control.intercept = result;
  const blocked = await h.controller.delete(h.capture(), 'Original Actor');
  assert.equal(blocked.status, 'blocked'); assert.equal(blocked.writeStarted, false); assert.equal(h.writes().length, 0);
  assert.deepEqual(original.full, before); assert.deepEqual(original.record.detail, before);
  assert.equal(h.control.original.full, original.full); assert.equal(h.control.original.record, original.record);
  assert.notEqual(legacy.writes()[0].payload.deleted_at, original.full.deletedAt);
});
test('Actual native offboarding presence and active assignments block with no mutation ingress', async () => {
  for (const stage of ['offboarding', 'assignments']) {
    const h = harness(); h.control.intercept = call => stage === 'offboarding' && call.table === 'client_offboarding_cases'
      ? { data: { id: id(50), status: 'completed' }, error: null }
      : stage === 'assignments' && call.table === 'assignments' ? { data: null, count: 2, error: null } : undefined;
    assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.writes().length, 0);
  }
});
for (const value of [null, {}, { id: 'invented' }, { id: id(40) + ' ' }]) test(`Required original native document identity ${JSON.stringify(value)} is not invented or skipped`, async () => {
  const h = harness({ action: 'recovery' }); h.control.intercept=(_,index)=>index===2?{data:value,error:null}:undefined;
  assert.equal((await h.controller.recover(h.capture(),form())).status,'uncertain');assert.equal(h.calls.length,3);
});
test('Original document lookup error stops native recovery before any mutation',async()=>{
 const h=harness({action:'recovery'});h.control.intercept=(_,index)=>index===0?{data:null,error:{code:'42501',message:'denied'}}:undefined;
 const result=await h.controller.recover(h.capture(),form());assert.equal(result.status,'blocked');assert.equal(result.writeStarted,false);assert.equal(h.calls.length,1);assert.equal(h.writes().length,0);
});
test('Multiple unsigned original documents retain order; an intermediate saved-document ACK cannot complete the chain',async()=>{
 const h=harness({action:'recovery'}),input=form();input.intakeDocuments.push({...structuredClone(input.intakeDocuments[0]),templateKey:'contract_assist',documentType:'client_contract',title:'Original Vertrag'});
 let events=0;h.control.intercept=call=>{if(call.table==='client_document_events'&&call.kind==='write'&&++events===1)h.control.allowed=false;};
 const result=await h.controller.recover(h.capture(),input);assert.equal(result.status,'uncertain');assert.equal(events,1);assert.equal(result.steps.at(-1).outcome,'acknowledged');
 assert.deepEqual(h.writes().filter(c=>c.table==='client_intake_documents').map(c=>c.payload.template_key),['privacy_consent_default']);assert.equal(h.writes().some(c=>c.table==='client_consent_status'),false);
});

for (const malformed of [f => f.extra = new Date(), f => f.extra = new Map(), f => f.extra = 1n, f => f.extra = Infinity,
  f => f.extra = Array(1), f => f.self = f, f => f.intakeDocuments.push(structuredClone(f.intakeDocuments[0])),
  f => f.intakeDocuments[0].tenantTemplateId = 'fake', f => f.intakeDocuments[0].signatures.client.signedAt = 0]) {
  test(`Unsupported whole original DTO is blocked before any native request: ${malformed.toString()}`, async () => {
    const h = harness({ action: 'recovery' }), f = form(); malformed(f);
    const result = await h.controller.recover(h.capture(), f); assert.equal(result.status, 'blocked'); assert.equal(result.writeStarted, false); assert.equal(h.calls.length, 0);
  });
}
test('Unknown/nonenumerable/symbol input accessors cannot disappear or execute during full capture', async () => {
  for (const property of ['getter', 'nonenumerable', 'symbol']) {
    const h = harness({ action: 'recovery' }), f = form(); let executed = 0;
    Object.defineProperty(f, property === 'symbol' ? Symbol('original') : 'unknown', property === 'getter'
      ? { enumerable: true, get() { executed++; return 'raw'; } } : { enumerable: property === 'symbol', value: 'raw' });
    assert.equal((await h.controller.recover(h.capture(), f)).status, 'blocked'); assert.equal(executed, 0); assert.equal(h.calls.length, 0);
  }
});
test('Own undefined/null optional signatures remain unchanged and never become invented native signatures', async () => {
  const h = harness({ action: 'recovery' }), f = form(); f.intakeDocuments[0].signatures.employee = undefined; f.intakeDocuments[0].signatures.legal_representative = null;
  assert.equal((await h.controller.recover(h.capture(), f)).status, 'acknowledged');
  assert.deepEqual(h.writes().filter(c=>c.table==='client_document_signatures'),[]);
});
test('Unknown mutation stays latched across fresh Reads, owner A→B→A and dispose/remount without automatic replay', async () => {
  const h = harness(); h.control.intercept = (_, index) => index === 3 ? { error: { code: '08006', message: 'unknown transport' } } : undefined;
  assert.equal((await h.controller.delete(h.capture())).status, 'uncertain');
  const nativeWrites = h.writes().length; h.control.original = receipt(id(3)); h.capture(); h.control.original = receipt();
  h.controller.dispose(); h.controller.mount(); h.control.intercept = undefined;
  assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.writes().length, nativeWrites);
});
test('Native Delete ACK cannot be replayed by the old lease or a fresh original read', async () => {
  const h = harness(), lease = h.capture(); assert.equal((await h.controller.delete(lease)).status, 'acknowledged');
  assert.equal((await h.controller.delete(lease)).status, 'blocked'); h.control.original = receipt(); h.control.actionTicket = {};
  assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.writes().length, 3);
});
test('A retained outcome snapshot cannot authorize later UI after current rights, lifetime or minted action ticket loss', async () => {
  for (const loss of ['rights', 'lifetime', 'ticket', 'original']) {
    const h = harness(), lease = h.capture(), result = await h.controller.delete(lease);
    assert.equal(result.status, 'acknowledged'); assert.equal(result.currentAtReturn, true); assert.equal(h.controller.mayFollowup(lease, result), true);
    if (loss === 'rights') h.control.allowed = false;
    if (loss === 'lifetime') h.controller.dispose();
    if (loss === 'ticket') h.control.actionTicket = {};
    if (loss === 'original') h.control.original = receipt();
    assert.equal(result.status, 'acknowledged'); assert.equal(result.currentAtReturn, true);
    assert.equal(h.controller.mayFollowup(lease, result), false);
  }
});
test('Freshly fabricated, foreign-controller or different-lease positive outcomes grant no follow-up authority', async () => {
  const h = harness(), lease = h.capture(), result = await h.controller.delete(lease);
  const other = harness(), different = h.capture();
  assert.equal(h.controller.mayFollowup(lease, { ...result }), false);
  assert.equal(other.controller.mayFollowup(lease, result), false);
  assert.equal(h.controller.mayFollowup(different, result), false);
});
test('Current whole Recovery ACK blocks the same original; an explicitly new original/action lease is a separate known operation', async () => {
  const h = harness({ action: 'recovery' }); assert.equal((await h.controller.recover(h.capture(), form())).status, 'acknowledged');
  const n = h.calls.length; assert.equal((await h.controller.recover(h.capture(), form())).status, 'blocked'); assert.equal(h.calls.length, n);
  h.control.original = receipt(); h.control.actionTicket = {};
  assert.equal((await h.controller.recover(h.capture(), form())).status, 'acknowledged'); assert.equal(h.calls.length, 2 * n);
});
test('Synchronous single flight blocks retained duplicate and cross-action calls before native SDK ingress', async () => {
  const h = harness({ action: 'recovery' }), lease = h.capture(); let release;
  h.control.intercept = (_, index) => index === 0 ? new Promise(resolve => { release = resolve; }) : undefined;
  const pending = h.controller.recover(lease, form()); while (!release) await Promise.resolve();
  assert.equal((await h.controller.recover(lease, form())).status, 'blocked'); h.control.action = 'delete'; h.control.actionTicket = {};
  assert.equal((await h.controller.delete(h.capture())).status, 'blocked'); assert.equal(h.calls.length, 1);
  release({data:[],error:null});assert.equal((await pending).status,'blocked');assert.equal(h.calls.length,1);
});
test('Private native archive preserves the actual live hardblock with zero native calls and no false mutation latch', async () => {
  const h = harness({ action: 'archive' }), result = await h.controller.archive(h.capture());
  assert.equal(result.status, 'blocked'); assert.equal(result.writeStarted, false); assert.equal(h.calls.length, 0);
  const actual = compose('src/lib/services/clients/clientService.ts', h.deps, ['clientService']).clientService;
  assert.equal((await actual.archive(id(1), id(4))).error, result.error); assert.equal(h.calls.length, 0);
  h.control.action = 'delete'; h.control.actionTicket = {}; assert.equal((await h.controller.delete(h.capture())).status, 'acknowledged');
});

test('Only an actual own no-mutation native attempt supplies unstarted evidence, without current read/right grants',async()=>{const h=harness(),lease=h.capture();h.control.intercept=(_,i)=>{if(i===0)h.control.allowed=false;};const result=await h.controller.delete(lease);assert.equal(result.status,'blocked');assert.equal(result.writeStarted,false);assert.equal(h.writes().length,0);assert.equal(h.controller.isOwnUnstarted(lease,result),true);assert.equal(h.controller.mayFollowup(lease,result),false);});
for(const guard of ['deleted','offboarding','assignments'])test(`Actual ${guard} guard supplies known-zero-mutation evidence`,async()=>{const h=harness(),lease=h.capture();h.control.intercept=call=>guard==='deleted'&&call.table==='clients'?{data:{status:'deleted'},error:null}:guard==='offboarding'&&call.table==='client_offboarding_cases'?{data:{id:id(70),status:'open'},error:null}:guard==='assignments'&&call.table==='assignments'?{data:null,count:2,error:null}:undefined;const result=await h.controller.delete(lease);assert.equal(h.controller.isOwnUnstarted(lease,result),true);assert.equal(h.writes().length,0);});
test('Fabricated, foreign-controller and other-lease blocked outcomes cannot supply unstarted evidence',async()=>{const h=harness(),lease=h.capture();h.control.intercept=call=>call.table==='assignments'?{data:null,count:1,error:null}:undefined;const result=await h.controller.delete(lease),other=harness();assert.equal(h.controller.isOwnUnstarted(lease,{...result}),false);assert.equal(other.controller.isOwnUnstarted(lease,result),false);assert.equal(h.controller.isOwnUnstarted(h.capture(),result),false);});
test('An unstarted result from a disposed or replaced controller lifetime is not releasable evidence',async()=>{const h=harness(),lease=h.capture();h.control.intercept=call=>call.table==='assignments'?{data:null,count:1,error:null}:undefined;const result=await h.controller.delete(lease);h.controller.dispose();assert.equal(h.controller.isOwnUnstarted(lease,result),false);h.controller.mount();assert.equal(h.controller.isOwnUnstarted(lease,result),false);});
for(const status of ['uncertain','acknowledged'])test(`After first native mutation, ${status} outcome and later journal block cannot claim zero-mutation evidence`,async()=>{const h=harness(),lease=h.capture();h.control.intercept=(_,i)=>i===3&&status==='uncertain'?{error:{code:'08006',message:'unknown'}}:undefined;const result=await h.controller.delete(lease);assert.equal(result.status,status);assert.equal(h.controller.isOwnUnstarted(lease,result),false);h.control.original=receipt();h.control.actionTicket={};const later=h.capture(),blocked=await h.controller.delete(later);assert.equal(blocked.writeStarted,false);assert.equal(h.controller.isOwnUnstarted(later,blocked),false);});
test('First own stale lease and native hard archive block recognize no mutation without granting follow-up',async()=>{const h=harness(),lease=h.capture();h.control.allowed=false;const result=await h.controller.delete(lease);assert.equal(h.controller.isOwnUnstarted(lease,result),true);assert.equal(h.calls.length,0);assert.equal(h.controller.isOwnUnstarted(lease,await h.controller.delete(lease)),false);const archive=harness({action:'archive'}),a=archive.capture(),blocked=await archive.controller.archive(a);assert.equal(archive.controller.isOwnUnstarted(a,blocked),true);assert.equal(archive.controller.mayFollowup(a,blocked),false);});
test('Malformed whole original Recovery form mints only its own first unstarted invocation and preserves no-replay boundaries',async()=>{const h=harness({action:'recovery'}),lease=h.capture(),input=form();delete input.intakeDocuments[0].previewOpenedAt;const result=await h.controller.recover(lease,input);assert.equal(h.calls.length,0);assert.equal(h.controller.isOwnUnstarted(lease,result),true);assert.equal(h.controller.mayFollowup(lease,result),false);assert.equal(h.controller.isOwnUnstarted(lease,await h.controller.recover(lease,input)),false);});
test('SDK missing after a current first lease is known unstarted; concurrent/fabricated calls never supply that evidence',async()=>{const h=harness(),lease=h.capture();h.control.db=null;const result=await h.controller.delete(lease);assert.equal(h.controller.isOwnUnstarted(lease,result),true);assert.equal(h.calls.length,0);assert.equal(h.controller.isOwnUnstarted(lease,{...result}),false);const other=harness();assert.equal(other.controller.isOwnUnstarted(lease,result),false);});
test('Concurrent invocation and a later unknown owner journal cannot reuse earlier zero-mutation evidence',async()=>{const h=harness(),lease=h.capture();h.control.intercept=call=>call.table==='assignments'?{data:null,count:1,error:null}:undefined;const unstarted=await h.controller.delete(lease);assert.equal(h.controller.isOwnUnstarted(lease,unstarted),true);let release;h.control.intercept=(_,i)=>i===6?new Promise(r=>{release=r;}):undefined;const next=h.capture(),pending=h.controller.delete(next);while(!release)await Promise.resolve();const concurrent=h.capture(),blocked=await h.controller.delete(concurrent);assert.equal(h.controller.isOwnUnstarted(concurrent,blocked),false);assert.equal(h.controller.isOwnUnstarted(lease,unstarted),false);release({error:{code:'08006',message:'actual first mutation unresolved'}});assert.equal((await pending).status,'uncertain');assert.equal(h.controller.isOwnUnstarted(lease,unstarted),false);});

for(const kind of ['read','write'])for(const timing of ['synchronous','queued'])test(`Actual native ${kind} dispatch checks current authority without an await-to-then gap after ${timing} builder loss`,async()=>{
 const h=harness(),lease=h.capture(),dispatches=[];h.control.beforeDispatchBuilder=request=>{if(request.kind===kind){if(timing==='queued')queueMicrotask(()=>{h.control.allowed=false;});else h.control.allowed=false;}};
 h.control.onNativeThen=request=>dispatches.push({table:request.table,kind:request.kind,allowed:h.control.allowed});
 const result=await h.controller.delete(lease),targeted=dispatches.filter(x=>x.table==='clients'&&x.kind===kind);
 assert.equal(targeted.length,timing==='queued'?1:0);assert.ok(dispatches.every(x=>x.allowed===true));assert.equal(h.writes().length,kind==='write'&&timing==='queued'?1:0);
 assert.equal(result.writeStarted,kind==='write'&&timing==='queued');assert.equal(result.status,kind==='write'&&timing==='queued'?'uncertain':'blocked');assert.equal(h.controller.isOwnUnstarted(lease,result),!(kind==='write'&&timing==='queued'));assert.equal(h.controller.mayFollowup(lease,result),false);
});
test('A mutation then-executor throw after invocation is uncertain even when it supplies no result or recorded ACK',async()=>{
 const h=harness(),lease=h.capture();let writeEntries=0;h.control.onNativeThen=request=>{if(request.kind==='write'){writeEntries++;throw Error('SDK then entry transport failure');}};
 const result=await h.controller.delete(lease);assert.equal(writeEntries,1);assert.equal(result.writeStarted,true);assert.equal(result.status,'uncertain');assert.equal(result.steps.at(-1).outcome,'unresolved');assert.equal(h.controller.isOwnUnstarted(lease,result),false);assert.equal(h.controller.mayFollowup(lease,result),false);
});

const retainedDocument=(changes={})=>({id:id(40),template_key:'privacy_consent_default',status:'preview_open',preview_html:'<p>retained original</p>',finalized_html:null,rendered_pdf_path:null,finalized_at:null,updated_at:'2026-10-11 10:00:00.123456+00:00',...changes});
for(const status of ['finalized','signed','pending_signature'])for(const preserved of [false,true])test(`A fresh ${status} signature capture never bypasses the atomic shared completion, retained=${preserved}`,async()=>{
 const existingDocuments=preserved?[retainedDocument({status:'finalized',finalized_html:'<p>signed original</p>',finalized_at:'2026-10-10T10:00:00.123456Z'})]:[];
 const h=harness({action:'recovery',existingDocuments}),legacy=harness({action:'recovery',existingDocuments}),input=form();input.intakeDocuments=[doc({status})];const before=structuredClone(input);
 const result=await h.controller.recover(h.capture(),input),shared=await sharedRecovery(legacy)(id(1),id(4),input,id(2));assert.equal(shared.ok,false);assert.equal(result.status,'blocked');assert.equal(result.writeStarted,false);assert.equal(h.writes().length,0);assert.deepEqual(h.calls,legacy.calls);assert.deepEqual(input,before);assert.match(result.error,/atomaren Serverabschluss/);
});
test('A retained finalized original is an acknowledged read-only no-op and does not reset consent',async()=>{
 const existingDocuments=[retainedDocument({status:'finalized',finalized_html:'<p>signed original</p>',finalized_at:'2026-10-10 10:00:00.123456+00:00'})],h=harness({action:'recovery',existingDocuments}),legacy=harness({action:'recovery',existingDocuments}),input=form();input.intakeDocuments[0].status='finalized';
 const result=await h.controller.recover(h.capture(),input);assert.equal((await sharedRecovery(legacy)(id(1),id(4),input,id(2))).ok,true);assert.equal(result.status,'acknowledged');assert.equal(result.writeStarted,false);assert.equal(result.currentAtReturn,true);assert.deepEqual(h.calls,legacy.calls);assert.equal(h.calls.length,1);assert.equal(h.writes().length,0);
});
test('Native unsigned recovery uses the same timestamp compare-and-swap and full payload as shared persistence',async()=>{
 const existingDocuments=[retainedDocument()],h=harness({action:'recovery',existingDocuments}),legacy=harness({action:'recovery',existingDocuments}),input=form(),before=structuredClone(existingDocuments);
 const result=await h.controller.recover(h.capture(),input);assert.equal((await sharedRecovery(legacy)(id(1),id(4),input,id(2))).ok,true);assert.equal(result.status,'acknowledged');assert.deepEqual(h.calls,legacy.calls);assert.deepEqual(h.control.existingDocuments,before);
 const updated=h.writes().find(c=>c.table==='client_intake_documents');assert.equal(updated.operation,'update');assert.deepEqual(updated.filters,[['id',id(40)],['tenant_id',id(1)],['client_id',id(4)],['updated_at',existingDocuments[0].updated_at]]);assert.equal(updated.payload.updated_at,new Clock().toISOString());
});
test('A zero-row native document CAS cannot become an acknowledged recovery or continue into consent',async()=>{
 const h=harness({action:'recovery',existingDocuments:[retainedDocument()]});h.control.intercept=call=>call.table==='client_intake_documents'&&call.kind==='write'?{data:null,error:null}:undefined;
 const result=await h.controller.recover(h.capture(),form());assert.equal(result.status,'uncertain');assert.equal(result.writeStarted,true);assert.equal(h.calls.length,3);assert.equal(h.writes().some(c=>c.table==='client_consent_status'||c.table==='client_document_events'),false);
});
for(const status of ['revoked','replaced'])test(`A ${status} document retains every original content field while only its native status is changed`,async()=>{
 const existingDocuments=[retainedDocument({status:'finalized',finalized_html:'<p>retained signed HTML</p>',rendered_pdf_path:'tenant/original.pdf',finalized_at:'2026-10-10T10:00:00.123456Z'})],h=harness({action:'recovery',existingDocuments}),legacy=harness({action:'recovery',existingDocuments}),input=form();input.intakeDocuments[0].status=status;input.intakeDocuments[0].previewHtml='<p>must not replace saved original</p>';
 const before=structuredClone(input),result=await h.controller.recover(h.capture(),input);assert.equal((await sharedRecovery(legacy)(id(1),id(4),input,id(2))).ok,true);assert.equal(result.status,'acknowledged');assert.deepEqual(h.calls,legacy.calls);assert.deepEqual(input,before);
 const saved=h.writes().find(c=>c.table==='client_intake_documents');assert.equal(saved.payload.status,status);for(const [key,column] of [['preview_html','preview_html'],['finalized_html','finalized_html'],['rendered_pdf_path','rendered_pdf_path'],['finalized_at','finalized_at']])assert.equal(saved.payload[key],existingDocuments[0][column]);
});
test('A preserved signed document keeps its effective consent while a separate unsigned document is saved',async()=>{
 const existingDocuments=[retainedDocument({status:'finalized',finalized_html:'<p>existing final original</p>',finalized_at:'2026-10-10T10:00:00.123456Z'})],h=harness({action:'recovery',existingDocuments}),legacy=harness({action:'recovery',existingDocuments}),input=form();input.intakeDocuments.push({...structuredClone(input.intakeDocuments[0]),templateKey:'additional_info',documentType:'additional_consent'});
 const result=await h.controller.recover(h.capture(),input);assert.equal((await sharedRecovery(legacy)(id(1),id(4),input,id(2))).ok,true);assert.equal(result.status,'acknowledged');assert.deepEqual(h.calls,legacy.calls);
 assert.deepEqual(h.writes().filter(c=>c.table==='client_intake_documents').map(c=>c.payload.template_key),['additional_info']);const consent=h.writes().find(c=>c.table==='client_consent_status').payload;assert.equal(consent.privacy_status,'finalized');assert.equal(consent.privacy_finalized_at,existingDocuments[0].finalized_at);
});
for(const data of [null,{},[{id:id(40)}],[retainedDocument(),retainedDocument()]])test('Unconfirmed or duplicate original-document inventory never reaches a native mutation '+JSON.stringify(data),async()=>{
 const h=harness({action:'recovery'});h.control.intercept=(_,index)=>index===0?{data,error:null}:undefined;const result=await h.controller.recover(h.capture(),form());assert.equal(result.status,'blocked');assert.equal(result.writeStarted,false);assert.equal(h.writes().length,0);assert.equal(h.calls.length,1);
});
