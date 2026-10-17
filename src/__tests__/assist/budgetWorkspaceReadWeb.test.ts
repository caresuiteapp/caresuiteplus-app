import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientAssistBillingProfile, ClientBudgetAccount } from '@/types/assist/clientAssistBilling';
type Call = { table: string; ops: [string, unknown[]][] };
const f = vi.hoisted(() => ({ calls: [] as Call[], resolve: vi.fn(), client: null as object | null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_: unknown, table: string) => chain(table) }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (tenant: string) => tenant === 'tenant-1' ? null : { ok: false, error: 'Kein Zugriff.' } }));
function chain(table: string) { const call: Call = { table, ops: [] }; f.calls.push(call); const q: Record<string, unknown> = {}; for (const method of ['select', 'eq', 'is', 'gte', 'lte', 'order', 'or', 'in', 'range']) q[method] = (...args: unknown[]) => { call.ops.push([method, args]); return q; }; q.maybeSingle = () => Promise.resolve().then(() => f.resolve(call)); q.then = (yes: (value: unknown) => void, no: (error: unknown) => void) => Promise.resolve().then(() => f.resolve(call)).then(yes, no); return q; }
import { getBudgetWorkspaceProfile, listBudgetWorkspaceTransactions } from '@/lib/assist/budgetWorkspaceService.web';
import { buildWorkspaceWarnings, currentWorkspaceAccounts, projectWorkspacePlanning, validBudgetDate, workspaceAvailability, type BudgetPlanningVisit } from '@/lib/assist/budgetWorkspaceModel.web';
import { buildClientBudgetVisualModels, buildClientBudgetVisualPlaceholders } from '@/lib/assist/clientBudgetVisuals.web';

const account = (changes: Partial<ClientBudgetAccount> = {}): ClientBudgetAccount => ({ id: 'account-1', tenantId: 'tenant-1', clientId: 'client-1', catalogTemplateId: null, catalogKey: 'paragraph_45b', catalogYear: 2026, period: 'monthly', periodStart: '2026-10-01', periodEnd: '2027-06-30', allocatedCents: 13100, usedCents: 0, reservedCents: 0, isIndividualOverride: false, individualAmountCents: null, standardAmountCents: 13100, locked: false, lockReason: null, isEnabled: true, catalogSnapshot: {}, billingPriority: 1, status: 'active', notes: null, ...changes });
const profile = (changes: Partial<ClientAssistBillingProfile> = {}): ClientAssistBillingProfile => ({ asOfDate: '2026-10-17', budgetYear: 2026, careGrade: 'pg2', careEntitlement: { id: 'care-1', tenantId: 'tenant-1', clientId: 'client-1', careGrade: 'pg2', validFrom: '2026-01-01', validUntil: null, conversionEnabled: true, careFundName: null, careFundMemberId: null, mdAssessmentDate: null, notes: null, source: 'manual' }, conversionEligible: true, fundingSources: ['entlastungsleistung'], carePreventionMode: 'joint_annual_budget', serviceEntitlements: [], catalogHourlyRateCents: 3275, budgetAccounts: [], priorityRules: [], warnings: [], templates: [], canUseBudgetByCatalogKey: {}, ...changes });
const visit = (changes: Partial<BudgetPlanningVisit> = {}): BudgetPlanningVisit => ({ id: 'visit-1', legacy_assignment_id: null, assignment_date: '2026-10-20', planned_start_at: '2026-10-20T09:00:00Z', planned_end_at: '2026-10-20T10:00:00Z', duration_minutes: 60, budget_amount_cents: 5000, billing_budget_source_key: 'paragraph_45b', planning_status: 'scheduled', execution_status: 'not_started', canonical_status: 'planned', ...changes });
const accountRow = (changes: Record<string, unknown> = {}) => ({ id: 'account-1', tenant_id: 'tenant-1', client_id: 'client-1', catalog_key: 'paragraph_45b', catalog_year: 2026, period: 'monthly', period_start: '2026-10-01', period_end: '2027-06-30', allocated_cents: 13100, used_cents: 0, reserved_cents: 0, is_enabled: true, locked: false, billing_priority: 1, status: 'active', ...changes });
const careRow = { id: 'care-1', tenant_id: 'tenant-1', client_id: 'client-1', care_grade: 'pg2', valid_from: '2026-01-01', valid_until: null, conversion_enabled: true };
beforeEach(() => { f.calls = []; f.client = { from: chain }; f.resolve.mockReset(); f.resolve.mockImplementation((call: Call) => ({ error: null, data: call.table === 'clients' ? { id: 'client-1' } : call.table === 'client_care_entitlement' ? [careRow] : call.table === 'client_budget_accounts' ? [accountRow()] : call.table === 'client_funding_selections' ? { id: 'selection-1', sources: ['entlastungsleistung'], effective_from: '2026-01-01' } : ['client_budget_mode', 'client_insurance_profiles'].includes(call.table) ? null : [] })); });

