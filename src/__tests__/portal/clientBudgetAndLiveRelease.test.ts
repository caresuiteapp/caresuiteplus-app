import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  settings: vi.fn(), funding: vi.fn(), rate: vi.fn(), from: vi.fn(),
  rows: {} as Record<string, Record<string, unknown>[]>,
  failures: {} as Record<string, { message: string; code: string }>,
  queries: [] as { table: string; filters: [string, string, unknown][] }[],
}));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: h.from }) }));
vi.mock('@/lib/client/clientPortalSettingsService', () => ({
  fetchClientPortalSettingsResolved: h.settings,
  canClientPortalSeeFeature: (s: { portalEnabled: boolean; showBudget: boolean; showAppointments: boolean }, feature: string) =>
    s.portalEnabled && (feature === 'budget' ? s.showBudget : s.showAppointments),
}));
vi.mock('@/lib/clients/clientFundingSourceService', () => ({ getClientFundingSelection: h.funding }));
vi.mock('@/lib/assist/tenantAssistHourlyRateService', () => ({ getTenantAssistHourlyRateCents: h.rate }));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({ visitSupabaseRepository: {} }));
vi.mock('@/lib/assist/visitService', () => ({ fetchVisitDispositionDetail: vi.fn() }));
vi.mock('@/lib/portal/clientPortalAssistLiveVisitService', () => ({
  projectClientPortalAssistLiveVisit: vi.fn(), sanitizeClientPortalLiveVisitPayload: vi.fn(),
}));

import { fetchPortalBudgetSnapshot, fetchPortalBudgetVisuals } from '@/lib/portal/assist/portalBudgetService';
import { fetchActiveLivePortalAssignmentForClient } from '@/lib/portal/portalAppointmentsLiveService';
import { releasedLiquidPortalNavigation } from '@/liquid-command/navigation/portalCatalog';

const settings = (patch = {}) => ({ portalEnabled: true, showBudget: true, showAppointments: true, ...patch });
const account = (catalogKey = 'paragraph_45b') => ({
  id: 'account-1', tenant_id: 'tenant-1', client_id: 'client-1', catalog_key: catalogKey,
  catalog_year: 2026, period: 'monthly', period_start: '2026-01-01', period_end: '2027-06-30',
  allocated_cents: 26200, used_cents: 3100, reserved_cents: 0, status: 'active', is_enabled: true,
});
const assignment = (id: string) => ({
  id, tenant_id: 'tenant-1', client_id: 'client-1', status: 'on_the_way', title: 'Anfahrt',
  planned_start_at: '2026-10-11T10:00:00Z', planned_end_at: '2026-10-11T11:00:00Z',
});

beforeEach(() => {
  vi.clearAllMocks(); h.rows = {}; h.failures = {}; h.queries = [];
  h.settings.mockResolvedValue({ ok: true, data: settings() });
  h.funding.mockResolvedValue({ ok: true, data: { sources: ['entlastungsleistung'] } });
  h.rate.mockResolvedValue({ ok: true, data: 3275 });
  h.from.mockImplementation((table: string) => {
    const filters: [string, string, unknown][] = [];
    h.queries.push({ table, filters });
    let single = false;
    let limit = Infinity;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push(['eq', key, value]); return query; },
      neq: (key: string, value: unknown) => { filters.push(['neq', key, value]); return query; },
      lte: (key: string, value: unknown) => { filters.push(['lte', key, value]); return query; },
      gte: (key: string, value: unknown) => { filters.push(['gte', key, value]); return query; },
      in: (key: string, value: unknown) => { filters.push(['in', key, value]); return query; },
      or: (value: string) => { filters.push(['or', '', value]); return query; },
      order: () => query,
      limit: (value: number) => { limit = value; return query; },
      maybeSingle: () => { single = true; return query; },
      then: (resolve: (value: unknown) => unknown) => {
        const rows = (h.rows[table] ?? []).filter((row) => filters.every(([op, key, value]) => {
          if (op === 'eq') return row[key] === value;
          if (op === 'neq') return row[key] !== value;
          if (op === 'lte') return String(row[key]) <= String(value);
          if (op === 'gte') return String(row[key]) >= String(value);
          if (op === 'in') return (value as unknown[]).includes(row[key]);
          if (op === 'or') return String(value).split(',').some((clause) => {
            const [field, comparator, ...rest] = clause.split('.');
            const target = rest.join('.');
            return comparator === 'is' ? row[field] == null : comparator === 'gte'
              ? row[field] != null && String(row[field]) >= target : String(row[field]) === target;
          });
          return true;
        })).slice(0, limit);
        return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: h.failures[table] ?? null }).then(resolve);
      },
    };
    return query;
  });
});

