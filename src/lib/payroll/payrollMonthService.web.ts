import type { RoleKey, ServiceResult } from '@/types';
import type { PayrollExpenseClaim, ExpenseClaimStatus, PayrollPortalUpload, PayrollStatement, PayrollStatementSnapshot, PayrollAssignmentTimeLine } from '@/types/modules/payrollMonth';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficePlannedVisit } from '@/types/modules/wfmOfficeTimekeeping';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { readAllOfficeAccountRows, hasOfficeContractSchedule } from '@/lib/wfm/wfmOfficeAccountTotals';
import { calculateContractTargetMinutesForRange } from '@/lib/wfm/wfmContractTarget';
import { miniJobAccountBasisMinutes } from '@/lib/wfm/wfmMiniJobAccountBasis.web';
import { listPlannedVisitsForPeriod } from '@/lib/wfm/wfmOfficePlannedVisitRepository.web';
import { getWfmOfficeEmployeeTimeAccounts } from '@/lib/wfm/wfmOfficeZeitkontenService.web';
import { calculatePayrollSnapshot, calculatePayrollTimeAccountBalance, payrollExpenseTotals } from './payrollCalculator.web';
import { isMiniJobEmploymentType, resolvePayrollMaxPayoutHours } from './payrollPayoutPolicy.web';
import { deferredPayrollEntry, matchDeferredPayrollEntry, payrollPeriodNumber, payrollTimeRegistry, resolvePayrollCatchUp, type PayrollTimeRegistry } from './payrollTimeDeferral.web';
import { employeeAssignmentTimeLines, isPayrollConductedAssignmentStatus, isPayrollEmployeeInPeriod, payrollAbsenceCredits, payrollAbsenceWorkConflicts, payrollBerlinDay, payrollDeferredReason, payrollEmploymentRange, isPayrollDate, payrollNumber, payrollPeriodRange, payrollPlannedVisitLine, payrollRemainingPlannedMinutes, payrollSettingsIssues, payrollTimeReadiness, nextPayrollDay, type PayrollOfficeEmployeeMonth, type PayrollOfficeMonthOverview, type PayrollRow } from './payrollOfficeReadModel.web';

// Metro resolves this module for the employee portal too. Keep its established, independently secured APIs.
export { loadEmployeePayrollMonth, decidePayrollStatement, createExpenseClaim, uploadExpenseReceipt, getPayrollPdfUrl } from './payrollMonthService.ts';
export { publishPayrollStatement, reviewExpenseClaim } from './payrollOfficeActions.web';
export { isMiniJobEmploymentType, resolvePayrollMaxPayoutHours } from './payrollPayoutPolicy.web';
export { employeeAssignmentTimeLines, resolvePayrollPerformedMinutes, isPayrollConductedAssignmentStatus } from './payrollOfficeReadModel.web';
export type { PayrollOfficeEmployeeMonth, PayrollOfficeMonthOverview } from './payrollOfficeReadModel.web';
type Row = PayrollRow;
const asString = (value: unknown): string => typeof value === 'string' ? value : '';
const asNullableString = (value: unknown): string | null => asString(value).trim() || null;
const asNumber = (value: unknown): number => payrollNumber(value) ?? 0;
export function mapPayrollOfficeExpense(row: Row): PayrollExpenseClaim {
  return {
    id: asString(row.id), tenantId: asString(row.tenant_id), employeeId: asString(row.employee_id),
    expenseDate: asString(row.expense_date), category: asString(row.category) as PayrollExpenseClaim['category'],
    description: asString(row.description), amountCents: asNumber(row.amount_cents),
    approvedAmountCents: row.approved_amount_cents == null ? null : asNumber(row.approved_amount_cents),
    currency: asString(row.currency) || 'EUR', assignmentId: asNullableString(row.assignment_id),
    clientId: asNullableString(row.client_id), paymentMethod: asNullableString(row.payment_method),
    receiptNumber: asNullableString(row.receipt_number), receiptPath: asNullableString(row.receipt_path),
    mileageKm: row.mileage_km == null ? null : asNumber(row.mileage_km),
    mileageRateCents: row.mileage_rate_cents == null ? null : asNumber(row.mileage_rate_cents),
    origin: asNullableString(row.origin), destination: asNullableString(row.destination),
    vehicleLabel: asNullableString(row.vehicle_label), businessPurpose: asString(row.business_purpose),
    drivingLogId: asNullableString(row.driving_log_id),
    travelType: asNullableString(row.travel_type) as PayrollExpenseClaim['travelType'],
    automaticSource: row.automatic_source === true,
    taxTreatment: (asString(row.tax_treatment) || 'review') as PayrollExpenseClaim['taxTreatment'],
    status: (asString(row.status) || 'draft') as ExpenseClaimStatus,
    officeNote: asNullableString(row.office_note), rejectionReason: asNullableString(row.rejection_reason),
    submittedAt: asNullableString(row.submitted_at), reviewedAt: asNullableString(row.reviewed_at),
    createdAt: asString(row.created_at), updatedAt: asString(row.updated_at),
  };
}