describe('Web budget account selection and honest balances', () => {
  it('preserves all §45b carry-over buckets and never falls back to another period', () => {
    const prior = account({ id: 'carry', catalogYear: 2025, periodStart: '2025-01-01', periodEnd: '2026-06-30' });
    const recent = account({ periodStart: '2026-01-01' });
    expect(currentWorkspaceAccounts([prior, recent], '2026-05-10').map(a => a.id)).toEqual(['carry', 'account-1']);
    expect(currentWorkspaceAccounts([prior], '2026-10-17')).toEqual([]);
    expect(currentWorkspaceAccounts([prior, prior], '2026-05-10')).toHaveLength(1);
  });
  it('keeps zero allocation zero and displays usage, planning and deficits without clamps', () => {
    const model = buildClientBudgetVisualModels(profile({ budgetAccounts: [account({ allocatedCents: 0, usedCents: 5000, reservedCents: 2000 })] }))[0];
    expect(model).toMatchObject({ totalCents: 0, usedCents: 5000, reservedCents: 2000, availableCents: -7000 });
    expect(model.usedPercent + model.reservedPercent + model.availablePercent).toBeCloseTo(100);
  });
  it('does not invent 131 Euro in an empty booked account or loading state', () => {
    expect(buildClientBudgetVisualModels(profile())[0]).toMatchObject({ totalCents: 0, availableCents: 0, balanceKnown: false, enabled: false, statusLabel: 'Kein Budgetkonto für diesen Zeitraum' });
    expect(buildClientBudgetVisualPlaceholders()[0]).toMatchObject({ bookingState: 'loading', totalCents: 0, availableCents: 0 });
    expect(buildClientBudgetVisualModels(profile({ fundingSources: [] }))[0]).toMatchObject({ bookingState: 'preview', totalCents: 13100 });
  });
  it('requires an eligible grade for any claim and keeps disabled accounts out of available money', () => {
    expect(buildClientBudgetVisualModels(profile({ careGrade: 'kein' }))[0]).toMatchObject({ bookingState: 'not_eligible', totalCents: 0 });
    expect(buildClientBudgetVisualModels(profile({ budgetAccounts: [account({ locked: true })] }))[0]).toMatchObject({ totalCents: 0, enabled: false, statusLabel: 'Budgetkonto gesperrt oder deaktiviert' });
  });
  it('caps conversion to remaining Sachleistungen and exposes overplanning', () => {
    const model = buildClientBudgetVisualModels(profile({ fundingSources: ['umwandlung'], budgetAccounts: [account({ catalogKey: 'umwandlung_pg2', allocatedCents: 31840, usedCents: 15000, reservedCents: 6000, externalSachleistungCents: 60000, periodEnd: '2026-10-31' })] }))[1];
    expect(model).toMatchObject({ totalCents: 19600, availableCents: -1400, usedCents: 15000, reservedCents: 6000 });
  });
  it('does not project hours from an arbitrary service when active prices differ', () => {
    const services = [3275, 4500].map((hourlyRateCents, i) => ({ id: `s${i}`, tenantId: 'tenant-1', clientId: 'client-1', serviceTypeId: null, serviceTypeKey: 'assist', billingMode: 'cost_carrier' as const, isActive: true, validFrom: '2026-01-01', validUntil: null, hourlyRateCents, notes: null }));
    expect(buildClientBudgetVisualModels(profile({ serviceEntitlements: services, budgetAccounts: [account()] }))[0].availableHours).toBeNull();
  });
  it('uses any usable account for availability instead of the last depleted bucket', () => {
    expect(workspaceAvailability([account(), account({ id: 'empty', allocatedCents: 0 })], profile()).paragraph_45b).toBe(true);
    expect(workspaceAvailability([account()], profile({ careGrade: null })).paragraph_45b).toBe(false);
    expect(workspaceAvailability([account({ catalogKey: 'verhinderungspflege' })], profile({ careGrade: 'pg1' })).verhinderungspflege).toBe(false);
  });
  it('derives warnings per account and drops resolved conditions on refresh', () => {
    const exhausted = profile({ budgetAccounts: [account({ usedCents: 13100 }), account({ id: 'other', usedCents: 13100 })] });
    expect(buildWorkspaceWarnings('tenant-1', 'client-1', exhausted).filter(w => w.warningType === 'budget_exhausted')).toHaveLength(2);
    expect(buildWorkspaceWarnings('tenant-1', 'client-1', profile({ budgetAccounts: [account()] }))).toEqual([]);
    expect(buildWorkspaceWarnings('tenant-1', 'client-1', profile({ careGrade: null, fundingSources: ['selbstzahler'] }))).toEqual([]);
  });
  it('flags legacy split and duplicate annual budgets without inventing or changing a balance', () => {
    const split = account({ catalogKey: 'verhinderungspflege', allocatedCents: 168500 });
    const joint = account({ id: 'joint', catalogKey: 'gemeinsames_jahresbudget', allocatedCents: 353900 });
    const single = buildWorkspaceWarnings('tenant-1', 'client-1', profile({ budgetAccounts: [split] }));
    expect(single).toContainEqual(expect.objectContaining({ warningType: 'prevention_legacy_accounts' }));
    const both = buildWorkspaceWarnings('tenant-1', 'client-1', profile({ budgetAccounts: [split, joint] }));
    expect(both).toContainEqual(expect.objectContaining({ warningType: 'prevention_duplicate_accounts', severity: 'critical' }));
    expect(split.allocatedCents).toBe(168500); expect(joint.allocatedCents).toBe(353900);
    expect(buildWorkspaceWarnings('tenant-1', 'client-1', profile({ budgetYear: 2027, budgetAccounts: [split] }))).toEqual([]);
    expect(buildWorkspaceWarnings('tenant-1', 'client-1', profile(), undefined, [{ ...split, status: 'closed' }])).toContainEqual(expect.objectContaining({ warningType: 'prevention_legacy_accounts' }));
  });
  it('rejects impossible dates and accepts leap days', () => { expect(validBudgetDate('2026-02-30')).toBe(false); expect(validBudgetDate('0000-01-01')).toBe(false); expect(validBudgetDate('2028-02-29')).toBe(true); });
});

