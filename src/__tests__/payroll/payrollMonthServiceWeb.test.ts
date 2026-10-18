import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficeTimeEntryStatus } from '@/types/modules/wfmOfficeTimekeeping';
const state = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>, errors: {} as Record<string, unknown>, reads: [] as string[],
  accounts: [] as WfmOfficeEmployeeTimeAccount[], accountError: '', denied: false, tenantDenied: false, connected: true,
}));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => state.denied ? { ok: false, error: 'Kein Zugriff' } : null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => state.tenantDenied ? { ok: false, error: 'Falscher Mandant' } : null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.connected ? {} : null }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message?: string }) => error?.message ?? 'Lesefehler' }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const chain = { select: () => chain, eq: () => chain, in: () => chain, gte: () => chain, lte: () => chain, order: () => chain,
    range: async (from: number, to: number) => { state.reads.push(`${table}:${from}`); return { data: (state.rows[table] ?? []).slice(from, to + 1), error: state.errors[`${table}:${from}`] ?? state.errors[table] ?? null }; } };
  return chain;
} }));
vi.mock('@/lib/wfm/wfmOfficeZeitkontenService.web', () => ({ getWfmOfficeEmployeeTimeAccounts: async () => state.accountError ? { ok: false, error: state.accountError } : { ok: true, data: state.accounts } }));
vi.mock('@/lib/wfm/wfmOfficePlannedVisitRepository.web', () => ({ listPlannedVisitsForPeriod: async () => ({ ok: true, data: [] }) }));
vi.mock('@/lib/payroll/payrollMonthService.ts', () => ({ loadEmployeePayrollMonth: vi.fn(), decidePayrollStatement: vi.fn(), createExpenseClaim: vi.fn(), uploadExpenseReceipt: vi.fn(), getPayrollPdfUrl: vi.fn() }));
vi.mock('@/lib/payroll/payrollOfficeActions.web', () => ({ publishPayrollStatement: vi.fn(), reviewExpenseClaim: vi.fn() }));
import { listPayrollMonthOverview } from '@/lib/payroll/payrollMonthService.web';

function seedEmployee(id = 'e1', extra: Record<string, unknown> = {}) {
  (state.rows.employees ??= []).push({ id, tenant_id: 'tenant-1', first_name: 'Ada', last_name: id, status: 'active', employment_type: 'part_time', entry_date: '2025-01-01', exit_date: null, ...extra });
  (state.rows.employee_payroll_settings ??= []).push({ tenant_id: 'tenant-1', employee_id: id, compensation_type: 'hourly', compensation_amount: '20', max_payout_hours_month: '1', overflow_to_time_account: true });
  (state.rows.employee_contract_settings ??= []).push({ tenant_id: 'tenant-1', employee_id: id, work_days: { mon: 8 } });
}
function seedAccount(reviewStatus: WfmOfficeTimeEntryStatus = 'approved') {
  const approved = reviewStatus === 'approved' || reviewStatus === 'exported';
  const account: WfmOfficeEmployeeTimeAccount = {
    employeeId: 'e1', employeeName: 'Ada e1', plannedMinutes: 0, actualMinutes: 120,
    approvedMinutes: approved ? 120 : 0, exportedMinutes: 0, saldoMinutes: -879,
    openReviewCount: approved ? 0 : 1, targetMinutes: 999, targetSource: 'saved_account',
    overtimeMinutes: 0, undertimeMinutes: 879, travelMinutes: 0, absenceMinutes: 0,
    vacationDaysUsed: 0, sickDays: 0, annualVacationDays: 30, remainingVacationDays: 30,
    vacationYear: 2026, payrollStatements: [],
    entries: [{
      id: 'entry-1', tenantId: 'tenant-1', employeeId: 'e1', employeeName: 'Ada e1', workDate: '2026-10-12',
      assignmentId: null, visitId: null, clientLabel: null, plannedStartAt: null, plannedEndAt: null,
      actualStartAt: '2026-10-12T08:00:00Z', actualEndAt: '2026-10-12T10:00:00Z',
      startDeviationMinutes: null, endDeviationMinutes: null, startAmpel: null, endAmpel: null, overallAmpel: null,
      startJustification: null, endJustification: null, startJustificationAt: null, endJustificationAt: null,
      grossMinutes: 120, netMinutes: 120, pauseMinutes: 0, travelMinutes: 0, workKind: 'nachtrag',
      status: reviewStatus, reviewStatus, exportStatus: 'not_exported', source: 'manual_addition',
      sessionId: null, officeComment: null, hasOpenOfficeMessage: false,
      rowKind: 'unplanned_actual', flags: [], plannedDurationMinutes: 0,
    }],
  };
  state.accounts.push(account);
}