describe('client budget release and personal data', () => {
  it.each([{ showBudget: false }, { portalEnabled: false }])('does not read financial tables when release is blocked: %j', async (patch) => {
    h.settings.mockResolvedValue({ ok: true, data: settings(patch) });
    expect(await fetchPortalBudgetVisuals('tenant-1', 'client-1')).toEqual({ ok: true, data: [] });
    expect(await fetchPortalBudgetSnapshot('tenant-1', 'client-1')).toEqual({ ok: true, data: null });
    expect(h.from).not.toHaveBeenCalled();
  });
  it('fails closed when the release lookup fails', async () => {
    h.settings.mockResolvedValue({ ok: false, error: 'Freigabe unbekannt' });
    expect(await fetchPortalBudgetVisuals('tenant-1', 'client-1')).toEqual({ ok: false, error: 'Freigabe unbekannt' });
    expect(h.from).not.toHaveBeenCalled();
  });
  it('shows no personal live balance for a client without budget accounts', async () => {
    expect(await fetchPortalBudgetVisuals('tenant-1', 'client-1', '2026-10-11')).toEqual({ ok: true, data: [] });
  });
  it('uses actual account amounts, authoritative bookings and the tenant hourly rate', async () => {
    h.rows.client_budget_accounts = [account()];
    const result = await fetchPortalBudgetVisuals('tenant-1', 'client-1', '2026-10-11');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({ totalCents: 26200, availableCents: 23100, bookingState: 'booked', hourlyRateCents: 3275 });
    expect(h.funding).toHaveBeenCalledWith('tenant-1', 'client-1');
  });
  it('does not present a deselected old account as a booked service', async () => {
    h.rows.client_budget_accounts = [account()];
    h.funding.mockResolvedValue({ ok: true, data: { sources: ['selbstzahler'] } });
    expect(await fetchPortalBudgetVisuals('tenant-1', 'client-1', '2026-10-11')).toEqual({ ok: true, data: [] });
  });
  it.each(['paragraph_45b', 'umwandlung_pg2'])('shows only existing personal accounts when both funding sources are selected (%s)', async (catalogKey) => {
    h.rows.client_budget_accounts = [account(catalogKey)];
    h.rows.client_care_entitlement = [{
      tenant_id: 'tenant-1', client_id: 'client-1', care_grade: 'pg2', valid_from: '2026-01-01', valid_until: null,
      conversion_enabled: true,
    }];
    h.funding.mockResolvedValue({ ok: true, data: { sources: ['entlastungsleistung', 'umwandlung'] } });
    const result = await fetchPortalBudgetVisuals('tenant-1', 'client-1', '2026-10-11');
    expect(result.ok && result.data.map((model) => model.id)).toEqual([catalogKey === 'paragraph_45b' ? 'entlastung' : 'umwandlung']);
  });
  it('preserves an actual zero conversion allocation instead of substituting the statutory potential', async () => {
    h.rows.client_budget_accounts = [{ ...account('umwandlung_pg2'), allocated_cents: 0, used_cents: 0 }];
    h.rows.client_care_entitlement = [{
      tenant_id: 'tenant-1', client_id: 'client-1', care_grade: 'pg2', valid_from: '2026-01-01', valid_until: null,
      conversion_enabled: true,
    }];
    h.funding.mockResolvedValue({ ok: true, data: { sources: ['umwandlung'] } });
    const result = await fetchPortalBudgetVisuals('tenant-1', 'client-1', '2026-10-11');
    expect(result.ok && result.data[0]).toMatchObject({ id: 'umwandlung', totalCents: 0, availableCents: 0, availableHours: 0 });
  });
  it('does not use expired service rates', async () => {
    h.rows.client_budget_accounts = [account()];
    h.rows.client_service_entitlements = [{
      tenant_id: 'tenant-1', client_id: 'client-1', is_active: true, valid_from: '2026-01-01',
      valid_until: '2026-09-30', hourly_rate_cents: 9000,
    }];
    const result = await fetchPortalBudgetVisuals('tenant-1', 'client-1', '2026-10-11');
    expect(result.ok && result.data[0].hourlyRateCents).toBe(3275);
  });
  it('hides the budget menu until a positive release is known', () => {
    expect(releasedLiquidPortalNavigation('client').some((item) => item.id === 'budget')).toBe(false);
    expect(releasedLiquidPortalNavigation('client', settings({ showBudget: false }) as never).some((item) => item.id === 'budget')).toBe(false);
    expect(releasedLiquidPortalNavigation('client', settings() as never).some((item) => item.id === 'budget')).toBe(true);
    expect(releasedLiquidPortalNavigation('employee').some((item) => item.id === 'payroll')).toBe(true);
  });
});