describe('planning projection reconciles with the actual reservation ledger', () => {
  it('preserves unrelated reserved money and only adds missing allocation amounts', () => {
    const result = projectWorkspacePlanning({ accounts: [account({ reservedCents: 7000 })], visits: [visit()], allocations: [{ assignment_id: 'visit-1', budget_account_id: 'account-1', planned_amount_cents: 5000, reserved_amount_cents: 0, allocation_status: 'planned' }], reservations: [{ reference_type: 'assist_visit', reference_id: 'visit-1', budget_account_id: 'account-1', amount_cents: 3000 }], hourlyRateCents: 3275 });
    expect(result.accounts[0].reservedCents).toBe(9000); expect(result.additionalCents).toBe(2000);
  });
  it('keeps reserved money when there are no active planned visits', () => { expect(projectWorkspacePlanning({ accounts: [account({ reservedCents: 9000 })], visits: [], allocations: [], reservations: [], hourlyRateCents: null }).accounts[0].reservedCents).toBe(9000); });
  it('splits inferred planning across earliest expiring buckets and reports uncovered planning', () => {
    const result = projectWorkspacePlanning({ accounts: [account({ id: 'new', allocatedCents: 1000 }), account({ id: 'old', periodEnd: '2026-10-31', allocatedCents: 2000 })], visits: [visit()], allocations: [], reservations: [], hourlyRateCents: 3275 });
    expect(result.accounts.map(a => a.reservedCents)).toEqual([1000, 2000]); expect(result.unallocatedCents).toBe(2000);
  });
  it('does not fallback to another funding source when an explicit source is unavailable', () => {
    const result = projectWorkspacePlanning({ accounts: [account()], visits: [visit({ billing_budget_source_key: 'umwandlung_pg2' })], allocations: [], reservations: [], hourlyRateCents: 3275 });
    expect(result.additionalCents).toBe(0); expect(result.unallocatedCents).toBe(5000);
  });
  it('does not double count an already reserved visit without allocation rows', () => {
    const result = projectWorkspacePlanning({ accounts: [account({ reservedCents: 5000 })], visits: [visit()], allocations: [], reservations: [{ reference_type: 'assist_visit', reference_id: 'visit-1', budget_account_id: 'account-1', amount_cents: 5000 }], hourlyRateCents: 3275 });
    expect(result.accounts[0].reservedCents).toBe(5000); expect(result.additionalCents).toBe(0);
  });
  it('does not add new projections to expired or locked allocated accounts', () => {
    for (const source of [account({ locked: true }), account({ periodEnd: '2026-09-30' })]) {
      const result = projectWorkspacePlanning({ accounts: [source], visits: [visit()], allocations: [{ assignment_id: 'visit-1', budget_account_id: 'account-1', planned_amount_cents: 5000, reserved_amount_cents: 0, allocation_status: 'planned' }], reservations: [], hourlyRateCents: 3275 });
      expect(result.additionalCents).toBe(0); expect(result.unallocatedCents).toBe(5000);
    }
  });
});