beforeEach(() => {
  state.rows = {}; state.errors = {}; state.reads = []; state.accounts = []; state.accountError = ''; state.denied = false; state.tenantDenied = false; state.connected = true;
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T10:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

describe('Web payroll complete tenant-scoped reads', () => {
  it('uses contractual work days independently of payout cap and accepts persisted numeric strings', async () => {
    seedEmployee(); seedAccount();
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return;
    const employee = result.data.employees[0];
    expect(employee.calculationReady).toBe(true); expect(employee.targetWorkMinutes).toBe(4 * 8 * 60);
    expect(employee.maxPayoutMinutes).toBe(60); expect(employee.actualWorkMinutes).toBe(120); expect(employee.earnedGrossCents).toBe(2000);
    expect(employee.timeAccountBalanceMinutes).toBe(120 - 4 * 8 * 60);
  });
  it('exposes absent pay settings as blocked and incomplete totals', async () => {
    seedEmployee(); state.rows.employee_payroll_settings = [];
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.totalsComplete).toBe(false); expect(result.data.employees[0].calculationReady).toBe(false);
    expect(result.data.employees[0].blockers.join(' ')).toContain('Vergütung fehlt');
  });
  it('keeps valid zero-hour payout limits rather than treating them as unlimited', async () => {
    seedEmployee(); seedAccount(); state.rows.employee_payroll_settings[0].max_payout_hours_month = 0;
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.employees[0].calculationReady).toBe(true); expect(result.data.employees[0].earnedGrossCents).toBe(0);
    expect(result.data.employees[0].overtimeTransferMinutes).toBe(120);
  });
  it('retains archived employees with existing statements and exposes all versions', async () => {
    seedEmployee('e1', { status: 'archiviert', exit_date: '2026-09-30' });
    state.rows.payroll_month_statements = [3, 2, 1].map(version => ({ id: `s${version}`, tenant_id: 'tenant-1', employee_id: 'e1', period_year: 2026, period_month: 10, version, status: version === 3 ? 'published' : 'superseded', snapshot_json: {}, created_at: '2026-10-18T09:00:00Z' }));
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.employees).toHaveLength(1); expect(result.data.employees[0].statementHistory).toHaveLength(3);
    expect(result.data.employees[0].latestStatement?.id).toBe('s3');
  });
  it('blocks publication for unapproved time without hiding the captured provisional amount', async () => {
    seedEmployee(); seedAccount('pending_review');
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.employees[0].calculationReady).toBe(true); expect(result.data.employees[0].actualWorkMinutes).toBe(120);
    expect(result.data.employees[0].blockers.join(' ')).toContain('nicht freigegeben');
  });
  it('reads pages beyond the server row limit', async () => {
    for (let index = 0; index < 501; index += 1) seedEmployee(`e${index}`);
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.employees).toHaveLength(501); expect(state.reads).toContain('employees:500'); expect(state.reads).toContain('employee_payroll_settings:500');
  });
  it('fails completely when a required second page fails', async () => {
    for (let index = 0; index < 501; index += 1) seedEmployee(`e${index}`);
    state.errors['employees:500'] = { message: 'Seite fehlgeschlagen' };
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(false); if (result.ok) return; expect(result.error).toContain('Seite fehlgeschlagen');
  });
  it('does not conceal an upload read failure as no pending receipts', async () => {
    seedEmployee(); state.errors.portal_uploads = { message: 'Belege nicht erreichbar' };
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(false); if (result.ok) return; expect(result.error).toContain('Belege nicht erreichbar');
  });
  it('retains pending receipts uploaded outside the payroll month', async () => {
    seedEmployee(); state.rows.portal_uploads = [{ id: 'u1', tenant_id: 'tenant-1', employee_id: 'e1', file_name: 'beleg.pdf', storage_path: 'tenant-1/u1.pdf', status: 'hochgeladen', created_at: '2026-09-20T10:00:00Z' }];
    const result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return; expect(result.data.employees[0].pendingPortalUploads[0]?.id).toBe('u1');
  });
  it('rejects cross-tenant rows and duplicate settings', async () => {
    seedEmployee(); state.rows.employee_payroll_settings[0].tenant_id = 'tenant-2';
    expect((await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin')).ok).toBe(false);
    state.rows.employee_payroll_settings[0].tenant_id = 'tenant-1'; state.rows.employee_payroll_settings.push({ ...state.rows.employee_payroll_settings[0] });
    expect((await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin')).ok).toBe(false);
  });
  it('propagates WFM errors and does not fabricate empty time accounts', async () => {
    seedEmployee(); state.accountError = 'Arbeitszeit unvollständig';
    expect(await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin')).toEqual({ ok: false, error: 'Arbeitszeit unvollständig' });
  });
  it('denies malformed periods, unavailable connections and unauthorized scope before returning data', async () => {
    expect((await listPayrollMonthOverview('tenant-1', 2026, 0, 'business_admin')).ok).toBe(false); expect(state.reads).toEqual([]);
    expect((await listPayrollMonthOverview('tenant-1', 2100, 12, 'business_admin')).ok).toBe(true); state.reads = [];
    state.denied = true; expect((await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin')).ok).toBe(false); expect(state.reads).toEqual([]);
    state.denied = false; state.tenantDenied = true; expect((await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin')).ok).toBe(false); expect(state.reads).toEqual([]);
    state.tenantDenied = false; state.connected = false; expect((await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin')).ok).toBe(false); expect(state.reads).toEqual([]);
  });
  it('hides incomplete financial amounts when accounts or closed captures are missing', async () => {
    seedEmployee();
    let result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.employees[0].calculationReady).toBe(false); expect(result.data.totalsComplete).toBe(false);
    seedAccount(); state.accounts[0].entries[0].actualEndAt = null;
    result = await listPayrollMonthOverview('tenant-1', 2026, 10, 'business_admin');
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.employees[0].calculationReady).toBe(false); expect(result.data.totalsComplete).toBe(false);
  });

});
