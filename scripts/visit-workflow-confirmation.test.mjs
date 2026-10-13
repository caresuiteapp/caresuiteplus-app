import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Execute the real TypeScript services with isolated network adapters.
async function loadService(path, stubs, globals = {}) {
  const source = stripTypeScriptTypes(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  const context = vm.createContext({ console: { warn() {}, error() {} }, setTimeout, clearTimeout, ...globals });
  const imports = new Map();
  for (const match of source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const names = (match[1].match(/\{([\s\S]*?)\}/)?.[1] ?? '').split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    imports.set(match[2], names);
  }
  const modules = new Map();
  async function stub(specifier, dynamic = false) {
    if (modules.has(specifier)) return modules.get(specifier);
    const values = stubs[specifier] ?? {};
    const names = [...new Set([...(imports.get(specifier) ?? []), ...Object.keys(values)])];
    const module = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name] ?? (() => { throw new Error(`Unexpected adapter ${specifier}:${name}`); }));
    }, { context });
    modules.set(specifier, module);
    if (dynamic) { await module.link(() => {}); await module.evaluate(); }
    return module;
  }
  const module = new vm.SourceTextModule(source, { context, importModuleDynamically: specifier => stub(specifier, true) });
  await module.link(specifier => stub(specifier));
  await module.evaluate();
  return module.namespace;
}
const ok = () => Promise.resolve({ ok: true });
const ctx = () => ({ tenantId: 'tenant', assignmentId: 'assignment', assistVisitId: 'visit', employeeId: 'employee',
  profileId: 'profile', assignmentStatus: 'beendet', derivedStatus: 'beendet', timeEvents: [],
  detail: { title: 'Begleitung', tasks: [], documentationNotes: 'Erledigt', documentationStatus: 'submitted' },
  visitTimes: { serviceStartedAt: '2026-10-13T08:00:00Z', serviceEndedAt: '2026-10-13T09:00:00Z', arrivedAt: '2026-10-13T08:00:00Z' } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setImmediate(r));
function endStubs(state = ok, mirror = ok) {
  return { './assistVisitExecutionStatePersistence': { upsertAssistVisitExecutionState: state },
    '@/lib/services/mode': { getServiceMode: () => 'supabase' },
    '@/lib/portal/employeePortalExecutionLiveService': { mirrorAssistVisitStatusFromAssignment: mirror },
    './resolveAllowedActions': { resolveAllowedActions: () => ['save_documentation'], resolveAssistExecutionDiagnostics: () => ({}) } };
}
test('end waits for its execution-state receipt before releasing the next step', async () => {
  const gate = deferred(); let mirrored = false; let settled = false;
  const { endService } = await loadService('src/features/assistWorkflow/endService.ts', endStubs(() => gate.promise, async () => { mirrored = true; return { ok: true }; }));
  const pending = endService(ctx()).then(value => { settled = true; return value; });
  await tick(); assert.equal(settled, false); assert.equal(mirrored, false);
  gate.resolve({ ok: true }); const result = await pending;
  assert.equal(result.ok, true); assert.equal(mirrored, true); assert.equal(result.data.wfmSyncFailed, false);
});
test('end reports a failed mirror without repeating the durable end event', async () => {
  const { endService } = await loadService('src/features/assistWorkflow/endService.ts', endStubs(ok, async () => ({ ok: false, error: 'RLS' })));
  const result = await endService(ctx()); assert.equal(result.ok, true); assert.equal(result.data.wfmSyncFailed, true);
});
function finalizeStubs(sync = ok, state = ok) {
  return { '@/lib/services/mode': { getServiceMode: () => 'supabase' },
    '@/lib/assist/repositories/assignmentRepository.supabase': { assignmentSupabaseRepository: { prepareServiceRecord: async () => ({ ok: true, data: { id: 'record' } }) } },
    '@/lib/assist/visitExecutionService': { validateVisitCloseReadiness: () => ({ valid: true }) },
    '@/lib/portal/resolveEmployeePortalSignatureRequirement': { hasPortalPersistedClientSignature: async () => true },
    './internal/workflowProjectionKeys': { assistProofProjectionKey: () => 'proof' },
    '@/lib/async/deferredTask': { waitForDeferredTask: async () => true, scheduleDeferredTask: key => { assert.ok(key.startsWith('assist-service-record:')); } },
    '@/lib/assist/assistVisitProofPersistenceService': { fetchLatestVisitProof: async () => ({ ok: true, data: null }) },
    '@/lib/assist/assistVisitSignaturePersistenceService': { fetchValidVisitSignature: async () => ({ ok: true, data: null }) },
    './buildServiceRecordHtml': { buildServiceRecordSnapshot: () => ({}) },
    './generateServiceRecord': { generateServiceRecord: async () => ({ ok: true, data: { proofPersisted: true, serviceRecordId: 'record' } }) },
    './internal/transitionAssistExecutionStatus': { transitionAssistExecutionStatus: async c => ({ ok: true, data: { ...c, assignmentStatus: 'abgeschlossen' } }) },
    './assistVisitExecutionStatePersistence': { upsertAssistVisitExecutionState: state },
    '@/lib/wfm/wfmAssistAdapter': { syncAssistVisitTimesToWfm: sync } };
}
test('finalize does not claim WFM confirmation while handoff is pending', async () => {
  const gate = deferred(); let settled = false;
  const { finalizeVisit } = await loadService('src/features/assistWorkflow/finalizeVisit.ts', finalizeStubs(() => gate.promise));
  const pending = finalizeVisit(ctx()).then(value => { settled = true; return value; });
  await tick(); assert.equal(settled, false); gate.resolve({ ok: true });
  const result = await pending; assert.equal(result.ok, true); assert.equal(result.data.wfmSyncFailed, false);
});
test('finalize preserves the completed proof but reports WFM refusal', async () => {
  const { finalizeVisit } = await loadService('src/features/assistWorkflow/finalizeVisit.ts', finalizeStubs(async () => ({ ok: false, error: 'RLS' })));
  const result = await finalizeVisit(ctx()); assert.equal(result.ok, true); assert.equal(result.data.proofPersisted, true); assert.equal(result.data.wfmSyncFailed, true);
});
test('finalize reports an execution-state failure before invoking WFM', async () => {
  let called = false;
  const { finalizeVisit } = await loadService('src/features/assistWorkflow/finalizeVisit.ts', finalizeStubs(async () => { called = true; return { ok: true }; }, async () => ({ ok: false, error: 'RLS' })));
  const result = await finalizeVisit(ctx()); assert.equal(result.data.wfmSyncFailed, true); assert.equal(called, false);
});
function visitStubs(valid, resolvedId) {
  return { '@/lib/permissions': { enforcePermission: () => null }, '@/lib/services/liveServiceGuard': { guardServiceTenant: () => null },
    '@/lib/services/mode': { getServiceMode: () => 'supabase' },
    '@/lib/assist/visitRecurrenceExpansion': { isResolvableVisitId: () => valid },
    '@/lib/assist/visitService': { resolveExecutableVisitId: async () => ({ ok: true, data: { visitId: 'visit' } }) },
    '@/lib/assist/repositories/visitRepository.supabase': { visitSupabaseRepository: { resolveVisitId: async () => resolvedId, updateDocumentation: async () => ({ ok: true, data: { saved: true } }) } } };
}
test('live task and documentation saves reject an unresolvable ID', async () => {
  const service = await loadService('src/lib/assist/visitExecutionService.ts', visitStubs(false, null));
  assert.equal((await service.updateVisitTaskStatus('bad', 'task', 'tenant', 'done')).ok, false);
  assert.equal((await service.updateVisitDocumentation('bad', 'tenant', 'Doku')).ok, false);
});
test('live documentation never falls through to demo success when a visit row is missing', async () => {
  const service = await loadService('src/lib/assist/visitExecutionService.ts', visitStubs(true, null));
  assert.equal((await service.updateVisitDocumentation('visit', 'tenant', 'Doku')).ok, false);
});
test('live documentation still uses the real repository for a resolved visit', async () => {
  const service = await loadService('src/lib/assist/visitExecutionService.ts', visitStubs(true, 'visit'));
  assert.equal((await service.updateVisitDocumentation('visit', 'tenant', 'Doku')).ok, true);
});

// Test the real repository method without loading unrelated repository adapters.
function documentationWriter(receipt, queryError = null) {
  const source = readFileSync(new URL('../src/lib/assist/repositories/visitRepository.supabase.ts', import.meta.url), 'utf8');
  const begin = source.indexOf('  async updateDocumentation(');
  const end = source.indexOf('\n  async update(', begin);
  const filters = []; const audits = [];
  const query = { eq: (key, value) => { filters.push([key, value]); return query; },
    select: () => query, maybeSingle: async () => ({ data: receipt, error: queryError }) };
  const repo = vm.runInNewContext(stripTypeScriptTypes(`const repo = {${source.slice(begin, end)}}; repo;`), {
    getClient: () => ({}), fromUnknownTable: () => ({ update: () => query }),
    toGermanSupabaseError: () => 'Datenbankfehler',
    writeStatusHistory: async () => audits.push('history'), writeAuditLog: async () => audits.push('audit'),
  });
  repo.getById = async () => ({ ok: true, data: { employeeNotes: 'Doku' } });
  return { repo, filters, audits };
}
test('documentation zero-row update cannot produce a success message or audit', async () => {
  const { repo, audits } = documentationWriter(null);
  assert.equal((await repo.updateDocumentation('tenant', 'visit', 'Doku')).ok, false);
  assert.equal(audits.length, 0);
});
test('documentation receipt must match tenant, visit and saved content', async () => {
  for (const patch of [{ tenant_id: 'foreign' }, { id: 'foreign' }, { employee_notes: 'old' }, { documentation_status: 'none' }]) {
    const { repo, audits } = documentationWriter({ id: 'visit', tenant_id: 'tenant', employee_notes: 'Doku', documentation_status: 'complete', ...patch });
    assert.equal((await repo.updateDocumentation('tenant', 'visit', 'Doku')).ok, false);
    assert.equal(audits.length, 0);
  }
});
test('matching documentation receipt keeps tenant and visit filters and audits the confirmed write', async () => {
  const { repo, filters, audits } = documentationWriter({ id: 'visit', tenant_id: 'tenant', employee_notes: 'Doku', documentation_status: 'complete' });
  assert.equal((await repo.updateDocumentation('tenant', 'visit', ' Doku ')).ok, true);
  assert.deepEqual(filters, [['tenant_id', 'tenant'], ['id', 'visit']]); assert.equal(audits.length, 2);
});
const { didWorkflowActionReachPostcondition } = await import('../src/features/assistWorkflow/workflowRecoveryVerification.ts');
test('journey recovery requires durable start evidence and the matching visit', () => {
  const before = ctx(); const after = { ...before, assignmentStatus: 'unterwegs', derivedStatus: 'unterwegs',
    detail: { ...before.detail, status: 'unterwegs' }, visitTimes: { driveStartedAt: '2026-10-13T07:45:00Z' } };
  assert.equal(didWorkflowActionReachPostcondition('start_en_route', before, after), true);
  assert.equal(didWorkflowActionReachPostcondition('start_en_route', before, { ...after, visitTimes: {}, detail: { status: 'unterwegs' } }), false);
  assert.equal(didWorkflowActionReachPostcondition('start_en_route', before, { ...after, employeeId: 'other' }), false);
});
test('atomic service start waits for the snapshot and time mirror before releasing the next action', async () => {
  const gate = deferred(); const startedAt = '2026-10-13T08:00:00Z'; let settled = false; let mirrored = false;
  const { startServiceAtomic } = await loadService('src/features/assistWorkflow/startServiceAtomic.shared.ts', {
    '@/lib/supabase/client': { getSupabaseClient: () => ({ rpc: async () => ({ data: { visitId: 'visit', employeeId: 'employee', status: 'started', eventId: 'event', startedAt,
      events: [{ eventType: 'service_start', occurredAt: startedAt }] } }) }) },
    './calculateVisitTimes': { calculateVisitTimes: () => ({ serviceStartedAt: startedAt }) },
    './resolveAllowedActions': { resolveAllowedActions: () => [], resolveAssistExecutionDiagnostics: () => ({}) },
    './assistVisitExecutionStatePersistence': { upsertAssistVisitExecutionState: () => gate.promise },
    './saveVisitTimeEvent': { ensureVisitTimeEvent: async () => { mirrored = true; return { ok: true }; } },
  });
  const pending = startServiceAtomic(ctx(), {}).then(value => { settled = true; return value; });
  await tick(); assert.equal(settled, false); assert.equal(mirrored, false);
  gate.resolve({ ok: true }); const result = await pending; assert.equal(mirrored, true); assert.equal(result.data.wfmSyncFailed, false);
});
for (const [name, paused] of [['startPause', true], ['endPause', false]]) {
  test(`${name} confirms its snapshot before allowing another action`, async () => {
    const gate = deferred(); let settled = false;
    const module = await loadService(`src/features/assistWorkflow/${name}.ts`, {
      './assistVisitStateMachine': { isAssignmentLocked: () => false },
      './saveVisitTimeEvent': { hasOpenPauseSegment: () => paused },
      './assistVisitExecutionStatePersistence': { upsertAssistVisitExecutionState: () => gate.promise },
    });
    const current = { ...ctx(), assignmentStatus: paused ? 'pausiert' : 'gestartet' };
    const pending = module[name](current).then(value => { settled = true; return value; });
    await tick(); assert.equal(settled, false); gate.resolve({ ok: true });
    assert.equal((await pending).data.wfmSyncFailed, false);
  });
}
test('a missing secure service-record function is reported while preserving the completed proof', async () => {
  const stubs = finalizeStubs();
  stubs['@/lib/assist/repositories/assignmentRepository.supabase'] = { assignmentSupabaseRepository: { prepareServiceRecord: async () => ({ ok: false, error: 'Serverfreigabe fehlt' }) } };
  const { finalizeVisit } = await loadService('src/features/assistWorkflow/finalizeVisit.ts', stubs);
  const result = await finalizeVisit(ctx()); assert.equal(result.ok, true); assert.equal(result.data.proofPersisted, true);
  assert.equal(result.data.serviceRecordSyncFailed, true); assert.equal(result.data.wfmSyncFailed, false);
});