describe('client live location release', () => {
  it('does not read live assignments when appointment visibility is disabled', async () => {
    h.settings.mockResolvedValue({ ok: true, data: settings({ showAppointments: false }) });
    expect(await fetchActiveLivePortalAssignmentForClient('tenant-1', 'client-1')).toEqual({ ok: true, data: null });
    expect(h.from).not.toHaveBeenCalled();
  });
  it.each([false, undefined])('does not open an unreleased or unknown visit (%s)', async (release) => {
    h.rows.assignments = [assignment('assignment-1')];
    h.rows.assist_visits = [{ id: 'visit-1', legacy_assignment_id: 'assignment-1', tenant_id: 'tenant-1', client_id: 'client-1', portal_release_enabled: release }];
    expect(await fetchActiveLivePortalAssignmentForClient('tenant-1', 'client-1')).toEqual({ ok: true, data: null });
  });
  it('uses the released canonical visit for a legacy assignment link', async () => {
    h.rows.assignments = [assignment('assignment-1')];
    h.rows.assist_visits = [{ id: 'visit-1', legacy_assignment_id: 'assignment-1', tenant_id: 'tenant-1', client_id: 'client-1', portal_release_enabled: true }];
    const result = await fetchActiveLivePortalAssignmentForClient('tenant-1', 'client-1');
    expect(result.ok && result.data).toMatchObject({ id: 'visit-1', portalReleaseEnabled: true });
  });
  it('supports assignment mirrors that already use the canonical visit id', async () => {
    h.rows.assignments = [assignment('visit-1')];
    h.rows.assist_visits = [{ id: 'visit-1', tenant_id: 'tenant-1', client_id: 'client-1', portal_release_enabled: true }];
    const result = await fetchActiveLivePortalAssignmentForClient('tenant-1', 'client-1');
    expect(result.ok && result.data?.id).toBe('visit-1');
  });
  it('skips an unreleased active assignment and finds the next released one', async () => {
    h.rows.assignments = [assignment('assignment-1'), assignment('assignment-2')];
    h.rows.assist_visits = [{ id: 'visit-2', legacy_assignment_id: 'assignment-2', tenant_id: 'tenant-1', client_id: 'client-1', portal_release_enabled: true }];
    const result = await fetchActiveLivePortalAssignmentForClient('tenant-1', 'client-1');
    expect(result.ok && result.data?.id).toBe('visit-2');
  });
  it('rejects foreign-client and foreign-tenant release rows', async () => {
    h.rows.assignments = [assignment('assignment-1')];
    h.rows.assist_visits = [
      { id: 'visit-1', legacy_assignment_id: 'assignment-1', tenant_id: 'tenant-1', client_id: 'other-client', portal_release_enabled: true },
      { id: 'visit-2', legacy_assignment_id: 'assignment-1', tenant_id: 'other-tenant', client_id: 'client-1', portal_release_enabled: true },
    ];
    expect(await fetchActiveLivePortalAssignmentForClient('tenant-1', 'client-1')).toEqual({ ok: true, data: null });
  });
  it('reports release read errors instead of enabling GPS', async () => {
    h.rows.assignments = [assignment('assignment-1')];
    h.failures.assist_visits = { message: 'RLS', code: '42501' };
    expect((await fetchActiveLivePortalAssignmentForClient('tenant-1', 'client-1')).ok).toBe(false);
  });
});
