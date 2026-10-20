import type { PayrollAssignmentTimeLine, PayrollEmployeeMonth, PayrollMonthOverview, PayrollStatement } from '@/types/modules/payrollMonth';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficePlannedVisit, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { calculateOfficeAbsenceCredit, hasOfficeContractSchedule, officeAccountRecordedMinutes } from '@/lib/wfm/wfmOfficeAccountTotals';

export type PayrollOfficePreviewAvailability = {
  compensationAvailable: boolean;
  actualTimeAvailable: boolean;
  grossAvailable: boolean;
  expensesAvailable: boolean;
  timeAccountAvailable: boolean;
  absenceAvailable: boolean;
  provisional: boolean;
  notes: string[];
};
export type PayrollOfficeEmployeeMonth = PayrollEmployeeMonth & {
  /** Full calculation readiness; independently available preview fields use preview flags. */
  calculationReady: boolean;
  preview: PayrollOfficePreviewAvailability;
  blockers: string[];
  warnings: string[];
  unapprovedEntryCount: number;
  employmentStatus: string;
  statementHistory: PayrollStatement[];
  projectedPaidAbsenceMinutes?: number;
  reimbursedExpensesCents?: number;
};
export type PayrollOfficeMonthOverview = Omit<PayrollMonthOverview, 'employees'> & {
  employees: PayrollOfficeEmployeeMonth[];
  totalsComplete: boolean;
  previewCounts: { gross: number; expenses: number; timeAccounts: number; total: number };
};
export type PayrollRow = Record<string, unknown>;
const text = (value: unknown): string => typeof value === 'string' ? value : '';
export function payrollNumber(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
export function isPayrollDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function payrollPeriodRange(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('Bitte einen gültigen Abrechnungsmonat auswählen.');
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return { fromDate: `${key}-01`, toDate: `${key}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}` };
}
export function payrollBerlinDay(now: number | Date = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function nextPayrollDay(day: string): string {
  const value = new Date(`${day}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10);
}
export function payrollBerlinMidnight(day: string): string {
  const utc = Date.parse(`${day}T00:00:00Z`);
  const hours = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(utc));
  return new Date(utc - hours * 3_600_000).toISOString();
}
export function payrollEmploymentRange(employee: PayrollRow, fromDate: string, toDate: string) {
  const entry = isPayrollDate(employee.entry_date) ? employee.entry_date : null;
  const exit = isPayrollDate(employee.exit_date) ? employee.exit_date : null;
  return { fromDate: entry && entry > fromDate ? entry : fromDate, toDate: exit && exit < toDate ? exit : toDate };
}
export function isPayrollEmployeeInPeriod(employee: PayrollRow, fromDate: string, toDate: string, hasPeriodEvidence: boolean): boolean {
  if (hasPeriodEvidence) return true;
  const range = payrollEmploymentRange(employee, fromDate, toDate);
  if (range.fromDate > range.toDate) return false;
  const status = text(employee.status).trim().toLowerCase();
  if (['archiviert', 'ausgeschieden', 'terminated', 'inactive', 'deleted', 'gesperrt', 'deactivated'].includes(status)) {
    return isPayrollDate(employee.exit_date) && employee.exit_date >= fromDate;
  }
  return true;
}
export function payrollSettingsIssues(payroll: PayrollRow | undefined): string[] {
  if (!payroll) return ['Vergütung fehlt in der Personalakte.'];
  const issues: string[] = [];
  if (payroll.compensation_type !== 'hourly' && payroll.compensation_type !== 'salary') issues.push('Die Vergütungsart ist nicht eindeutig festgelegt.');
  const amount = payrollNumber(payroll.compensation_amount);
  if (amount == null || amount <= 0) issues.push('Ein gültiger Stundenlohn oder Monatslohn fehlt.');
  if (payroll.max_payout_hours_month != null) {
    const cap = payrollNumber(payroll.max_payout_hours_month);
    if (cap == null || cap < 0) issues.push('Die hinterlegte Auszahlungsgrenze ist ungültig.');
  }
  if (payroll.overflow_to_time_account != null && typeof payroll.overflow_to_time_account !== 'boolean') issues.push('Die Regel zur Übertragung auf das Zeitkonto ist ungültig.');
  return issues;
}
const conducted = new Set(['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen', 'finished', 'documentation_open', 'signature_open', 'completed']);
export function isPayrollConductedAssignmentStatus(status: string | null | undefined): boolean { return conducted.has((status ?? '').trim().toLowerCase()); }
function minutesBetween(start: string | null | undefined, end: string | null | undefined): number {
  const duration = Date.parse(end ?? '') - Date.parse(start ?? '');
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration / 60_000) : 0;
}
/** A completion label alone is no proof of payable working time. */
export function resolvePayrollPerformedMinutes(input: { status: string | null | undefined; explicitMinutes?: number | null; actualStartAt?: string | null; actualEndAt?: string | null; plannedMinutes: number }): number {
  if (input.explicitMinutes != null && Number.isFinite(input.explicitMinutes)) return Math.max(0, Math.round(input.explicitMinutes));
  return minutesBetween(input.actualStartAt, input.actualEndAt);
}
function plannedDuration(visit: WfmOfficePlannedVisit): number {
  const saved = visit.plannedDurationMinutes;
  return saved != null && Number.isFinite(saved) && saved >= 0 ? Math.round(saved) : minutesBetween(visit.plannedStartAt, visit.plannedEndAt);
}
export function payrollPlannedVisitLine(visit: WfmOfficePlannedVisit): PayrollAssignmentTimeLine {
  const plannedMinutes = plannedDuration(visit);
  const actualMinutes = resolvePayrollPerformedMinutes({ status: visit.assignmentStatus, actualStartAt: visit.assignmentActualStartAt, actualEndAt: visit.assignmentActualEndAt, plannedMinutes });
  return { assignmentId: visit.assignmentId, workDate: visit.workDate, clientLabel: visit.clientLabel,
    assignmentTitle: visit.assignmentTitle?.trim() || 'Einsatz', plannedStartAt: visit.plannedStartAt, plannedEndAt: visit.plannedEndAt,
    actualStartAt: visit.assignmentActualStartAt ?? null, actualEndAt: visit.assignmentActualEndAt ?? null,
    plannedMinutes, actualMinutes, travelMinutes: 0, differenceMinutes: actualMinutes - plannedMinutes, status: visit.assignmentStatus };
}
function sameInstant(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && Number.isFinite(Date.parse(left)) && Date.parse(left) === Date.parse(right));
}
/** Occurrence identity includes date and start; repeated series IDs must never overwrite another day. */
export function employeeAssignmentTimeLines(account: WfmOfficeEmployeeTimeAccount | undefined, visits: WfmOfficePlannedVisit[], employeeId: string): PayrollAssignmentTimeLine[] {
  const lines = visits.filter(visit => visit.employeeId === employeeId).map(visit => ({ visit, line: payrollPlannedVisitLine(visit), claimed: false }));
  const extra: PayrollAssignmentTimeLine[] = [];
  for (const entry of account?.entries ?? []) {
    if (entry.employeeId !== employeeId) continue;
    const candidates = lines.filter(item => !item.claimed && item.line.workDate === entry.workDate && (
      (entry.visitId && (item.visit.visitId === entry.visitId || item.visit.assignmentId === entry.visitId)) ||
      (entry.assignmentId && (item.visit.assignmentId === entry.assignmentId || item.visit.visitId === entry.assignmentId))
    ));
    // Some legacy rows lack a visit ID. Only use a unique match with the same client and range.
    const orphan = !entry.assignmentId && !entry.visitId && entry.clientLabel
      ? lines.filter(item => !item.claimed && item.line.workDate === entry.workDate && item.line.clientLabel === entry.clientLabel
        && sameInstant(item.line.plannedStartAt, entry.plannedStartAt) && sameInstant(item.line.plannedEndAt, entry.plannedEndAt)) : [];
    const exact = candidates.filter(item => sameInstant(item.line.plannedStartAt, entry.plannedStartAt));
    const match = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : orphan.length === 1 ? orphan[0] : undefined;
    const existing = match?.line;
    const plannedMinutes = existing?.plannedMinutes ?? entry.plannedDurationMinutes ?? minutesBetween(entry.plannedStartAt, entry.plannedEndAt);
    const actualStartAt = entry.actualStartAt ?? entry.assignmentActualStartAt ?? existing?.actualStartAt ?? null;
    const actualEndAt = entry.actualEndAt ?? entry.assignmentActualEndAt ?? existing?.actualEndAt ?? null;
    const actualMinutes = entry.reviewStatus === 'rejected' ? 0 : entry.actualStartAt || entry.actualEndAt
      ? officeAccountRecordedMinutes(entry) : resolvePayrollPerformedMinutes({ status: entry.assignmentStatus, actualStartAt, actualEndAt, plannedMinutes });
    const line: PayrollAssignmentTimeLine = { assignmentId: entry.assignmentId ?? existing?.assignmentId ?? null, workDate: entry.workDate,
      clientLabel: entry.clientLabel ?? existing?.clientLabel ?? null, assignmentTitle: entry.assignmentTitle?.trim() || existing?.assignmentTitle || 'Arbeitszeit',
      plannedStartAt: entry.plannedStartAt ?? existing?.plannedStartAt ?? null, plannedEndAt: entry.plannedEndAt ?? existing?.plannedEndAt ?? null,
      actualStartAt, actualEndAt, plannedMinutes: Math.max(0, plannedMinutes), actualMinutes,
      travelMinutes: Math.max(0, entry.travelMinutes ?? 0), differenceMinutes: actualMinutes - plannedMinutes,
      status: entry.reviewStatus === 'rejected' ? 'rejected' : entry.assignmentStatus ?? existing?.status ?? entry.reviewStatus };
    if (match) { match.line = line; match.claimed = true; } else extra.push(line);
  }
  return [...lines.map(item => item.line), ...extra].sort((a, b) => a.workDate.localeCompare(b.workDate) || (a.plannedStartAt ?? a.actualStartAt ?? '').localeCompare(b.plannedStartAt ?? b.actualStartAt ?? ''));
}
export function payrollRemainingPlannedMinutes(visits: WfmOfficePlannedVisit[], account: WfmOfficeEmployeeTimeAccount | undefined, employeeId: string, now: number): number {
  return visits.filter(visit => visit.employeeId === employeeId).reduce((sum, visit) => {
    if (!visit.plannedStartAt || Date.parse(visit.plannedStartAt) <= now || visit.assignmentActualStartAt || visit.assignmentActualEndAt || isPayrollConductedAssignmentStatus(visit.assignmentStatus)) return sum;
    const recorded = account?.entries.some(entry => entry.workDate === visit.workDate
      && ((Boolean(entry.assignmentId) && entry.assignmentId === visit.assignmentId) || (Boolean(entry.visitId) && entry.visitId === visit.visitId))
      && (!entry.plannedStartAt || sameInstant(entry.plannedStartAt, visit.plannedStartAt)) && Boolean(entry.actualStartAt || entry.actualEndAt));
    return recorded ? sum : sum + plannedDuration(visit);
  }, 0);
}
function absenceKind(row: PayrollRow): 'vacation' | 'sick' | 'other' {
  return row.absence_type === 'vacation' ? 'vacation' : ['sick_leave', 'child_sick_leave'].includes(text(row.absence_type)) ? 'sick' : 'other';
}
export function payrollAbsenceCredits(rows: PayrollRow[], workDays: unknown, fromDate: string, toDate: string) {
  if (fromDate > toDate || !hasOfficeContractSchedule(workDays)) return { vacationMinutes: 0, sickMinutes: 0, otherPaidAbsenceMinutes: 0, totalMinutes: 0, overlap: false };
  const vacation = rows.filter(row => absenceKind(row) === 'vacation');
  const sick = rows.filter(row => absenceKind(row) === 'sick');
  const other = rows.filter(row => absenceKind(row) === 'other');
  const vacationMinutes = calculateOfficeAbsenceCredit(vacation, workDays, fromDate, toDate);
  const sickMinutes = calculateOfficeAbsenceCredit(sick, workDays, fromDate, toDate);
  const otherPaidAbsenceMinutes = calculateOfficeAbsenceCredit(other, workDays, fromDate, toDate);
  const totalMinutes = calculateOfficeAbsenceCredit(rows, workDays, fromDate, toDate);
  return { vacationMinutes, sickMinutes, otherPaidAbsenceMinutes, totalMinutes, overlap: vacationMinutes + sickMinutes + otherPaidAbsenceMinutes > totalMinutes };
}
export function payrollTimeReadiness(account: WfmOfficeEmployeeTimeAccount | undefined, now: number) {
  const blockers: string[] = [];
  const calculationIssues: string[] = [];
  const entries = account?.entries ?? [];
  if (!account) calculationIssues.push('Für diesen Monat konnte kein vollständiges Arbeitszeitkonto zugeordnet werden.');
  if (account && (!Number.isFinite(account.actualMinutes) || account.actualMinutes < 0 || !Number.isFinite(account.travelMinutes ?? 0))) calculationIssues.push('Das Arbeitszeitkonto enthält ungültige Zeitwerte.');
  const recorded = entries.filter(entry => Boolean(entry.actualStartAt || entry.actualEndAt));
  const unapproved = recorded.filter(entry => !['approved', 'exported', 'locked', 'rejected'].includes(entry.reviewStatus));
  if (unapproved.length) blockers.push(`${unapproved.length} Zeiterfassung${unapproved.length === 1 ? '' : 'en'} noch nicht freigegeben.`);
  const incomplete = recorded.filter(entry => {
    const start = Date.parse(entry.actualStartAt ?? ''), end = Date.parse(entry.actualEndAt ?? '');
    return !Number.isFinite(start) || !Number.isFinite(end) || end < start || end > now || start > now
      || !Number.isFinite(entry.netMinutes) || entry.netMinutes < 0 || !Number.isFinite(entry.pauseMinutes) || entry.pauseMinutes < 0;
  });
  if (incomplete.length) calculationIssues.push(`${incomplete.length} Zeiterfassung${incomplete.length === 1 ? '' : 'en'} ohne gültigen Abschluss.`);
  const missing = entries.filter(entry => entry.rowKind === 'planned_missing_actual' && !entry.actualStartAt && !entry.actualEndAt);
  if (missing.length) calculationIssues.push(`${missing.length} vergangene Einsätze ohne abgeschlossene Zeiterfassung.`);
  const rejected = recorded.filter(entry => entry.reviewStatus === 'rejected');
  if (rejected.length) calculationIssues.push(`${rejected.length} abgelehnte Zeiterfassung${rejected.length === 1 ? '' : 'en'} klären; diese Zeit ist nicht eingerechnet.`);
  const excluded = new Set<WfmOfficeTimeEntry>([...rejected, ...incomplete]);
  const excludedMinutes = [...excluded].reduce((sum, entry) => sum + officeAccountRecordedMinutes(entry), 0);
  const actual = account?.actualMinutes;
  return { blockers: [...blockers, ...calculationIssues], calculationIssues, unapprovedEntryCount: unapproved.length + missing.length + rejected.length,
    actualWorkMinutes: actual != null && Number.isFinite(actual) ? Math.max(0, actual - excludedMinutes) : 0 };
}

/** Paid leave and work on the same interval need a human correction before financial totals are reliable. */
export function payrollAbsenceWorkConflicts(absences: PayrollRow[], lines: PayrollAssignmentTimeLine[]): boolean {
  const paid = absences.filter(row => ['approved', 'active', 'completed'].includes(text(row.status)) && !['unpaid_leave', 'parental_leave'].includes(text(row.absence_type)));
  return lines.some(line => line.status !== 'rejected' && paid.some(absence => {
    if (absence.all_day !== false) {
      const from = text(absence.starts_at).slice(0, 10), to = text(absence.ends_at).slice(0, 10);
      return isPayrollDate(from) && isPayrollDate(to) && from <= line.workDate && to >= line.workDate
        && (line.actualMinutes > 0 || line.plannedMinutes > 0);
    }
    const start = Date.parse(text(absence.starts_at)), end = Date.parse(text(absence.ends_at));
    return [[line.actualStartAt, line.actualEndAt], [line.plannedStartAt, line.plannedEndAt]].some(([a, b]) => {
      const workStart = Date.parse(a ?? ''), workEnd = Date.parse(b ?? '');
      return Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(workStart) && Number.isFinite(workEnd)
        && Math.max(start, workStart) < Math.min(end, workEnd);
    });
  }));
}