describe('Web profile and history use read-only database contracts', () => {
  it('loads real accounts and source selection without any write, legacy sync or warning table', async () => {
    const result = await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' });
    expect(result).toMatchObject({ ok: true, data: { fundingSelection: { id: 'selection-1' }, budgetAccounts: [{ id: 'account-1' }] } });
    expect(f.calls.some(c => c.table === 'client_billing_warnings' || c.ops.some(([method]) => ['insert', 'update', 'upsert', 'rpc'].includes(method)))).toBe(false);
  });
  it('fails visibly if planned reservations cannot be loaded rather than displaying a false available balance', async () => {
    const normal = f.resolve.getMockImplementation()!; f.resolve.mockImplementation((call: Call) => call.table === 'assignment_budget_allocations' ? { data: null, error: { message: 'offline' } } : normal(call));
    expect((await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' })).ok).toBe(false);
  });
  it('distinguishes a persisted selection from inferred legacy checkbox defaults', async () => {
    const normal = f.resolve.getMockImplementation()!; f.resolve.mockImplementation((call: Call) => call.table === 'client_funding_selections' ? { data: null, error: null } : normal(call));
    expect(await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' })).toMatchObject({ ok: true, data: { fundingSelection: null, fundingSources: ['entlastungsleistung', 'umwandlung'] } });
  });
  it('presents a legacy grade as unconfirmed without creating an entitlement or guessing conversion permission', async () => {
    const normal = f.resolve.getMockImplementation()!;
    f.resolve.mockImplementation((call: Call) => call.table === 'client_care_entitlement' ? { data: [], error: null } : call.table === 'client_care_levels' ? { data: [{ grade: 'pg3', valid_from: '2026-01-01', valid_until: null }], error: null } : call.table === 'client_funding_selections' ? { data: null, error: null } : normal(call));
    const result = await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' });
    expect(result).toMatchObject({ ok: true, data: { careGrade: 'pg3', careEntitlement: null, careGradeNeedsConfirmation: true, conversionEligible: false, fundingSources: ['entlastungsleistung'] } });
    expect(result.ok && result.data.warnings[0].warningType).toBe('care_entitlement_unconfirmed');
  });
  it('uses insurance grade only as an unconfirmed fallback when canonical and legacy level data are absent', async () => {
    const normal = f.resolve.getMockImplementation()!;
    f.resolve.mockImplementation((call: Call) => call.table === 'client_care_entitlement' ? { data: [], error: null } : call.table === 'client_insurance_profiles' ? { data: { care_level: 'PG 2', self_pay: false }, error: null } : normal(call));
    expect(await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' })).toMatchObject({ ok: true, data: { careGrade: 'pg2', careEntitlement: null, careGradeNeedsConfirmation: true } });
  });
  it('blocks invalid date and foreign tenant before any request', async () => {
    expect((await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-02-30' })).ok).toBe(false);
    expect((await getBudgetWorkspaceProfile({ tenantId: 'foreign', clientId: 'client-1' })).ok).toBe(false); expect(f.calls).toHaveLength(0);
  });
  it('keeps unrelated future planning out of the current month warning while retaining stored reserves', async () => {
    const normal = f.resolve.getMockImplementation()!;
    f.resolve.mockImplementation((call: Call) => call.table === 'assist_visits' ? { error: null, data: [visit({ assignment_date: '2026-12-10' })] } : call.table === 'client_budget_accounts' ? { error: null, data: [accountRow({ reserved_cents: 9000 })] } : normal(call));
    const result = await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' });
    expect(result).toMatchObject({ ok: true, data: { planningProjection: { additionalCents: 0, unallocatedCents: 0 }, budgetAccounts: [{ reservedCents: 9000 }] } });
    expect(f.calls.find(c => c.table === 'assist_visits')!.ops).toEqual(expect.arrayContaining([['gte', ['assignment_date', '2026-10-01']], ['lte', ['assignment_date', '2026-10-31']]]));
  });
  it('paginates large budget account sets instead of silently truncating them', async () => {
    const normal = f.resolve.getMockImplementation()!;
    f.resolve.mockImplementation((call: Call) => {
      if (call.table !== 'client_budget_accounts') return normal(call);
      const offset = call.ops.find(([method]) => method === 'range')?.[1][0];
      return { error: null, data: offset === 0 ? Array.from({ length: 500 }, (_, index) => accountRow({ id: `account-${index}` })) : [accountRow({ id: 'account-500' })] };
    });
    const result = await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' });
    expect(result.ok && result.data.budgetAccounts).toHaveLength(501);
    expect(f.calls.filter(c => c.table === 'client_budget_accounts')).toHaveLength(2);
  });
  it('uses only the price effective on the chosen day and reports price retrieval errors', async () => {
    const normal = f.resolve.getMockImplementation()!;
    f.resolve.mockImplementation((call: Call) => call.table === 'tenant_service_catalog' ? { error: null, data: [{ id: 'catalog-1', service_key: 'assist.alltagsbegleitung' }] } : call.table === 'tenant_service_prices' ? { error: null, data: [{ catalog_id: 'catalog-1', price_net: 32.75, valid_from: '2026-01-01', valid_to: '2026-10-31' }] } : normal(call));
    expect(await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' })).toMatchObject({ ok: true, data: { catalogHourlyRateCents: 3275 } });
    expect(f.calls.find(c => c.table === 'tenant_service_prices')!.ops).toContainEqual(['lte', ['valid_from', '2026-10-17']]);
    f.resolve.mockImplementation((call: Call) => call.table === 'tenant_service_catalog' ? { data: null, error: { message: 'offline' } } : normal(call));
    const result = await getBudgetWorkspaceProfile({ tenantId: 'tenant-1', clientId: 'client-1', date: '2026-10-17' });
    expect(result.ok && result.data.warnings.some(w => w.warningType === 'hourly_rate_unavailable')).toBe(true);
  });
  it('includes closed-account history, scoped and deterministically paginated', async () => {
    const result = await listBudgetWorkspaceTransactions('tenant-1', 'client-1', { offset: 50, limit: 51, transactionType: 'usage' });
    expect(result.ok).toBe(true);
    const accountCall = f.calls.find(c => c.table === 'client_budget_accounts')!;
    expect(accountCall.ops.some(([method, args]) => method === 'in' && args[0] === 'status')).toBe(false);
    const history = f.calls.find(c => c.table === 'client_budget_transactions')!;
    expect(history.ops).toEqual(expect.arrayContaining([['eq', ['tenant_id', 'tenant-1']], ['eq', ['client_id', 'client-1']], ['range', [50, 100]], ['order', ['id', { ascending: false }]]]));
  });
  it('retains the transaction lifecycle so old reservations are not mislabeled as current planning', async () => {
    const normal = f.resolve.getMockImplementation()!;
    f.resolve.mockImplementation((call: Call) => call.table === 'client_budget_transactions' ? { error: null, data: [{ id: 'tx-1', tenant_id: 'tenant-1', client_id: 'client-1', budget_account_id: 'account-1', transaction_type: 'reservation', amount_cents: 5000, lifecycle_status: 'storniert', created_at: '2026-10-16T12:00:00Z' }] } : normal(call));
    expect(await listBudgetWorkspaceTransactions('tenant-1', 'client-1')).toMatchObject({ ok: true, data: [{ transactionType: 'reservation', lifecycleStatus: 'storniert' }] });
  });
});
