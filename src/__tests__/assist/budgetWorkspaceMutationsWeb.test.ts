import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientFundingSourceKey } from '@/types/clients/clientFundingSource';
import { mapBudgetAccountRow, mapCareEntitlementRow } from '@/lib/assist/clientAssistBillingMappers';
import { applyBudgetRecalculation, bookBudgetCorrection, changeClientCareGrade, deactivateClientBudgetAccount, ensureBudgetWorkspaceAccounts, previewBudgetRecalculationFromCatalog, setBudgetWorkspaceFundingSources, setClientConversionEnabled, updateCareEntitlementValidFrom, updateClientBudgetAccount, updateClientCareFund, type BudgetRecalcDiff } from '@/lib/assist/budgetWorkspaceMutations.web';

type Row = Record<string, unknown>;
type Call = { table: string; ops: [string, unknown[]][] };
const f = vi.hoisted(() => ({ client: null as object | null, denied: false, calls: [] as Call[], read: vi.fn(), rpc: vi.fn(), data: {} as Record<string, unknown> }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => chain(table) }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => f.denied ? { ok: false, error: 'Kein Zugriff auf dieses Unternehmen.' } : null }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message?: string; code?: string } | null) => error?.message ?? error?.code ?? 'Datenbankfehler' }));
function chain(table: string) {
  const call: Call = { table, ops: [] }; f.calls.push(call); const q: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'lte', 'gte', 'order', 'limit', 'in', 'maybeSingle']) q[method] = (...args: unknown[]) => { call.ops.push([method, args]); return q; };
  q.then = (yes: (value: unknown) => unknown, no: (error: unknown) => unknown) => Promise.resolve().then(() => f.read(call)).then(yes, no);
  return q;
}
const TENANT = '11111111-1111-4111-8111-111111111111';
const CLIENT = '22222222-2222-4222-8222-222222222222';
const ACCOUNT = '33333333-3333-4333-8333-333333333333';
const CARE = '44444444-4444-4444-8444-444444444444';
const TEMPLATE = '55555555-5555-4555-8555-555555555555';
const SELECTION = '66666666-6666-4666-8666-666666666666';
const TRANSACTION = '77777777-7777-4777-8777-777777777777';
let sequence = 0;
const operation = () => `88888888-8888-4888-8888-${String(++sequence).padStart(12, '0')}`;
const care = (overrides: Row = {}) => ({ id: CARE, tenant_id: TENANT, client_id: CLIENT, care_grade: 'pg2', valid_from: '2026-01-01', valid_until: null, conversion_enabled: true, care_fund_name: 'Testkasse', care_fund_member_id: 'X123', md_assessment_date: null, notes: null, source: 'manual', updated_at: '2026-10-17T08:00:00Z', ...overrides });
const account = (overrides: Row = {}) => ({ id: ACCOUNT, tenant_id: TENANT, client_id: CLIENT, catalog_template_id: TEMPLATE, catalog_key: 'paragraph_45b', catalog_year: 2026, period: 'monthly', period_start: '2026-10-01', period_end: '2027-06-30', allocated_cents: 10000, used_cents: 1000, reserved_cents: 1000, external_sachleistung_cents: 0, is_individual_override: false, individual_amount_cents: null, standard_amount_cents: 13100, locked: false, is_enabled: true, catalog_snapshot: {}, billing_priority: 1, status: 'active', notes: null, updated_at: '2026-10-17T08:00:00Z', ...overrides });
const template = (overrides: Row = {}) => ({ id: TEMPLATE, catalog_key: 'paragraph_45b', budget_year: 2026, label: 'Entlastung', description: null, period: 'monthly', default_amount_cents: 13100, care_grade_min: 'pg1', care_grade_max: 'pg5', billing_priority: 1, allows_individual_override: true, auto_generate: true, is_statutory: true, metadata: {}, is_active: true, ...overrides });
const fundingRow = (sources: ClientFundingSourceKey[], effective = '2026-10-17') => ({ id: SELECTION, tenant_id: TENANT, client_id: CLIENT, sources, effective_from: effective, replaced_at: null, created_at: '2026-10-17T08:00:00Z' });
function receipt(args: Row, data: Row, overrides: Row = {}) { return { requestId: args.p_request_id, action: args.p_action, tenantId: args.p_tenant_id, clientId: args.p_client_id, data, ...overrides }; }
function rpcSuccess(args: Row) {
  const input = args.p_input as Row; const action = args.p_action;
  let data: Row;
  if (action === 'set_funding') data = fundingRow(['entlastungsleistung', 'umwandlung', 'verhinderungspflege', 'selbstzahler'].filter(value => (input.sources as string[]).includes(value)) as ClientFundingSourceKey[], input.effectiveFrom as string);
  else if (action === 'correction') data = { transactionId: TRANSACTION };
  else if (action === 'deactivate') data = account({ status: 'suspended', is_enabled: false });
  else if (action === 'update_account') data = account({ external_sachleistung_cents: input.externalSachleistungCents ?? 0, allocated_cents: input.allocatedCents ?? 10000 });
  else if (action === 'recalculate') data = { updated: (input.diffs as Row[]).length, created: (input.diffs as Row[]).filter(diff => diff.create).length };
  else data = care({ care_grade: input.newCareGrade ?? 'pg2', conversion_enabled: input.enabled ?? true, care_fund_name: input.careFundName ?? 'Testkasse', care_fund_member_id: input.careFundMemberId ?? 'X123', valid_from: input.validFrom ?? input.effectiveFrom ?? '2026-01-01' });
  return { data: receipt(args, data), error: null };
}
const writes = () => f.rpc.mock.calls.filter(([name]) => name === 'mutate_budget_workspace');
const lastInput = () => writes().at(-1)![1].p_input as Row;
const funding = (id = operation(), sources: ClientFundingSourceKey[] = ['umwandlung', 'entlastungsleistung'], expected: ClientFundingSourceKey[] = ['entlastungsleistung']) => setBudgetWorkspaceFundingSources(TENANT, CLIENT, sources, '2026-10-17', expected, id);
const preview = () => previewBudgetRecalculationFromCatalog(TENANT, CLIENT, 2026, null, false, null, '2026-10-17');
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T09:00:00Z'));
  f.denied = false; f.calls = []; f.client = { rpc: f.rpc };
  f.data = { client_care_entitlement: [care()], client_budget_accounts: [account()], budget_template_catalog: [template()], client_funding_selections: fundingRow(['entlastungsleistung']) };
  f.read.mockReset().mockImplementation((call: Call) => ({ data: call.ops.some(([name]) => name === 'maybeSingle') && Array.isArray(f.data[call.table]) ? (f.data[call.table] as unknown[])[0] ?? null : f.data[call.table] ?? [], error: null }));
  f.rpc.mockReset().mockImplementation(async (name: string, args: Row) => name === 'mutate_budget_workspace' ? rpcSuccess(args) : { data: null, error: null });
});
afterEach(() => { vi.useRealTimers(); });

