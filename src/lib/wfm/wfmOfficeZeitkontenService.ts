import { calculateOfficeLogbookTime, officeAbsenceMinutes } from './wfmOfficeLinkedTotals';
import { isLogbookTripInBerlinRange } from '@/lib/employeeLogbook/employeeLogbookDate';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { RoleKey, ServiceResult } from '@/types';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isOpenReviewStatus } from './wfmTimeReviewService';
import { resolveWfmOfficeTimeDisplay } from './wfmOfficeTimeDisplayResolver';
import { getWfmOfficeTimeOverview } from './wfmOfficeTimekeepingService';

type Row = Record<string, unknown>;

const numberValue = (value: unknown): number =>
  (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value))
    ? Number(value)
    : 0;
const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';

const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function calculateContractTargetMinutesForRange(
  workDays: unknown,
  fromDate: string,
  toDate: string,
): number {
  if (!workDays || typeof workDays !== 'object') return 0;
  const schedule = workDays as Record<string, unknown>;
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return 0;

  let targetMinutes = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const hours = numberValue(schedule[weekdayKeys[cursor.getUTCDay()]]);
    if (hours > 0) {
      targetMinutes += Math.round(hours * 60);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return targetMinutes;
}

function monthKey(year: number, month: number): number {
  return year * 12 + month;
}

export async function getWfmOfficeEmployeeTimeAccounts(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  options?: {
    preset?: import('@/types/modules/wfmOfficeTimekeeping').WfmOfficePeriodPreset;
    fromDate?: string | null;
    toDate?: string | null;
    employeeId?: string | null;
  },
): Promise<ServiceResult<WfmOfficeEmployeeTimeAccount[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const overview = await getWfmOfficeTimeOverview(tenantId, actorRoleKey, {
    preset: options?.preset ?? 'this_month',
    fromDate: options?.fromDate,
    toDate: options?.toDate,
    filters: options?.employeeId ? { employeeIds: [options.employeeId] } : undefined,
  });
  if (!overview.ok) return overview;

  const byEmployee = new Map<string, WfmOfficeEmployeeTimeAccount>();

  // A time account belongs to every employee, not only to employees for whom
  // the selected period already contains a booking or assignment.
  for (const employee of overview.data.employees) {
    byEmployee.set(employee.id, {
      employeeId: employee.id,
      employeeName: employee.name,
      plannedMinutes: 0,
      actualMinutes: 0,
      approvedMinutes: 0,
      exportedMinutes: 0,
      saldoMinutes: 0,
      openReviewCount: 0,
      targetMinutes: 0,
      overtimeMinutes: 0,
      undertimeMinutes: 0,
      travelMinutes: 0,
      absenceMinutes: 0,
      vacationDaysUsed: 0,
      sickDays: 0,
      annualVacationDays: null,
      remainingVacationDays: null,
      payrollStatements: [],
      entries: [],
    });
  }

  for (const entry of overview.data.entries) {
    const display = resolveWfmOfficeTimeDisplay(entry);
    const bucket =
      byEmployee.get(entry.employeeId) ??
      ({
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        plannedMinutes: 0,
        actualMinutes: 0,
        approvedMinutes: 0,
        exportedMinutes: 0,
        saldoMinutes: 0,
        openReviewCount: 0,
        targetMinutes: 0,
        overtimeMinutes: 0,
        undertimeMinutes: 0,
        travelMinutes: 0,
        absenceMinutes: 0,
        vacationDaysUsed: 0,
        sickDays: 0,
        annualVacationDays: null,
        remainingVacationDays: null,
        payrollStatements: [],
        entries: [],
      } satisfies WfmOfficeEmployeeTimeAccount);

    bucket.plannedMinutes += display.plannedDurationMinutes;
    if (display.hasTimeEntry) bucket.actualMinutes += display.timeEntryDurationMinutes;
    if (entry.reviewStatus === 'approved') bucket.approvedMinutes += display.timeEntryDurationMinutes;
    if (entry.exportStatus === 'exported') bucket.exportedMinutes += display.timeEntryDurationMinutes;
    if (isOpenReviewStatus(entry.reviewStatus)) bucket.openReviewCount += 1;
    bucket.entries.push(entry);
    byEmployee.set(entry.employeeId, bucket);
  }

  if (getServiceMode() === 'supabase' && byEmployee.size > 0) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const employeeIds = [...byEmployee.keys()];
      const [accountResult, contractResult, statementResult, absenceResult, tripResult] = await Promise.all([
        fromUnknownTable(supabase, 'workforce_time_accounts')
          .select(
            'employee_id, period_year, period_month, target_minutes, actual_minutes, overtime_minutes, undertime_minutes, travel_minutes, absence_minutes, vacation_days_used, sick_days',
          )
          .eq('tenant_id', tenantId)
          .in('employee_id', employeeIds),
        fromUnknownTable(supabase, 'employee_contract_settings')
          .select('employee_id, annual_vacation_days, work_days')
          .eq('tenant_id', tenantId)
          .in('employee_id', employeeIds),
        fromUnknownTable(supabase, 'payroll_month_statements')
          .select('id, employee_id, period_year, period_month, version, status, pdf_path, created_at')
          .eq('tenant_id', tenantId)
          .in('employee_id', employeeIds)
          .order('period_year', { ascending: false })
          .order('period_month', { ascending: false })
          .order('version', { ascending: false }),
        fromUnknownTable(supabase, 'workforce_absences').select('employee_id, absence_type, status, starts_at, ends_at')
          .eq('tenant_id', tenantId).in('employee_id', employeeIds)
          .lte('starts_at', `${overview.data.period.toDate}T23:59:59`).gte('ends_at', `${overview.data.period.fromDate}T00:00:00`),
        // Page through the period: Supabase's default result limit must not truncate large teams.
        (async () => {
          const rows: Row[] = [];
          const { fromDate, toDate } = overview.data.period;
          const lower = new Date(`${fromDate}T00:00:00Z`); lower.setUTCDate(lower.getUTCDate() - 1);
          for (let offset = 0; ; offset += 500) {
            const result = await fromUnknownTable(supabase, 'employee_logbook_trips')
              .select('id, employee_id, started_at, ended_at, status, counts_as_work_time')
              .eq('tenant_id', tenantId).in('employee_id', employeeIds)
              .gte('started_at', lower.toISOString()).lte('started_at', `${toDate}T23:59:59Z`)
              .order('started_at').order('id').range(offset, offset + 499);
            if (result.error) return result;
            const page = (result.data ?? []) as Row[]; rows.push(...page);
            if (page.length < 500) return { data: rows, error: null };
          }
        })(),
      ]);
      const sourceError = [accountResult, contractResult, statementResult, absenceResult, tripResult].find(result => result.error)?.error;
      if (sourceError) return { ok: false, error: toGermanSupabaseError(sourceError) };

      const from = new Date(`${overview.data.period.fromDate}T00:00:00`);
      const to = new Date(`${overview.data.period.toDate}T23:59:59`);
      const fromMonth = monthKey(from.getFullYear(), from.getMonth() + 1);
      const toMonth = monthKey(to.getFullYear(), to.getMonth() + 1);
      const vacationYears = new Set<number>();
      for (let year = from.getFullYear(); year <= to.getFullYear(); year += 1) vacationYears.add(year);

      if (!accountResult.error) {
        for (const row of (accountResult.data ?? []) as Row[]) {
          const employeeId = stringValue(row.employee_id);
          const account = byEmployee.get(employeeId);
          if (!account) continue;
          const year = numberValue(row.period_year);
          const month = numberValue(row.period_month);
          const key = monthKey(year, month);
          if (vacationYears.has(year)) {
            account.vacationDaysUsed += numberValue(row.vacation_days_used);
            account.sickDays += numberValue(row.sick_days);
          }
          if (key < fromMonth || key > toMonth) continue;
          const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
          const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
          if (monthStart >= overview.data.period.fromDate && monthEnd <= overview.data.period.toDate) account.targetMinutes += numberValue(row.target_minutes);
          account.overtimeMinutes += numberValue(row.overtime_minutes);
          account.undertimeMinutes += numberValue(row.undertime_minutes);

        }
      }

      if (!contractResult.error) {
        for (const row of (contractResult.data ?? []) as Row[]) {
          const account = byEmployee.get(stringValue(row.employee_id));
          if (!account) continue;
          if (row.annual_vacation_days != null) {
            account.annualVacationDays = numberValue(row.annual_vacation_days);
          }
          const contractTarget = calculateContractTargetMinutesForRange(
            row.work_days,
            overview.data.period.fromDate,
            overview.data.period.toDate,
          );
          if (row.work_days && typeof row.work_days === 'object') account.targetMinutes = contractTarget;
          account.absenceMinutes = ((absenceResult.data ?? []) as Row[])
            .filter(absence => stringValue(absence.employee_id) === account.employeeId)
            .reduce((sum, absence) => sum + officeAbsenceMinutes(absence, row.work_days, overview.data.period.fromDate, overview.data.period.toDate), 0);
        }
      }

      for (const account of byEmployee.values()) {
        const trips = ((tripResult.data ?? []) as Row[]).filter(trip => stringValue(trip.employee_id) === account.employeeId
          && isLogbookTripInBerlinRange(stringValue(trip.started_at), overview.data.period.fromDate, overview.data.period.toDate));
        const totals = calculateOfficeLogbookTime(trips.map(trip => ({ started_at: trip.started_at, ended_at: trip.ended_at, status: trip.status, counts_as_work_time: trip.counts_as_work_time })), account.entries);
        account.travelMinutes = totals.travelMinutes;
        account.actualMinutes += totals.additionalMinutes;
        account.logbookAdditionalMinutes = totals.additionalMinutes;
      }

      if (!statementResult.error) {
        for (const row of (statementResult.data ?? []) as Row[]) {
          const account = byEmployee.get(stringValue(row.employee_id));
          if (!account) continue;
          account.payrollStatements.push({
            id: stringValue(row.id),
            periodYear: numberValue(row.period_year),
            periodMonth: numberValue(row.period_month),
            version: numberValue(row.version),
            status: stringValue(row.status),
            pdfPath: stringValue(row.pdf_path) || null,
            createdAt: stringValue(row.created_at),
          });
        }
      }
    }
  }

  const accounts = [...byEmployee.values()].map((account) => {
    const effectiveTargetMinutes = account.targetMinutes || account.plannedMinutes;
    const creditedMinutes = account.actualMinutes + account.absenceMinutes;
    const saldoMinutes = creditedMinutes - effectiveTargetMinutes;
    return {
      ...account,
      targetMinutes: effectiveTargetMinutes,
      overtimeMinutes: Math.max(0, saldoMinutes),
      undertimeMinutes: Math.max(0, -saldoMinutes),
      saldoMinutes,
      remainingVacationDays:
        account.annualVacationDays == null
          ? null
          : account.annualVacationDays - account.vacationDaysUsed,
      entries: account.entries.sort((a, b) => b.workDate.localeCompare(a.workDate)),
    };
  });

  accounts.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'));
  return { ok: true, data: accounts };
}

export function summarizeOfficeTimeAccountKpis(accounts: WfmOfficeEmployeeTimeAccount[]): {
  employees: number;
  plannedHours: number;
  actualHours: number;
  approvedHours: number;
  exportedHours: number;
  openReviews: number;
} {
  const sum = (pick: (a: WfmOfficeEmployeeTimeAccount) => number) =>
    accounts.reduce((acc, row) => acc + pick(row), 0);
  return {
    employees: accounts.length,
    plannedHours: Math.round((sum((a) => a.plannedMinutes) / 60) * 10) / 10,
    actualHours: Math.round((sum((a) => a.actualMinutes) / 60) * 10) / 10,
    approvedHours: Math.round((sum((a) => a.approvedMinutes) / 60) * 10) / 10,
    exportedHours: Math.round((sum((a) => a.exportedMinutes) / 60) * 10) / 10,
    openReviews: sum((a) => a.openReviewCount),
  };
}

export function listOpenReviewEntriesForEmployee(
  account: WfmOfficeEmployeeTimeAccount,
): WfmOfficeTimeEntry[] {
  return account.entries.filter((entry) => isOpenReviewStatus(entry.reviewStatus));
}
