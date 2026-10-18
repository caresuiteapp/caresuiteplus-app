import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { getWfmOfficeEmployeeTimeAccounts, listOpenReviewEntriesForEmployee } from '@/lib/wfm/wfmOfficeZeitkontenService.web';

const state = vi.hoisted(() => ({
  client: {} as object | null,
  period: { preset: 'custom', fromDate: '2026-10-19', toDate: '2026-10-19' },
  employees: [{ id: 'employee', name: 'Alex' }],
  entries: [] as unknown[],
  tables: {} as Record<string, Record<string, unknown>[]>,
  failedTable: '',
  denied: false,
}));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => state.denied ? { ok: false, error: 'Keine Berechtigung' } : null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.client }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: () => 'Datenbank nicht erreichbar' }));
vi.mock('@/lib/wfm/wfmOfficeTimekeepingService.web', () => ({
  getWfmOfficeTimeOverview: async () => ({ ok: true, data: { period: state.period, employees: state.employees, entries: state.entries } }),
}));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query, gte: () => query, lte: () => query, order: () => query,
      range: async (first: number, last: number) => state.failedTable === table
        ? { data: null, error: { code: '42501' } }
        : { data: (state.tables[table] ?? []).slice(first, last + 1), error: null },
    };
    return query;
  },
}));

function booking(overrides: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return {
    id: 'booking', tenantId: 'tenant', employeeId: 'employee', employeeName: 'Alex', workDate: '2026-10-19',
    plannedStartAt: '2026-10-19T08:00:00Z', plannedEndAt: '2026-10-19T09:00:00Z',
    actualStartAt: '2026-10-19T08:00:00Z', actualEndAt: '2026-10-19T09:00:00Z',
    netMinutes: 60, pauseMinutes: 0, source: 'portal', reviewStatus: 'approved', exportStatus: 'export_ready', flags: [], ...overrides,
  } as WfmOfficeTimeEntry;
}

beforeEach(() => {
  state.client = {}; state.denied = false; state.failedTable = '';
  state.period = { preset: 'custom', fromDate: '2026-10-19', toDate: '2026-10-19' };
  state.employees = [{ id: 'employee', name: 'Alex' }];
  state.entries = [];
  state.tables = {};
});

describe('Office web persisted time accounts', () => {
  it('keeps a free contractual day at zero and includes exported hours in approved hours', async () => {
    state.entries = [booking({ reviewStatus: 'exported', exportStatus: 'exported' }), booking({ id: 'future', actualStartAt: null, actualEndAt: null, reviewStatus: 'open', rowKind: 'planned_upcoming', flags: ['upcoming'] })];
    state.tables.employee_contract_settings = [{ employee_id: 'employee', work_days: { mon: 0 } }];
    const result = await getWfmOfficeEmployeeTimeAccounts('tenant', 'business_manager');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data[0]).toMatchObject({ targetMinutes: 0, targetSource: 'contract', actualMinutes: 60, approvedMinutes: 60, exportedMinutes: 60, saldoMinutes: 60, openReviewCount: 0 });
    expect(listOpenReviewEntriesForEmployee(result.data[0])).toEqual([]);
  });

  it('uses a saved zero only for a complete stored month and uses planning for a partial month without a contract', async () => {
    state.tables.workforce_time_accounts = [{ employee_id: 'employee', period_year: 2026, period_month: 10, target_minutes: 0 }];
    state.entries = [booking()];
    const day = await getWfmOfficeEmployeeTimeAccounts('tenant', 'business_manager');
    expect(day.ok && day.data[0]).toMatchObject({ targetMinutes: 60, targetSource: 'planned' });
    state.period = { preset: 'custom', fromDate: '2026-10-01', toDate: '2026-10-31' };
    const month = await getWfmOfficeEmployeeTimeAccounts('tenant', 'business_manager');
    expect(month.ok && month.data[0]).toMatchObject({ targetMinutes: 0, targetSource: 'saved_account' });
  });

  it('credits absences once and shows vacation and sick days for the labelled year', async () => {
    state.tables.employee_contract_settings = [{ employee_id: 'employee', work_days: { mon: 8 }, annual_vacation_days: 30 }];
    state.tables.workforce_absences = Array.from({ length: 2 }, () => ({ employee_id: 'employee', absence_type: 'vacation', status: 'approved', all_day: true, starts_at: '2026-10-19T00:00:00Z', ends_at: '2026-10-19T23:59:59Z' }));
    state.tables.workforce_time_accounts = [
      { employee_id: 'employee', period_year: 2025, period_month: 12, vacation_days_used: 20, sick_days: 10 },
      { employee_id: 'employee', period_year: 2026, period_month: 1, vacation_days_used: 5, sick_days: 2 },
    ];
    const result = await getWfmOfficeEmployeeTimeAccounts('tenant', 'business_manager');
    expect(result.ok && result.data[0]).toMatchObject({ absenceMinutes: 480, saldoMinutes: 0, vacationYear: 2026, vacationDaysUsed: 5, sickDays: 2, remainingVacationDays: 25 });
  });

  it('never returns successful incomplete balances after an auxiliary read or missing connection', async () => {
    state.failedTable = 'workforce_absences';
    expect(await getWfmOfficeEmployeeTimeAccounts('tenant', 'business_manager')).toEqual({ ok: false, error: 'Datenbank nicht erreichbar' });
    state.client = null;
    const disconnected = await getWfmOfficeEmployeeTimeAccounts('tenant', 'business_manager');
    expect(disconnected.ok).toBe(false);
    state.denied = true;
    expect(await getWfmOfficeEmployeeTimeAccounts('tenant', 'business_manager')).toEqual({ ok: false, error: 'Keine Berechtigung' });
  });

  it('keeps a selected employee isolated even if an upstream result contains additional identities', async () => {
    state.employees.push({ id: 'other', name: 'Bea' });
    state.entries = [booking(), booking({ id: 'other-entry', employeeId: 'other' }), booking({ id: 'foreign-entry', tenantId: 'foreign' })];
    const result = await getWfmOfficeEmployeeTimeAccounts('tenant', 'business_manager', { employeeId: 'employee' });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].actualMinutes).toBe(60);
    expect(result.data[0].entries).toHaveLength(1);
  });
});