export function mapPayrollOfficeStatement(row: Row): PayrollStatement {
  return {
    id: asString(row.id), tenantId: asString(row.tenant_id), employeeId: asString(row.employee_id),
    periodYear: asNumber(row.period_year), periodMonth: asNumber(row.period_month), version: asNumber(row.version),
    status: asString(row.status) as PayrollStatement['status'],
    snapshot: (row.snapshot_json ?? {}) as PayrollStatementSnapshot,
    pdfPath: asNullableString(row.pdf_path), pdfSha256: asNullableString(row.pdf_sha256),
    employeeDecisionReason: asNullableString(row.employee_decision_reason),
    publishedAt: asNullableString(row.published_at), confirmedAt: asNullableString(row.confirmed_at),
    rejectedAt: asNullableString(row.rejected_at), lockedAt: asNullableString(row.locked_at),
    createdAt: asString(row.created_at), updatedAt: asString(row.updated_at),
  };
}

export function mapPayrollPortalUpload(row: Row): PayrollPortalUpload {
  return {
    id: asString(row.id),
    employeeId: asString(row.employee_id),
    fileName: asString(row.file_name),
    storagePath: asString(row.storage_path),
    category: asNullableString(row.category),
    status: (asString(row.status) || 'hochgeladen') as PayrollPortalUpload['status'],
    createdAt: asString(row.created_at),
  };
}