describe('Web budget mutation scope and input validation', () => {
  it('requires permitted tenant, valid ids and an available backend before writing', async () => {
    f.denied = true; expect(await funding()).toMatchObject({ ok: false, error: expect.stringContaining('Kein Zugriff') });
    f.denied = false; expect(await setBudgetWorkspaceFundingSources(TENANT, 'bad-id', ['entlastungsleistung'], '2026-10-17', [], operation())).toMatchObject({ ok: false });
    f.client = null; expect(await funding()).toMatchObject({ ok: false });
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.calls).toHaveLength(0);
  });
  it('rejects empty, duplicate, unknown and future funding inputs without a write', async () => {
    for (const sources of [[], ['umwandlung', 'umwandlung'], ['unknown']] as ClientFundingSourceKey[][]) expect(await funding(operation(), sources)).toMatchObject({ ok: false });
    expect(await setBudgetWorkspaceFundingSources(TENANT, CLIENT, ['selbstzahler'], '2026-02-30', [], operation())).toMatchObject({ ok: false });
    expect(await setBudgetWorkspaceFundingSources(TENANT, CLIENT, ['selbstzahler'], '2026-10-18', [], operation())).toMatchObject({ ok: false });
    expect(await funding('bad-operation')).toMatchObject({ ok: false }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('rejects invalid correction values, dates and missing reasons', async () => {
    for (const amountCents of [0, 1.25, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) expect(await bookBudgetCorrection(TENANT, CLIENT, { budgetAccountId: ACCOUNT, amountCents, effectiveDate: '2026-10-17', reason: 'Prüfung' }, operation())).toMatchObject({ ok: false });
    expect(await bookBudgetCorrection(TENANT, CLIENT, { budgetAccountId: ACCOUNT, amountCents: 100, effectiveDate: '2026-10-18', reason: 'Prüfung' }, operation())).toMatchObject({ ok: false });
    expect(await updateClientBudgetAccount(TENANT, CLIENT, ACCOUNT, { externalSachleistungCents: -1, auditReason: 'Prüfung' }, operation())).toMatchObject({ ok: false });
    expect(await setClientConversionEnabled(TENANT, CLIENT, true, ' ', operation())).toMatchObject({ ok: false }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('rejects invalid care inputs before reading or writing', async () => {
    expect(await changeClientCareGrade(TENANT, CLIENT, { newCareGrade: 'pg2', effectiveFrom: '2026-02-30', reason: 'Prüfung' }, operation())).toMatchObject({ ok: false });
    expect(await updateCareEntitlementValidFrom(TENANT, CLIENT, { validFrom: '2026-10-18', reason: 'Prüfung' }, operation())).toMatchObject({ ok: false });
    expect(await updateClientCareFund(TENANT, CLIENT, { careFundName: ' ', careFundMemberId: '', reason: 'Prüfung' }, operation())).toMatchObject({ ok: false });
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.calls).toHaveLength(0);
  });
});

describe('authoritative receipts and idempotent funding operations', () => {
  it('passes stored sources as CAS context and accepts the canonical server selection order', async () => {
    const id = operation(); expect(await funding(id)).toMatchObject({ ok: true, data: { id: SELECTION, tenantId: TENANT, clientId: CLIENT, sources: ['entlastungsleistung', 'umwandlung'] } });
    expect(lastInput()).toMatchObject({ sources: ['umwandlung', 'entlastungsleistung'], expectedSources: ['entlastungsleistung'], effectiveFrom: '2026-10-17' });
    expect(writes()[0][1]).toMatchObject({ p_tenant_id: TENANT, p_client_id: CLIENT, p_request_id: id, p_action: 'set_funding' });
  });
  it.each(['requestId', 'tenantId', 'clientId', 'action'] as const)('rejects a mismatched receipt %s and keeps the operation uncertain', async key => {
    f.rpc.mockImplementation(async (name: string, args: Row) => name === 'mutate_budget_workspace' ? { data: receipt(args, fundingRow(['entlastungsleistung', 'umwandlung']), { [key]: 'wrong' }), error: null } : { data: null, error: null });
    const id = operation(); expect(await funding(id)).toMatchObject({ ok: false, uncertain: true, operationId: id });
    expect(f.rpc.mock.calls.at(-1)?.[0]).toBe('get_budget_workspace_receipt');
  });
  it.each([null, {}, { id: SELECTION, sources: [] }])('does not treat an empty or malformed domain receipt as saved', async data => {
    f.rpc.mockImplementation(async (name: string, args: Row) => name === 'mutate_budget_workspace' ? { data: receipt(args, data as Row), error: null } : { data: null, error: null });
    expect(await funding()).toMatchObject({ ok: false, uncertain: true });
  });
  it('recovers a lost mutation response using the same transactional receipt', async () => {
    let writeArgs: Row;
    f.rpc.mockImplementation(async (name: string, args: Row) => { if (name === 'mutate_budget_workspace') { writeArgs = args; throw new Error('Response lost'); } return rpcSuccess(writeArgs!); });
    expect(await funding()).toMatchObject({ ok: true }); expect(writes()).toHaveLength(1);
    expect(f.rpc.mock.calls[1][1]).toMatchObject({ p_request_id: writes()[0][1].p_request_id });
  });
  it.each(['23514', '40001', '42501', 'P0001'])('treats PostgreSQL %s as a definite rollback', async code => {
    f.rpc.mockImplementation(async () => ({ data: null, error: { code, message: 'Änderung zurückgewiesen' } }));
    const result = await funding(); expect(result).toEqual({ ok: false, error: 'Änderung zurückgewiesen' });
  });
  it('keeps a transport failure uncertain when receipt lookup also fails', async () => {
    f.rpc.mockRejectedValue(new Error('Offline')); expect(await funding()).toMatchObject({ ok: false, uncertain: true });
  });
  it('replays the frozen original funding payload with the same id and blocks id reuse for another intent', async () => {
    const id = operation(); f.rpc.mockResolvedValue({ data: null, error: null });
    expect(await funding(id)).toMatchObject({ ok: false, uncertain: true });
    const first = structuredClone(writes()[0][1]);
    expect(await funding(id, ['selbstzahler'])).toMatchObject({ ok: false, error: expect.stringContaining('anderen Änderung') }); expect(writes()).toHaveLength(1);
    f.rpc.mockImplementation(async (name: string, args: Row) => name === 'mutate_budget_workspace' ? rpcSuccess(args) : { data: null, error: null });
    expect(await funding(id)).toMatchObject({ ok: true }); expect(writes()[1][1]).toEqual(first);
  });
});

describe('care and account concurrency snapshots', () => {
  it('reads the scoped care record and sends its exact current revision as CAS context', async () => {
    expect(await updateClientCareFund(TENANT, CLIENT, { careFundName: 'Neue Kasse', careFundMemberId: 'N456', reason: ' Kassenwechsel ' }, operation(), mapCareEntitlementRow(care()))).toMatchObject({ ok: true });
    expect(lastInput()).toMatchObject({ careFundName: 'Neue Kasse', reason: 'Kassenwechsel', expectedEntitlement: { id: CARE, updatedAt: '2026-10-17T08:00:00Z' } });
    expect(f.calls[0].ops).toEqual(expect.arrayContaining([['eq', ['tenant_id', TENANT]], ['eq', ['client_id', CLIENT]], ['is', ['valid_until', null]]]));
  });
  it('rejects an opening care snapshot changed by another editor before write', async () => {
    const opening = mapCareEntitlementRow(care()); f.data.client_care_entitlement = [care({ care_fund_name: 'Extern geändert' })];
    expect(await updateClientCareFund(TENANT, CLIENT, { careFundName: 'Meine Kasse', careFundMemberId: 'N456', reason: 'Prüfung' }, operation(), opening)).toMatchObject({ ok: false, error: expect.stringContaining('seit dem Öffnen') });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('rejects an expected empty care record when another editor already created it', async () => {
    expect(await changeClientCareGrade(TENANT, CLIENT, { newCareGrade: 'pg2', effectiveFrom: '2026-10-17', reason: 'Erfasst' }, operation(), null)).toMatchObject({ ok: false }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('fails closed on unreadable or ambiguous care records', async () => {
    f.data.client_care_entitlement = [care(), care({ id: TRANSACTION })];
    expect(await setClientConversionEnabled(TENANT, CLIENT, true, 'Prüfung', operation())).toMatchObject({ ok: false });
    f.read.mockRejectedValueOnce(new Error('Read lost'));
    expect(await setClientConversionEnabled(TENANT, CLIENT, true, 'Prüfung', operation())).toMatchObject({ ok: false }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('retains the original care CAS revision when checking an uncertain operation', async () => {
    const id = operation(); const input = { careFundName: 'Neue Kasse', careFundMemberId: 'N456', reason: 'Prüfung' };
    f.rpc.mockResolvedValue({ data: null, error: null }); expect(await updateClientCareFund(TENANT, CLIENT, input, id)).toMatchObject({ ok: false, uncertain: true });
    const original = structuredClone(writes()[0][1]); f.data.client_care_entitlement = [care({ updated_at: '2026-10-17T09:00:00Z' })];
    f.rpc.mockImplementation(async (_name: string, args: Row) => rpcSuccess(args));
    expect(await updateClientCareFund(TENANT, CLIENT, input, id)).toMatchObject({ ok: true });
    expect(writes()[1][1]).toEqual(original); expect(f.calls).toHaveLength(1);
  });
  it('uses scoped account revision for a signed correction and requires a transaction receipt', async () => {
    expect(await bookBudgetCorrection(TENANT, CLIENT, { budgetAccountId: ACCOUNT, amountCents: -100, effectiveDate: '2026-10-17', reason: ' Korrektur ' }, operation())).toEqual({ ok: true, data: { transactionId: TRANSACTION } });
    expect(lastInput()).toMatchObject({ accountId: ACCOUNT, amountCents: -100, expectedUpdatedAt: '2026-10-17T08:00:00Z', reason: 'Korrektur' });
    expect(f.calls[0].ops).toEqual(expect.arrayContaining([['eq', ['tenant_id', TENANT]], ['eq', ['client_id', CLIENT]], ['eq', ['id', ACCOUNT]]]));
  });
  it('rejects a changed external-service amount against the snapshot opened by the form', async () => {
    const opening = mapBudgetAccountRow(account()); f.data.client_budget_accounts = [account({ external_sachleistung_cents: 1000 })];
    expect(await updateClientBudgetAccount(TENANT, CLIENT, ACCOUNT, { externalSachleistungCents: 2000, auditReason: 'Prüfung' }, operation(), opening)).toMatchObject({ ok: false, error: expect.stringContaining('seit dem Öffnen') }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('requires the deactivation receipt to confirm both suspended status and disabled billing', async () => {
    f.rpc.mockImplementation(async (name: string, args: Row) => name === 'mutate_budget_workspace' ? { data: receipt(args, account({ status: 'active', is_enabled: true })), error: null } : { data: null, error: null });
    expect(await deactivateClientBudgetAccount(TENANT, CLIENT, ACCOUNT, 'Prüfung', operation())).toMatchObject({ ok: false, uncertain: true });
  });

  it('does not write if the scoped account is absent or belongs to another client', async () => {
    for (const rows of [[], [account({ client_id: TRANSACTION })]]) { f.data.client_budget_accounts = rows; expect(await deactivateClientBudgetAccount(TENANT, CLIENT, ACCOUNT, 'Prüfung', operation())).toMatchObject({ ok: false }); }
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('retains original account CAS state on an uncertain retry instead of silently accepting a newer account', async () => {
    const id = operation(); const input = { externalSachleistungCents: 2000, auditReason: 'Prüfung' };
    f.rpc.mockResolvedValue({ data: null, error: null }); expect(await updateClientBudgetAccount(TENANT, CLIENT, ACCOUNT, input, id)).toMatchObject({ ok: false, uncertain: true });
    const original = structuredClone(writes()[0][1]); f.data.client_budget_accounts = [account({ updated_at: 'later' })];
    f.rpc.mockImplementation(async (_name: string, args: Row) => rpcSuccess(args));
    expect(await updateClientBudgetAccount(TENANT, CLIENT, ACCOUNT, input, id)).toMatchObject({ ok: true }); expect(writes()[1][1]).toEqual(original); expect(f.calls).toHaveLength(1);
  });
});

describe('reviewable budget previews and explicit initialization', () => {
  it('uses fresh database state rather than passed stale care parameters and never writes during preview', async () => {
    f.data.client_budget_accounts = []; const result = await preview();
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data).toHaveLength(10); expect(result.data.every(diff => diff.create && diff.catalogAmountCents === 13100)).toBe(true);
    expect(result.data[0]).toMatchObject({ periodStart: '2026-01-01', periodEnd: '2027-06-30' });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('does not return a false empty preview when a required read fails', async () => {
    const original = f.read.getMockImplementation()!; f.read.mockImplementation((call: Call) => call.table === 'budget_template_catalog' ? { data: null, error: { message: 'Katalogabfrage fehlgeschlagen' } } : original(call));
    expect(await preview()).toEqual({ ok: false, error: 'Katalogabfrage fehlgeschlagen' }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('requires a persisted funding confirmation before either preview or initialization', async () => {
    f.data.client_funding_selections = null;
    expect(await preview()).toMatchObject({ ok: false, error: expect.stringContaining('Finanzierungsarten bestätigen') });
    expect(await ensureBudgetWorkspaceAccounts(TENANT, CLIENT, '2026-10-17')).toMatchObject({ ok: false }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('keeps individual, locked and insufficient standard budgets unchanged in the review', async () => {
    f.data.client_budget_accounts = [account({ is_individual_override: true }), account({ id: TRANSACTION, locked: true }), account({ id: SELECTION, used_cents: 14000 })];
    const result = await preview(); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.filter(diff => !diff.create).map(diff => diff.skipped)).toEqual([true, true, true]); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('applies only approved changed rows and validates returned changed counts', async () => {
    const diffs: BudgetRecalcDiff[] = [
      { accountId: ACCOUNT, catalogKey: 'paragraph_45b', label: 'Entlastung', currentAllocatedCents: 10000, catalogAmountCents: 13100, deltaCents: 3100, skipped: false, asOfDate: '2026-10-17' },
      { accountId: TRANSACTION, catalogKey: 'paragraph_45b', label: 'Unverändert', currentAllocatedCents: 13100, catalogAmountCents: 13100, deltaCents: 0, skipped: false, asOfDate: '2026-10-17' },
      { accountId: SELECTION, catalogKey: 'paragraph_45b', label: 'Individuell', currentAllocatedCents: 50000, catalogAmountCents: 13100, deltaCents: -36900, skipped: true, asOfDate: '2026-10-17' },
    ];
    expect(await applyBudgetRecalculation(TENANT, CLIENT, diffs, ' Katalogabgleich ', operation())).toEqual({ ok: true, data: { updated: 1, created: 0 } });
    expect((lastInput().diffs as unknown[])).toHaveLength(1);
    f.rpc.mockImplementation(async (name: string, args: Row) => name === 'mutate_budget_workspace' ? { data: receipt(args, { updated: 0, created: 0 }), error: null } : { data: null, error: null });
    expect(await applyBudgetRecalculation(TENANT, CLIENT, diffs, 'Prüfung', operation())).toMatchObject({ ok: false, uncertain: true });
  });
  it('rejects duplicate/incomplete reviewed changes before RPC', async () => {
    const diff: BudgetRecalcDiff = { accountId: ACCOUNT, catalogKey: 'paragraph_45b', label: 'Entlastung', currentAllocatedCents: 10000, catalogAmountCents: 13100, deltaCents: 3100, skipped: false };
    expect(await applyBudgetRecalculation(TENANT, CLIENT, [diff], 'Prüfung', operation())).toMatchObject({ ok: false });
    expect(await applyBudgetRecalculation(TENANT, CLIENT, [{ ...diff, asOfDate: '2026-10-17' }, { ...diff, asOfDate: '2026-10-17' }], 'Prüfung', operation())).toMatchObject({ ok: false }); expect(f.rpc).not.toHaveBeenCalled();
  });
  it('initializes only explicitly requested missing accounts using one reviewed transaction', async () => {
    f.data.client_budget_accounts = [];
    expect(await ensureBudgetWorkspaceAccounts(TENANT, CLIENT, '2026-10-17')).toEqual({ ok: true, data: { updated: 10, created: 10 } }); expect(writes()).toHaveLength(1);
    expect(lastInput().asOfDate).toBe('2026-10-17');
  });
  it.each([true, false])('creates only the joint annual 2026 budget with catalog auto-generation %s', async autoGenerate => {
    f.data.client_budget_accounts = [];
    f.data.client_funding_selections = fundingRow(['verhinderungspflege']);
    f.data.budget_template_catalog = [template({ catalog_key: 'gemeinsames_jahresbudget', period: 'yearly', default_amount_cents: 353900, care_grade_min: 'pg2', auto_generate: autoGenerate }), template({ id: SELECTION, catalog_key: 'verhinderungspflege', period: 'yearly', default_amount_cents: 168500, care_grade_min: 'pg2' })];
    const result = await preview(); expect(result.ok).toBe(true); if (!result.ok) return;
    const creates = result.data.filter(diff => diff.create && !diff.skipped);
    expect(creates.map(diff => diff.catalogKey)).toEqual(['gemeinsames_jahresbudget']);
  });
  it.each(['active', 'closed'])('does not double an existing %s legacy annual budget by adding a joint account', async status => {
    f.data.client_funding_selections = fundingRow(['verhinderungspflege']);
    f.data.budget_template_catalog = [template({ catalog_key: 'gemeinsames_jahresbudget', period: 'yearly', default_amount_cents: 353900, care_grade_min: 'pg2' })];
    f.data.client_budget_accounts = [account({ catalog_key: 'verhinderungspflege', period: 'yearly', period_start: '2026-01-01', period_end: '2026-12-31', allocated_cents: 168500, status })];
    const result = await preview(); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.filter(diff => diff.create && !diff.skipped)).toEqual([]);
  });
});
