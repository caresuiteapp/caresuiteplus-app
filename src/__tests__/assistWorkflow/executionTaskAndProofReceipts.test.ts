import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { isStoredVisitProofComplete, visitProofSnapshotsMatch } from '@/lib/assist/visitProofCompleteness';

// Execute the application's exported commands with controlled repository/network
// boundaries. This keeps the real receipt branches without loading native modules.
function command(file: string, name: string, deps: Record<string, unknown>, helpers: string[] = []) {
  const source = readFileSync(path.join(__dirname, '../../../', file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && Boolean(node.name && [name, ...helpers].includes(node.name.text)));
  const js = ts.transpileModule(declarations.map(node => node.getText(ast).replace(/^export /, '')).join('\n'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(deps), js + `; return ${name};`)(...Object.values(deps));
}

describe('task result receipts', () => {
  function fixture(status: string) {
    const write = vi.fn(async () => ({ ok: true, data: { tasks: [{ id: 'task', status, notDoneReason: null }] } }));
    const deps = { enforcePermission: () => null, assertLiveEmployeeAssignmentAccess: () => null,
      resolveLiveAssignment: async () => ({ ok: true, data: { persistenceSource: 'assignments', assignmentId: 'visit', detail: {} } }),
      taskStatusRequiresNote: () => false, assignmentSupabaseRepository: { updateTasksBatch: write },
      visitSupabaseRepository: {}, mapVisitDetailToAssignmentDetail: (data: unknown) => data };
    const run = command('src/lib/portal/employeePortalExecutionLiveService.ts', 'updateLiveEmployeePortalTasksBatch', deps,
      ['toPersistedTaskStatus', 'toVisitTaskStatus']);
    return { write, run };
  }
  it.each([true, false])('rejects a successful zero-row update with stale tasks (known detail=%s)', async (known) => {
    const { run, write } = fixture('open');
    const result = await run('tenant', 'visit', 'employee', 'employee_portal', [{ taskId: 'task', status: 'done' }],
      known ? { tasks: [{ id: 'task', status: 'open' }] } : undefined);
    expect(result.ok).toBe(false);
    expect(write).toHaveBeenCalledOnce();
    expect(result.error).toContain('noch nicht bestätigt');
  });
  it('advances task selection only after matching persisted status was read', async () => {
    const { run } = fixture('done');
    const result = await run('tenant', 'visit', 'employee', 'employee_portal', [{ taskId: 'task', status: 'done' }],
      { tasks: [{ id: 'task', status: 'open' }], status: 'gestartet' });
    expect(result.ok).toBe(true);
    expect(result.data.tasks[0].status).toBe('done');
    expect(result.data.status).toBe('gestartet');
  });
});

describe('mutable and published proof receipts', () => {
  function fixture(proof: Record<string, unknown>, receipt = true, readFailure = false) {
    const payload: { current: any } = { current: null };
    const update = vi.fn((row) => { payload.current = row; return query; });
    const query = { update, eq: vi.fn(() => query), select: () => query,
      maybeSingle: async () => ({ error: null, data: receipt ? { id: 'proof', tenant_id: 'tenant', visit_id: 'visit',
        payload_hash: payload.current.payload_hash, signature_id: payload.current.signature_id } : null }) };
    const persist = vi.fn();
    const run = command('src/lib/portal/employeePortalVisitTrackingPersistence.ts', 'persistEmployeePortalVisitProof', {
      resolveVisit: async () => 'visit', fetchLatestVisitProof: async () => readFailure ? { ok: false, error: 'Offline' } : { ok: true, data: proof },
      isStoredVisitProofComplete, visitProofSnapshotsMatch, computeVisitProofPayloadHash: async () => 'new-hash',
      getSupabaseClient: () => ({}), fromUnknownTable: () => query, persistVisitProof: persist,
      toGermanSupabaseError: (error: any) => error.message,
    });
    return { run, update, payload, query, persist };
  }
  const old = () => ({ id: 'proof', tenantId: 'tenant', visitId: 'visit', signatureId: 'old-signature', status: 'draft',
    payloadHash: 'old-hash', payloadSnapshot: { documentation: 'Alt' }, portalVisible: false, billingReleased: false });
  const ctx = { tenantId: 'tenant', assignmentId: 'visit' };
  it('refreshes changed draft content and clears the superseded signature and PDF', async () => {
    const f = fixture(old());
    expect((await f.run(ctx, { documentation: 'Korrigiert' }, null)).ok).toBe(true);
    expect(f.payload.current).toMatchObject({ signature_id: null, storage_path: null, pdf_storage_path: null, pdf_hash: null,
      payload_snapshot: { documentation: 'Korrigiert' } });
    expect(f.query.eq).toHaveBeenCalledWith('tenant_id', 'tenant');
    expect(f.query.eq).toHaveBeenCalledWith('visit_id', 'visit');
  });
  it('rejects an update without a returned server row', async () => {
    const f = fixture(old(), false);
    expect((await f.run(ctx, { documentation: 'Korrigiert' }, null)).ok).toBe(false);
  });
  it.each(['portal visible', 'approved', 'billing released'])('keeps %s proof content immutable', async (state) => {
    const f = fixture({ ...old(), ...(state === 'portal visible' ? { portalVisible: true } : state === 'approved' ? { status: 'approved' } : { billingReleased: true }) });
    expect((await f.run(ctx, { documentation: 'Korrigiert' }, null)).ok).toBe(false);
    expect(f.update).not.toHaveBeenCalled();
    expect(f.persist).not.toHaveBeenCalled();
  });
  it('does not create a duplicate proof when the existing-proof read is unavailable', async () => {
    const f = fixture(old(), true, true);
    expect(await f.run(ctx, { documentation: 'Korrigiert' }, null)).toEqual({ ok: false, error: 'Offline' });
    expect(f.persist).not.toHaveBeenCalled();
  });
});