function nextMonthPreviewForEmployee(visits: WfmOfficePlannedVisit[], employeeId: string, year: number, month: number) {
  const assignments = visits.filter(visit => visit.employeeId === employeeId).map(payrollPlannedVisitLine)
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || (a.plannedStartAt ?? '').localeCompare(b.plannedStartAt ?? ''));
  return { periodYear: year, periodMonth: month, totalPlannedMinutes: assignments.reduce((sum, item) => sum + item.plannedMinutes, 0), assignments };
}
function requiredRows(result: { data: Row[]; error: unknown }, tenantId: string, label: string): Row[] {
  if (result.error) throw new Error(`${label}: ${result.error instanceof Error ? result.error.message : toGermanSupabaseError(result.error as import('@supabase/supabase-js').PostgrestError)}`);
  if (result.data.some(row => row.tenant_id !== tenantId)) throw new Error(`${label}: Der Mandant der geladenen Daten stimmt nicht überein.`);
  return result.data;
}
function uniqueByEmployee(rows: Row[], label: string): Map<string, Row> {
  const result = new Map<string, Row>();
  for (const row of rows) {
    const id = asString(row.employee_id);
    if (!id || result.has(id)) throw new Error(`${label}: Die Mitarbeiterzuordnung ist nicht eindeutig.`);
    result.set(id, row);
  }
  return result;
}
function validExpenseRows(rows: Row[]): void {
  for (const row of rows) {
    if (!asString(row.id) || !asString(row.employee_id) || !['draft', 'submitted', 'needs_info', 'approved', 'partially_approved', 'rejected', 'reimbursed'].includes(asString(row.status)) || payrollNumber(row.amount_cents) == null || (row.approved_amount_cents != null && payrollNumber(row.approved_amount_cents) == null)) throw new Error('Mindestens ein Auslagenbetrag oder seine Zuordnung ist ungültig. Bitte den Beleg prüfen.');
  }
}
function buildEmployee(input: {
  employee: Row; payroll?: Row; contract?: Row; account?: WfmOfficeEmployeeTimeAccount;
  absences: Row[]; expenses: PayrollExpenseClaim[]; uploads: PayrollPortalUpload[];
  statements: PayrollStatement[]; visits: WfmOfficePlannedVisit[]; nextVisits: WfmOfficePlannedVisit[];
  year: number; month: number; now: number;
  timeRegistry: PayrollTimeRegistry; historicalEntries: import('@/types/modules/wfmOfficeTimekeeping').WfmOfficeTimeEntry[];
}): PayrollOfficeEmployeeMonth {
  const { employee, payroll, contract, account, year, month, now } = input;
  const employeeId = asString(employee.id), { fromDate, toDate } = payrollPeriodRange(year, month);
  const today = payrollBerlinDay(now);
  const employmentRange = payrollEmploymentRange(employee, fromDate, toDate);
  const absences = input.absences.filter(row => row.employee_id === employeeId);
  const expenses = input.expenses.filter(row => row.employeeId === employeeId);
  const history = input.statements.filter(row => row.employeeId === employeeId);
  const settingsIssues = payrollSettingsIssues(payroll);
  const blockers = [...settingsIssues];
  const warnings: string[] = [];
  const previewNotes: string[] = [];
  const validEmploymentDates = !((employee.entry_date != null && !isPayrollDate(employee.entry_date)) || (employee.exit_date != null && !isPayrollDate(employee.exit_date))
    || (isPayrollDate(employee.entry_date) && isPayrollDate(employee.exit_date) && employee.entry_date > employee.exit_date));
  if (!validEmploymentDates) blockers.push('Ein- oder Austrittsdatum ist ungültig. Bitte die Personalakte korrigieren.');
  const hasSchedule = hasOfficeContractSchedule(contract?.work_days);
  const payoutBasis = miniJobAccountBasisMinutes({ employee, payroll, workDays: contract?.work_days, fromDate, toDate });
  if (!hasSchedule && payoutBasis == null) blockers.push('Die vertraglichen Arbeitstage fehlen. Sollzeit und bezahlte Abwesenheiten sind nicht verlässlich berechenbar.');
  const fullAbsences = payrollAbsenceCredits(absences, contract?.work_days, employmentRange.fromDate, employmentRange.toDate);
  const accruedAbsences = payrollAbsenceCredits(absences, contract?.work_days, employmentRange.fromDate, today < employmentRange.toDate ? today : employmentRange.toDate);
  if (fullAbsences.overlap) blockers.push('Verschiedene bezahlte Abwesenheiten überschneiden sich. Bitte die Abwesenheiten zuerst klären.');
  const targetAvailable = (hasSchedule || payoutBasis != null) && validEmploymentDates && employmentRange.fromDate <= employmentRange.toDate;
  const fullMonthTarget = payoutBasis ?? (targetAvailable ? calculateContractTargetMinutesForRange(contract!.work_days, employmentRange.fromDate, employmentRange.toDate) : 0);
  const currentDeferred = [...input.timeRegistry.deferred.values()].filter(item => payrollPeriodNumber(item.originYear, item.originMonth) === payrollPeriodNumber(year, month));
  // On reissue, exclude every possible replacement for a deferred source. An
  // ambiguous occurrence must not become payable in its original month either.
  const forcedExcludedIds = new Set(currentDeferred.flatMap(item => (account?.entries ?? [])
    .filter(entry => matchDeferredPayrollEntry(item, [entry])).map(entry => entry.id)));
  const times = payrollTimeReadiness(account, now, forcedExcludedIds);
  const deferredById = new Map(currentDeferred.map(item => [item.entryId, item]));
  for (const entry of times.deferredEntries) {
    const prior = currentDeferred.find(item => matchDeferredPayrollEntry(item, [entry]));
    const item = prior ?? deferredPayrollEntry(entry, payrollDeferredReason(entry, now) ?? 'deferred');
    deferredById.set(item.entryId, item);
  }
  const resolved = resolvePayrollCatchUp(input.timeRegistry, input.historicalEntries, year, month, now);
  const catchUpWorkMinutes = resolved.catchUp.reduce((sum, item) => sum + item.minutes, 0);
  const currentPeriodWorkMinutes = times.actualWorkMinutes;
  const actualWorkMinutes = currentPeriodWorkMinutes + catchUpWorkMinutes;
  blockers.push(...times.calculationIssues);
  const accountAvailable = Boolean(account && Number.isFinite(account.actualMinutes) && account.actualMinutes >= 0 && Number.isFinite(account.travelMinutes) && account.travelMinutes >= 0);
  const salaryOutsideEmployment = employmentRange.fromDate > employmentRange.toDate && payroll?.compensation_type === 'salary';
  if (salaryOutsideEmployment) blockers.push('Der Monat liegt außerhalb des Beschäftigungszeitraums. Ein Monatslohn kann dafür nicht verlässlich angesetzt werden.');
  const lines: PayrollAssignmentTimeLine[] = employeeAssignmentTimeLines(account, input.visits, employeeId).map(line => ({ ...line,
    payrollDisposition: times.deferredEntries.some(entry => entry.id === line.entryKey) ? 'deferred' : 'included' }));
  const absenceConflict = payrollAbsenceWorkConflicts(absences, lines.filter(line => line.payrollDisposition !== 'deferred'));
  if (absenceConflict) blockers.push('Bezahlte Abwesenheiten überschneiden sich mit Einsatzplanung oder Arbeitszeit. Bitte zuerst die Einträge abgleichen.');
  const completedWithoutCapture = lines.some(line => isPayrollConductedAssignmentStatus(line.status) && !line.actualStartAt && !line.actualEndAt);
  for (const line of lines.filter(line => isPayrollConductedAssignmentStatus(line.status) && !line.actualStartAt && !line.actualEndAt)) {
    if (times.deferredEntries.some(entry => entry.id === line.entryKey)) continue;
    const entryId = line.entryKey || `planned:${line.assignmentId}:${line.workDate}:${line.plannedStartAt ?? ''}`;
    deferredById.set(entryId, { key: `${line.workDate.slice(0, 7)}:${entryId}`, entryId, originYear: year, originMonth: month,
      workDate: line.workDate, assignmentId: line.assignmentId, visitId: null, sessionId: null, plannedStartAt: line.plannedStartAt,
      clientLabel: line.clientLabel, assignmentTitle: line.assignmentTitle, reason: 'missing' });
    line.payrollDisposition = 'deferred';
  }
  const deferredTimeEntries = [...deferredById.values(), ...resolved.pending];
  if (lines.some(line => (line.actualStartAt || line.actualEndAt) && (line.workDate < employmentRange.fromDate || line.workDate > employmentRange.toDate))) {
    blockers.push('Erfasste Arbeitszeit liegt außerhalb des Beschäftigungszeitraums. Bitte Personalakte und Zeitbuchungen abgleichen.');
  }
  const currentKey = today.slice(0, 7), periodKey = fromDate.slice(0, 7);
  if (periodKey > currentKey) times.blockers.push('Ein zukünftiger Monat kann erst nach Beginn veröffentlicht werden.');
  if (periodKey < currentKey) warnings.push('Die Berechnung verwendet die aktuell hinterlegte Vergütung und Vertragswoche. Veröffentlichte Versionen behalten ihren gespeicherten Stand.');
  if (employmentRange.fromDate !== fromDate || employmentRange.toDate !== toDate) {
    warnings.push(payroll?.compensation_type === 'salary'
      ? 'Ein- oder Austritt im Monat: Der hinterlegte Monatslohn wird vollständig gezeigt. Einen abweichenden Teilmonatsbetrag bitte vor Veröffentlichung in der Personalakte klären.'
      : 'Das vertragliche Soll und Abwesenheiten sind auf den Beschäftigungszeitraum begrenzt.');
  }
  if (deferredTimeEntries.length) warnings.push(`${deferredTimeEntries.length} offene oder ungeprüfte Zeit${deferredTimeEntries.length === 1 ? '' : 'en'} ${deferredTimeEntries.length === 1 ? 'wird' : 'werden'} für diesen Monat übersprungen. Nach Korrektur und Freigabe können sie in einem Folgemonat nachberechnet werden.`);
  if (catchUpWorkMinutes) warnings.push('Freigegebene Nachberechnungen aus Vormonaten sind separat ausgewiesen und in der Auszahlungsgrenze berücksichtigt.');
  const amount = payrollNumber(payroll?.compensation_amount);
  const compensationCents = amount == null ? 0 : Math.round((amount + Number.EPSILON * Math.max(1, amount)) * 100);
  const compensationAvailable = (payroll?.compensation_type === 'hourly' || payroll?.compensation_type === 'salary')
    && amount != null && amount > 0 && Number.isSafeInteger(compensationCents) && compensationCents > 0;
  let payoutPolicyAvailable = settingsIssues.length === 0;
  let maxPayoutHours: number | null = null;
  // A time-review problem must not hide a valid pay rate or bypass its configured cap.
  if (payoutPolicyAvailable) {
    try { maxPayoutHours = resolvePayrollMaxPayoutHours({ periodYear: year, employmentType: employee.employment_type, compensationType: payroll?.compensation_type, compensationAmount: amount, configuredMaxPayoutHours: payroll?.max_payout_hours_month == null ? null : payrollNumber(payroll.max_payout_hours_month) }); }
    catch (cause) { payoutPolicyAvailable = false; blockers.push(cause instanceof Error ? cause.message : 'Die Auszahlungsgrenze konnte nicht bestimmt werden.'); }
  }
  if (isMiniJobEmploymentType(employee.employment_type)) warnings.push('Die monatliche Begrenzung ersetzt keine Prüfung von Jahresverdienst und Sonderzahlungen.');
  const hasPaidAbsences = absences.some(row => ['approved', 'active', 'completed'].includes(asString(row.status)) && !['unpaid_leave', 'parental_leave'].includes(asString(row.absence_type)));
  if (payoutBasis != null && hasPaidAbsences) blockers.push('Für bezahlte Abwesenheiten fehlen vertragliche Tagesstunden. Die Auszahlungsgrenze ersetzt diese Angaben nicht.');
  // A confirmed empty absence result is a real zero even when no contract schedule exists.
  // Conflicting or unquantifiable absences are omitted from the preview, never silently credited twice.
  const absenceAvailable = !hasPaidAbsences || (payoutBasis == null && targetAvailable && !fullAbsences.overlap && !absenceConflict);
  const vacationMinutes = absenceAvailable ? accruedAbsences.vacationMinutes : 0;
  const sickMinutes = absenceAvailable ? accruedAbsences.sickMinutes : 0;
  const otherPaidAbsenceMinutes = absenceAvailable ? accruedAbsences.otherPaidAbsenceMinutes : 0;
  const projectedPaidAbsenceMinutes = absenceAvailable ? Math.max(0, fullAbsences.totalMinutes - accruedAbsences.totalMinutes) : 0;
  if (!absenceAvailable) previewNotes.push('Die Vorschau enthält keine unklaren bezahlten Abwesenheiten. Diese werden nach Klärung ergänzt.');
  if (deferredTimeEntries.length || times.calculationIssues.length || completedWithoutCapture) previewNotes.push('Nur abgeschlossene und freigegebene Zeiterfassungen sind eingerechnet. Zurückgestellte Zeiten werden nicht geschätzt.');
  if (!hasSchedule && payoutBasis == null) previewNotes.push('Der hinterlegte Lohn kann angezeigt werden. Für das Zeitkonto fehlt die vertragliche Sollzeit.');
  if (payoutBasis != null) previewNotes.push('Der Monatsübertrag verwendet die hinterlegte Auszahlungsgrenze. Daraus entstehen keine vertraglichen Sollstunden oder Minusstunden.');
  if (!accountAvailable) previewNotes.push('Ein vollständiges Arbeitszeitkonto fehlt. Eine Vergütung nach Stunden lässt sich daraus noch nicht berechnen.');
  const timeAccountAvailable = accountAvailable && targetAvailable && absenceAvailable;
  const differenceMinutes = timeAccountAvailable ? calculatePayrollTimeAccountBalance({ actualWorkMinutes,
    vacationMinutes, sickMinutes, otherPaidAbsenceMinutes, targetMinutes: fullMonthTarget }) : 0;
  const timeAccountBalanceMinutes = payoutBasis == null ? differenceMinutes : Math.max(0, differenceMinutes);
  let expensesAvailable = true;
  let expenseTotals = { approvedExpensesCents: 0, pendingExpensesCents: 0, reimbursedExpensesCents: 0 };
  try { expenseTotals = payrollExpenseTotals(expenses, { employeeId, periodYear: year, periodMonth: month }); }
  catch (cause) { expensesAvailable = false; blockers.push(cause instanceof Error ? cause.message : 'Die Auslagensummen konnten nicht verlässlich berechnet werden.'); }
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const plannedMinutes = payrollRemainingPlannedMinutes(input.visits, account, employeeId, now);
  const calculateInput = {
    employeeId, employeeName: [asString(employee.first_name), asString(employee.last_name)].filter(Boolean).join(' ') || 'Mitarbeitende ohne Namensangabe',
    employeeNumber: asNullableString(employee.employee_number), periodYear: year, periodMonth: month,
    compensationType: (payroll?.compensation_type === 'hourly' ? 'hourly' : 'salary') as 'hourly' | 'salary',
    compensationAmount: compensationAvailable ? amount! : 0, maxPayoutHours,
    overflowToTimeAccount: isMiniJobEmploymentType(employee.employment_type) || payroll?.overflow_to_time_account !== false,
    actualWorkMinutes, travelMinutes: accountAvailable ? account!.creditedTravelMinutes ?? account!.travelMinutes : 0,
    vacationMinutes, sickMinutes, otherPaidAbsenceMinutes, projectedPaidAbsenceMinutes, targetWorkMinutes: fullMonthTarget,
    ...(payoutBasis == null ? {} : { targetWorkSource: 'payout_limit' as const }),
    monthlyPlannedMinutes: input.visits.filter(visit => visit.employeeId === employeeId).reduce((sum, visit) => sum + payrollPlannedVisitLine(visit).plannedMinutes, 0),
    plannedMinutes, timeAccountBalanceMinutes, expenses: expensesAvailable ? expenses : [], assignmentTimeLines: lines,
    nextMonthPreview: nextMonthPreviewForEmployee(input.nextVisits, employeeId, next.year, next.month), now: new Date(now).toISOString(),
  };
  let grossAvailable = compensationAvailable && payoutPolicyAvailable && validEmploymentDates && !salaryOutsideEmployment
    && (payroll?.compensation_type === 'salary' || accountAvailable);
  // Base numeric fields remain structurally compatible. Each unavailable value is explicitly hidden using its preview flag.
  let snapshot: PayrollStatementSnapshot = { ...calculateInput,
    hourlyRateCents: compensationAvailable && payroll?.compensation_type === 'hourly' ? compensationCents : 0,
    fixedSalaryCents: compensationAvailable && payroll?.compensation_type === 'salary' ? compensationCents : 0,
    maxPayoutMinutes: null, creditedActualMinutes: times.actualWorkMinutes + vacationMinutes + sickMinutes + otherPaidAbsenceMinutes,
    targetActualDifferenceMinutes: timeAccountBalanceMinutes, payableMinutes: 0, overtimeTransferMinutes: 0,
    earnedGrossCents: 0, projectedGrossCents: 0, approvedExpensesCents: 0, pendingExpensesCents: 0,
    advancesCents: 0, deductionsCents: 0, payoutGrossCents: 0, projectedTotalPayoutCents: 0,
    generatedAt: new Date(now).toISOString(), expenseClaims: expenses };
  if (grossAvailable) {
    try { snapshot = { ...calculatePayrollSnapshot(calculateInput), expenseClaims: expenses }; }
    catch (cause) { grossAvailable = false; blockers.push(cause instanceof Error ? cause.message : 'Die Bruttovorschau konnte nicht verlässlich berechnet werden.'); }
  }
  const finalBlockers = [...new Set([...blockers, ...times.blockers])];
  const calculationReady = finalBlockers.length === 0 && grossAvailable && expensesAvailable && timeAccountAvailable;
  return { ...snapshot, ...expenseTotals, currentPeriodWorkMinutes, catchUpWorkMinutes, deferredTimeEntries, catchUpTimeEntries: resolved.catchUp,
    projectedTotalPayoutCents: grossAvailable && expensesAvailable ? snapshot.projectedTotalPayoutCents : 0,
    calculationReady, preview: { compensationAvailable, actualTimeAvailable: accountAvailable, grossAvailable, expensesAvailable, timeAccountAvailable, absenceAvailable,
      provisional: !calculationReady || finalBlockers.length > 0, notes: previewNotes },
    blockers: finalBlockers, warnings, unapprovedEntryCount: deferredTimeEntries.length,
    employmentStatus: asString(employee.status), statementHistory: history,
    latestStatement: history.find(statement => statement.status !== 'superseded' && statement.status !== 'draft') ?? history[0] ?? null,
    pendingPortalUploads: input.uploads.filter(upload => upload.employeeId === employeeId) };
}

export async function listPayrollMonthOverview(tenantId: string, year: number, month: number, actorRoleKey?: RoleKey | null): Promise<ServiceResult<PayrollOfficeMonthOverview>> {
  for (const permission of ['office.employees.view', 'time.tracking.team.view'] as const) {
    const denied = enforcePermission<PayrollOfficeMonthOverview>(actorRoleKey, permission); if (denied) return denied;
  }
  const tenantBlock = guardServiceTenant(tenantId); if (tenantBlock) return tenantBlock;
  try {
    const { fromDate, toDate } = payrollPeriodRange(year, month);
    if (getServiceMode() !== 'supabase') return { ok: false, error: 'Die Gehaltsstatistik benötigt die verbundenen Personal- und Arbeitszeitdaten.' };
    const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Die Datenbankverbindung ist nicht verfügbar. Bitte erneut anmelden oder laden.' };
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    // The accepted final month still needs a preview in January of the following year.
    const nextKey = `${next.year}-${String(next.month).padStart(2, '0')}`;
    const nextRange = { fromDate: `${nextKey}-01`, toDate: `${nextKey}-${String(new Date(Date.UTC(next.year, next.month, 0)).getUTCDate()).padStart(2, '0')}` };
    const lower = new Date(`${fromDate}T00:00:00Z`); lower.setUTCDate(lower.getUTCDate() - 1);
    const upper = `${nextPayrollDay(toDate)}T23:59:59Z`;
    const scoped = (table: string, select: string) => fromUnknownTable(client, table).select(select).eq('tenant_id', tenantId);
    const [employeesRes, payrollRes, contractRes, accountsRes, absencesRes, expensesRes, statementsRes, plannedRes, nextPlannedRes, uploadsRes, timeHistoryRes] = await Promise.all([
      readAllOfficeAccountRows((from, to) => scoped('employees', 'id,tenant_id,first_name,last_name,employee_number,employment_type,status,entry_date,exit_date').order('id').range(from, to)),
      readAllOfficeAccountRows((from, to) => scoped('employee_payroll_settings', 'tenant_id,employee_id,compensation_type,compensation_amount,max_payout_hours_month,overflow_to_time_account,mileage_rate_cents').order('employee_id').range(from, to)),
      readAllOfficeAccountRows((from, to) => scoped('employee_contract_settings', 'tenant_id,employee_id,work_days').order('employee_id').range(from, to)),
      getWfmOfficeEmployeeTimeAccounts(tenantId, actorRoleKey ?? null, { preset: 'custom', fromDate, toDate }),
      readAllOfficeAccountRows((from, to) => scoped('workforce_absences', 'id,tenant_id,employee_id,absence_type,status,starts_at,ends_at,all_day').lte('starts_at', upper).gte('ends_at', lower.toISOString()).order('id').range(from, to)),
      readAllOfficeAccountRows((from, to) => scoped('employee_expense_claims', '*').gte('expense_date', fromDate).lte('expense_date', toDate).order('expense_date', { ascending: false }).order('id').range(from, to)),
      readAllOfficeAccountRows((from, to) => scoped('payroll_month_statements', '*').eq('period_year', year).eq('period_month', month).order('version', { ascending: false }).order('id').range(from, to)),
      listPlannedVisitsForPeriod(tenantId, fromDate, toDate), listPlannedVisitsForPeriod(tenantId, nextRange.fromDate, nextRange.toDate),
      // A receipt uploaded later can still concern the selected month. Show every pending employee upload with its original upload date.
      readAllOfficeAccountRows((from, to) => scoped('portal_uploads', 'id,tenant_id,employee_id,file_name,storage_path,category,status,created_at').eq('upload_context', 'mitarbeiter').in('status', ['hochgeladen', 'wird_geprueft']).order('created_at', { ascending: false }).order('id').range(from, to)),
      // Only the small carry-forward fields are needed across periods, not full historical PDFs or snapshots.
      readAllOfficeAccountRows((from, to) => scoped('payroll_month_statements', 'id,tenant_id,employee_id,period_year,period_month,version,status,deferred_time_entries:snapshot_json->deferredTimeEntries,catch_up_time_entries:snapshot_json->catchUpTimeEntries').order('id').range(from, to)),
    ]);
    if (!accountsRes.ok) return accountsRes;
    if (!plannedRes.ok) return plannedRes;
    if (!nextPlannedRes.ok) return nextPlannedRes;
    const employees = requiredRows(employeesRes, tenantId, 'Personal');
    const payroll = uniqueByEmployee(requiredRows(payrollRes, tenantId, 'Vergütung'), 'Vergütung');
    const contracts = uniqueByEmployee(requiredRows(contractRes, tenantId, 'Verträge'), 'Verträge');
    const absences = requiredRows(absencesRes, tenantId, 'Abwesenheiten');
    const expenseRows = requiredRows(expensesRes, tenantId, 'Auslagen'); validExpenseRows(expenseRows);
    const expenses = expenseRows.map(mapPayrollOfficeExpense);
    const statements = requiredRows(statementsRes, tenantId, 'Monatsübersichten').map(mapPayrollOfficeStatement);
    const timeHistory = requiredRows(timeHistoryRes, tenantId, 'Zeitnachberechnungen');
    const registries = new Map(employees.map(employee => { const id = asString(employee.id); return [id, payrollTimeRegistry(timeHistory, id)] as const; }));
    const outstanding = [...registries.values()].flatMap(registry => [...registry.deferred.values()].filter(item => payrollPeriodNumber(item.originYear, item.originMonth) < payrollPeriodNumber(year, month) && !registry.settled.has(item.key)));
    let historicalAccounts: WfmOfficeEmployeeTimeAccount[] = [];
    if (outstanding.length) {
      const days = outstanding.map(item => item.workDate).sort();
      const loaded = await getWfmOfficeEmployeeTimeAccounts(tenantId, actorRoleKey ?? null, { preset: 'custom', fromDate: days[0], toDate: days[days.length - 1] });
      if (!loaded.ok) return loaded;
      historicalAccounts = loaded.data;
    }
    const uploadRows = requiredRows(uploadsRes, tenantId, 'Belegeingang');
    if (uploadRows.some(row => !asString(row.id) || !asString(row.employee_id) || !asString(row.file_name) || !asString(row.storage_path))) throw new Error('Ein offener Beleg besitzt keine vollständige Dateizuordnung. Bitte den Belegeingang prüfen.');
    const uploads = uploadRows.map(mapPayrollPortalUpload);
    const accounts = new Map(accountsRes.data.map(account => [account.employeeId, account]));
    const employeeIds = new Set(employees.map(employee => asString(employee.id)));
    if (employeeIds.size !== employees.length || employeeIds.has('') || [...accounts.keys(), ...expenses.map(expense => expense.employeeId), ...statements.map(statement => statement.employeeId)].some(id => !employeeIds.has(id))) throw new Error('Abrechnungsdaten konnten keinem eindeutigen Mitarbeiterprofil zugeordnet werden.');
    const rolloverEmployees = [...registries].filter(([, registry]) => [...registry.deferred.values()].some(item => payrollPeriodNumber(item.originYear, item.originMonth) <= payrollPeriodNumber(year, month) && (!registry.settled.has(item.key) || registry.settled.get(item.key)?.period === payrollPeriodNumber(year, month)))).map(([id]) => id);
    const evidence = new Set([...accountsRes.data.filter(account => account.entries.length || account.actualMinutes || account.absenceMinutes).map(account => account.employeeId), ...expenses.map(expense => expense.employeeId), ...statements.map(statement => statement.employeeId), ...rolloverEmployees]);
    const now = Date.now();
    const result = employees.filter(employee => isPayrollEmployeeInPeriod(employee, fromDate, toDate, evidence.has(asString(employee.id)))).map(employee => buildEmployee({
      employee, payroll: payroll.get(asString(employee.id)), contract: contracts.get(asString(employee.id)), account: accounts.get(asString(employee.id)),
      absences, expenses, statements, uploads, visits: plannedRes.data, nextVisits: nextPlannedRes.data, year, month, now,
      timeRegistry: registries.get(asString(employee.id))!, historicalEntries: historicalAccounts.filter(account => account.employeeId === asString(employee.id)).flatMap(account => account.entries),
    })).sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'));
    const grossPreviews = result.filter(employee => employee.preview.grossAvailable);
    const expensePreviews = result.filter(employee => employee.preview.expensesAvailable);
    return { ok: true, data: { periodYear: year, periodMonth: month, generatedAt: new Date(now).toISOString(), employees: result,
      totalsComplete: result.every(employee => employee.calculationReady),
      previewCounts: { gross: grossPreviews.length, expenses: expensePreviews.length, timeAccounts: result.filter(employee => employee.preview.timeAccountAvailable).length, total: result.length }, totals: {
        earnedGrossCents: grossPreviews.reduce((sum, employee) => sum + employee.earnedGrossCents, 0), projectedGrossCents: grossPreviews.reduce((sum, employee) => sum + employee.projectedGrossCents, 0),
        approvedExpensesCents: expensePreviews.reduce((sum, employee) => sum + employee.approvedExpensesCents, 0), plannedMinutes: result.reduce((sum, employee) => sum + employee.plannedMinutes, 0),
        overtimeTransferMinutes: grossPreviews.reduce((sum, employee) => sum + employee.overtimeTransferMinutes, 0),
      } } };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Die Gehaltsstatistik konnte nicht vollständig geladen werden. Bitte erneut versuchen.' };
  }
}
