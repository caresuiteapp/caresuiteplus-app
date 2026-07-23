import type { RoleKey, ServiceResult } from '@/types';
import type {
  CreateExpenseClaimInput,
  ExpenseClaimStatus,
  PayrollEmployeeMonth,
  PayrollExpenseClaim,
  PayrollMonthOverview,
  PayrollStatement,
  PayrollStatementSnapshot,
} from '@/types/modules/payrollMonth';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import type { WfmOfficePlannedVisit } from '@/types/modules/wfmOfficeTimekeeping';
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';
import { renderHtmlToPdfBytes } from '@/lib/documents/documentPdfService';
import { listPlannedVisitsForPeriod } from '@/lib/wfm/wfmOfficePlannedVisitRepository';
import { getWfmOfficeEmployeeTimeAccounts } from '@/lib/wfm/wfmOfficeZeitkontenService';
import {
  buildPayrollStatementHtml,
  calculatePayrollSnapshot,
} from './payrollCalculator';
import { isPayrollRelevantEmployee } from './payrollEmployeeStatus';

type Row = Record<string, unknown>;

const demoExpenses = new Map<string, PayrollExpenseClaim[]>();
const demoStatements = new Map<string, PayrollStatement[]>();

function periodRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    fromDate: `${year}-${String(month).padStart(2, '0')}-01`,
    toDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

const asString = (value: unknown): string => typeof value === 'string' ? value : '';
const asNullableString = (value: unknown): string | null => {
  const text = asString(value).trim();
  return text || null;
};
const asNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;

function mapExpense(row: Row): PayrollExpenseClaim {
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
    taxTreatment: (asString(row.tax_treatment) || 'review') as PayrollExpenseClaim['taxTreatment'],
    status: (asString(row.status) || 'draft') as ExpenseClaimStatus,
    officeNote: asNullableString(row.office_note), rejectionReason: asNullableString(row.rejection_reason),
    submittedAt: asNullableString(row.submitted_at), reviewedAt: asNullableString(row.reviewed_at),
    createdAt: asString(row.created_at), updatedAt: asString(row.updated_at),
  };
}

function mapStatement(row: Row): PayrollStatement {
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

function averageDailyMinutes(workDays: unknown): number {
  if (!workDays || typeof workDays !== 'object') return 0;
  const values = Object.values(workDays as Record<string, unknown>)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 60) : 0;
}

const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function absenceMinutesInPeriod(
  absence: Row,
  workDays: unknown,
  year: number,
  month: number,
  fallbackDailyMinutes: number,
): number {
  const schedule = workDays && typeof workDays === 'object'
    ? workDays as Record<string, unknown>
    : {};
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0));
  const rawStart = new Date(asString(absence.starts_at));
  const rawEnd = new Date(asString(absence.ends_at));
  if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) {
    return Math.round((asNumber(absence.requested_days) || 1) * fallbackDailyMinutes);
  }
  const cursor = new Date(Math.max(periodStart.getTime(), Date.UTC(rawStart.getUTCFullYear(), rawStart.getUTCMonth(), rawStart.getUTCDate())));
  const end = Math.min(periodEnd.getTime(), Date.UTC(rawEnd.getUTCFullYear(), rawEnd.getUTCMonth(), rawEnd.getUTCDate()));
  let minutes = 0;
  while (cursor.getTime() <= end) {
    const hours = schedule[weekdayKeys[cursor.getUTCDay()]];
    if (typeof hours === 'number' && Number.isFinite(hours) && hours > 0) minutes += Math.round(hours * 60);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return minutes || Math.round((asNumber(absence.requested_days) || 1) * fallbackDailyMinutes);
}

function plannedMinutesForEmployee(
  rows: WfmOfficePlannedVisit[],
  employeeId: string,
  now: number,
): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, visit) => {
    if (visit.employeeId !== employeeId || !visit.plannedStartAt || !visit.plannedEndAt) return sum;
    if (visit.assignmentActualEndAt || new Date(visit.plannedStartAt).getTime() <= now) return sum;
    const duration = Math.max(0, new Date(visit.plannedEndAt).getTime() - new Date(visit.plannedStartAt).getTime());
    return sum + Math.round(duration / 60000);
  }, 0);
}

function buildEmployeeSnapshot(input: {
  employee: Row; payroll?: Row; contract?: Row; timeAccount?: WfmOfficeEmployeeTimeAccount;
  absenceRows: Row[]; expenses: PayrollExpenseClaim[]; plannedMinutes: number;
  year: number; month: number; latestStatement: PayrollStatement | null;
}): PayrollEmployeeMonth {
  const employeeId = asString(input.employee.id);
  const dailyMinutes = averageDailyMinutes(input.contract?.work_days);
  let vacationMinutes = 0; let sickMinutes = 0; let otherPaidAbsenceMinutes = 0;
  for (const absence of input.absenceRows) {
    if (asString(absence.employee_id) !== employeeId || !['approved', 'active', 'completed'].includes(asString(absence.status))) continue;
    const minutes = absenceMinutesInPeriod(
      absence,
      input.contract?.work_days,
      input.year,
      input.month,
      dailyMinutes,
    );
    const type = asString(absence.absence_type);
    if (type === 'vacation') vacationMinutes += minutes;
    else if (type === 'sick_leave' || type === 'child_sick_leave') sickMinutes += minutes;
    else if (!['unpaid_leave', 'parental_leave'].includes(type)) otherPaidAbsenceMinutes += minutes;
  }
  const account = input.timeAccount;
  const actualWorkMinutes = account?.actualMinutes ?? 0;
  const snapshot = calculatePayrollSnapshot({
    employeeId,
    employeeName: [asString(input.employee.first_name), asString(input.employee.last_name)].filter(Boolean).join(' ') || 'Mitarbeitende:r',
    employeeNumber: asNullableString(input.employee.employee_number),
    periodYear: input.year, periodMonth: input.month,
    compensationType: asString(input.payroll?.compensation_type) === 'hourly' ? 'hourly' : 'salary',
    compensationAmount: asNumber(input.payroll?.compensation_amount),
    maxPayoutHours: input.payroll?.max_payout_hours_month == null ? null : asNumber(input.payroll?.max_payout_hours_month),
    overflowToTimeAccount: input.payroll?.overflow_to_time_account !== false,
    actualWorkMinutes,
    travelMinutes: account?.travelMinutes ?? 0, vacationMinutes, sickMinutes, otherPaidAbsenceMinutes,
    monthlyPlannedMinutes: account?.plannedMinutes ?? input.plannedMinutes,
    plannedMinutes: input.plannedMinutes,
    timeAccountBalanceMinutes: account?.saldoMinutes ?? 0,
    expenses: input.expenses.filter((expense) => expense.employeeId === employeeId),
  });
  return { ...snapshot, latestStatement: input.latestStatement };
}

export async function listPayrollMonthOverview(
  tenantId: string, year: number, month: number, actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PayrollMonthOverview>> {
  const denied = enforcePermission<PayrollMonthOverview>(actorRoleKey, 'office.employees.view');
  if (denied) return denied;
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { periodYear: year, periodMonth: month, generatedAt: new Date().toISOString(), employees: [], totals: { earnedGrossCents: 0, projectedGrossCents: 0, approvedExpensesCents: 0, plannedMinutes: 0, overtimeTransferMinutes: 0 } } };
  }
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { fromDate, toDate } = periodRange(year, month);
  const [employeesRes, payrollRes, contractRes, timeAccountsRes, absencesRes, expensesRes, statementsRes, plannedRes] = await Promise.all([
    fromUnknownTable(supabase, 'employees').select('id, first_name, last_name, employee_number, status').eq('tenant_id', tenantId).order('last_name'),
    fromUnknownTable(supabase, 'employee_payroll_settings').select('employee_id, compensation_type, compensation_amount, max_payout_hours_month, overflow_to_time_account, mileage_rate_cents').eq('tenant_id', tenantId),
    fromUnknownTable(supabase, 'employee_contract_settings').select('employee_id, work_days').eq('tenant_id', tenantId),
    getWfmOfficeEmployeeTimeAccounts(tenantId, actorRoleKey ?? null, {
      preset: 'custom',
      fromDate,
      toDate,
    }),
    fromUnknownTable(supabase, 'workforce_absences').select('employee_id, absence_type, status, requested_days, starts_at, ends_at').eq('tenant_id', tenantId).lte('starts_at', `${toDate}T23:59:59`).gte('ends_at', `${fromDate}T00:00:00`),
    fromUnknownTable(supabase, 'employee_expense_claims').select('*').eq('tenant_id', tenantId).gte('expense_date', fromDate).lte('expense_date', toDate).order('expense_date', { ascending: false }),
    fromUnknownTable(supabase, 'payroll_month_statements').select('*').eq('tenant_id', tenantId).eq('period_year', year).eq('period_month', month).order('version', { ascending: false }),
    listPlannedVisitsForPeriod(tenantId, fromDate, toDate),
  ]);
  const firstError = [employeesRes, payrollRes, contractRes, absencesRes, expensesRes, statementsRes].find((result) => result.error)?.error;
  if (firstError) return { ok: false, error: toGermanSupabaseError(firstError) };
  if (!timeAccountsRes.ok) return { ok: false, error: timeAccountsRes.error };
  if (!plannedRes.ok) return plannedRes;
  const rows = (value: unknown) => (Array.isArray(value) ? value : []) as Row[];
  const payrollRows = rows(payrollRes.data); const contractRows = rows(contractRes.data);
  const timeAccounts = new Map(timeAccountsRes.data.map((account) => [account.employeeId, account]));
  const statementRows = rows(statementsRes.data).map(mapStatement);
  const expenses = rows(expensesRes.data).map(mapExpense); const now = Date.now();
  const employees = rows(employeesRes.data).filter(isPayrollRelevantEmployee).map((employee) => {
    const employeeId = asString(employee.id);
    return buildEmployeeSnapshot({ employee,
      payroll: payrollRows.find((row) => asString(row.employee_id) === employeeId),
      contract: contractRows.find((row) => asString(row.employee_id) === employeeId),
      timeAccount: timeAccounts.get(employeeId),
      absenceRows: rows(absencesRes.data), expenses,
      plannedMinutes: plannedMinutesForEmployee(plannedRes.data, employeeId, now), year, month,
      latestStatement: statementRows.find((row) => row.employeeId === employeeId) ?? null,
    });
  });
  return { ok: true, data: { periodYear: year, periodMonth: month, generatedAt: new Date().toISOString(), employees,
    totals: {
      earnedGrossCents: employees.reduce((s, e) => s + e.earnedGrossCents, 0),
      projectedGrossCents: employees.reduce((s, e) => s + e.projectedGrossCents, 0),
      approvedExpensesCents: employees.reduce((s, e) => s + e.approvedExpensesCents, 0),
      plannedMinutes: employees.reduce((s, e) => s + e.plannedMinutes, 0),
      overtimeTransferMinutes: employees.reduce((s, e) => s + e.overtimeTransferMinutes, 0),
    },
  } };
}

export async function loadEmployeePayrollMonth(
  tenantId: string, employeeId: string, year: number, month: number,
): Promise<ServiceResult<{ statement: PayrollStatement | null; expenses: PayrollExpenseClaim[]; mileageRateCents: number }>> {
  const key = `${tenantId}:${employeeId}:${year}:${month}`;
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { statement: (demoStatements.get(key) ?? [])[0] ?? null, expenses: demoExpenses.get(key) ?? [], mileageRateCents: 30 } };
  }
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { fromDate, toDate } = periodRange(year, month);
  const [statementRes, expenseRes, mileageRateRes] = await Promise.all([
    fromUnknownTable(supabase, 'payroll_month_statements').select('*').eq('tenant_id', tenantId).eq('employee_id', employeeId).eq('period_year', year).eq('period_month', month).in('status', ['published','confirmed','rejected','locked','paid']).order('version', { ascending: false }).limit(1).maybeSingle(),
    fromUnknownTable(supabase, 'employee_expense_claims').select('*').eq('tenant_id', tenantId).eq('employee_id', employeeId).gte('expense_date', fromDate).lte('expense_date', toDate).order('expense_date', { ascending: false }),
    supabase.rpc('employee_payroll_mileage_rate_cents' as never),
  ]);
  if (statementRes.error) return { ok: false, error: toGermanSupabaseError(statementRes.error) };
  if (expenseRes.error) return { ok: false, error: toGermanSupabaseError(expenseRes.error) };
  return { ok: true, data: {
    statement: statementRes.data ? mapStatement(statementRes.data as Row) : null,
    expenses: ((expenseRes.data ?? []) as Row[]).map(mapExpense),
    mileageRateCents: mileageRateRes.error ? 30 : Math.max(0, asNumber(mileageRateRes.data) || 30),
  } };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest(
      'SHA-256',
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function createUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export async function publishPayrollStatement(
  tenantId: string, employee: PayrollEmployeeMonth, actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PayrollStatement>> {
  const denied = enforcePermission<PayrollStatement>(actorRoleKey, 'office.employees.edit'); if (denied) return denied;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'PDF-Veröffentlichung ist nur im Live-Betrieb möglich.' };
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const existingRes = await fromUnknownTable(supabase, 'payroll_month_statements').select('id, version, status').eq('tenant_id', tenantId).eq('employee_id', employee.employeeId).eq('period_year', employee.periodYear).eq('period_month', employee.periodMonth).order('version', { ascending: false });
  if (existingRes.error) return { ok: false, error: toGermanSupabaseError(existingRes.error) };
  const existing = (existingRes.data ?? []) as Row[];
  const immutableStatement = existing.find((row) => ['confirmed','locked','paid'].includes(asString(row.status)));
  if (immutableStatement) {
    return { ok: false, error: 'Eine bestätigte oder gesperrte Monatsübersicht kann nicht erneut veröffentlicht werden.' };
  }
  const version = Math.max(0, ...existing.map((row) => asNumber(row.version))) + 1;
  const statementId = createUuid();
  const { latestStatement, ...snapshot } = employee;
  void latestStatement;
  const html = buildPayrollStatementHtml(snapshot, version);
  let pdfBytes: Uint8Array;
  try { pdfBytes = await renderHtmlToPdfBytes(html); }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'PDF-Erzeugung fehlgeschlagen.' }; }
  const upload = await invokeEdgeFunction<{ pdfPath?: string }>('render-document-pdf', { tenantId, documentId: `payroll-${statementId}`, htmlOutput: html, pdfBase64: bytesToBase64(pdfBytes), storeOnly: true });
  if (!upload.ok || !upload.data.pdfPath) return { ok: false, error: upload.ok ? 'PDF-Speicherpfad fehlt.' : upload.error };
  const supersedeIds = existing.filter((row) => ['published','rejected'].includes(asString(row.status))).map((row) => asString(row.id));
  if (supersedeIds.length) {
    const supersede = await fromUnknownTable(supabase, 'payroll_month_statements').update({ status: 'superseded', updated_at: new Date().toISOString() }).in('id', supersedeIds);
    if (supersede.error) return { ok: false, error: toGermanSupabaseError(supersede.error) };
  }
  const now = new Date().toISOString();
  const { data, error } = await fromUnknownTable(supabase, 'payroll_month_statements').insert({
    id: statementId, tenant_id: tenantId, employee_id: employee.employeeId,
    period_year: employee.periodYear, period_month: employee.periodMonth, version, status: 'published', snapshot_json: snapshot,
    actual_work_minutes: snapshot.actualWorkMinutes, travel_minutes: snapshot.travelMinutes,
    paid_absence_minutes: snapshot.vacationMinutes + snapshot.sickMinutes + snapshot.otherPaidAbsenceMinutes,
    planned_minutes: snapshot.plannedMinutes, payable_minutes: snapshot.payableMinutes,
    overtime_transfer_minutes: snapshot.overtimeTransferMinutes, earned_gross_cents: snapshot.earnedGrossCents,
    projected_gross_cents: snapshot.projectedGrossCents, approved_expenses_cents: snapshot.approvedExpensesCents,
    projected_payout_cents: snapshot.projectedTotalPayoutCents, pdf_path: upload.data.pdfPath,
    pdf_sha256: await sha256(pdfBytes), published_at: now, published_by: (await supabase.auth.getUser()).data.user?.id ?? null,
  }).select('*').single();
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  const statement = mapStatement(data as Row);
  await fromUnknownTable(supabase, 'payroll_month_audit_log').insert({ tenant_id: tenantId, statement_id: statement.id, employee_id: employee.employeeId, action: 'published', summary: `Monatsübersicht Version ${version} veröffentlicht.`, metadata: { pdf_sha256: statement.pdfSha256 } });
  return { ok: true, data: statement };
}

export async function decidePayrollStatement(statementId: string, decision: 'confirm' | 'reject', reason?: string): Promise<ServiceResult<PayrollStatement>> {
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { data, error } = await supabase.rpc('employee_decide_payroll_statement' as never, {
    p_statement_id: statementId,
    p_decision: decision,
    p_reason: reason?.trim() || null,
  } as never);
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapStatement(data as Row) };
}

export async function createExpenseClaim(input: CreateExpenseClaimInput): Promise<ServiceResult<PayrollExpenseClaim>> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'Der Auslagenbetrag muss größer als 0,00 EUR sein.' };
  if (input.description.trim().length < 3 || input.businessPurpose.trim().length < 3) return { ok: false, error: 'Beschreibung und geschäftlicher Zweck sind Pflichtangaben.' };
  if (input.category === 'mileage' && (!input.mileageKm || !input.mileageRateCents)) return { ok: false, error: 'Für die Kilometerpauschale sind Kilometer und Kilometersatz erforderlich.' };
  if (input.category !== 'mileage' && !input.receiptPath) return { ok: false, error: 'Für diese Auslage ist eine Quittung, Rechnung oder ein Ticket erforderlich.' };
  if (getServiceMode() !== 'supabase') {
    const item = mapExpense({ ...input, id: `expense-${Date.now()}`, tenant_id: input.tenantId, employee_id: input.employeeId, expense_date: input.expenseDate, amount_cents: input.amountCents, business_purpose: input.businessPurpose, status: 'submitted', submitted_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    const key = `${input.tenantId}:${input.employeeId}:${input.expenseDate.slice(0, 7).replace('-', ':')}`; demoExpenses.set(key, [item, ...(demoExpenses.get(key) ?? [])]); return { ok: true, data: item };
  }
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { data, error } = await fromUnknownTable(supabase, 'employee_expense_claims').insert({
    tenant_id: input.tenantId, employee_id: input.employeeId, expense_date: input.expenseDate,
    category: input.category, description: input.description.trim(), amount_cents: input.amountCents,
    business_purpose: input.businessPurpose.trim(), payment_method: input.paymentMethod ?? null,
    receipt_number: input.receiptNumber ?? null, receipt_path: input.receiptPath ?? null,
    mileage_km: input.mileageKm ?? null, mileage_rate_cents: input.mileageRateCents ?? null,
    origin: input.origin ?? null, destination: input.destination ?? null, vehicle_label: input.vehicleLabel ?? null,
    assignment_id: input.assignmentId ?? null, client_id: input.clientId ?? null,
    status: 'submitted', submitted_at: new Date().toISOString(), created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
  }).select('*').single();
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapExpense(data as Row) };
}

export async function uploadExpenseReceipt(input: { tenantId: string; employeeId: string; uri: string; fileName: string; mimeType?: string | null }): Promise<ServiceResult<{ path: string }>> {
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  try {
    const response = await fetch(input.uri); const blob = await response.blob();
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${input.tenantId}/payroll/expenses/${input.employeeId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('office-documents').upload(path, blob, { contentType: input.mimeType ?? blob.type ?? 'application/octet-stream', upsert: false });
    if (error) {
      const message = error.message.toLowerCase().includes('row-level security')
        ? 'Der persönliche Belegordner ist noch nicht freigeschaltet. Bitte die Payroll-Sicherheitsmigration anwenden.'
        : error.message;
      return { ok: false, error: message };
    }
    return { ok: true, data: { path } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Beleg-Upload fehlgeschlagen.' }; }
}

export async function reviewExpenseClaim(input: { tenantId: string; claimId: string; status: Extract<ExpenseClaimStatus, 'approved' | 'partially_approved' | 'rejected' | 'needs_info'>; approvedAmountCents?: number | null; officeNote?: string | null; rejectionReason?: string | null }, actorRoleKey?: RoleKey | null): Promise<ServiceResult<PayrollExpenseClaim>> {
  const denied = enforcePermission<PayrollExpenseClaim>(actorRoleKey, 'office.employees.edit'); if (denied) return denied;
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  if (input.status === 'rejected' && (input.rejectionReason?.trim().length ?? 0) < 5) return { ok: false, error: 'Für die Ablehnung ist ein Grund erforderlich.' };
  const { data, error } = await fromUnknownTable(supabase, 'employee_expense_claims').update({ status: input.status, approved_amount_cents: input.status === 'approved' || input.status === 'partially_approved' ? input.approvedAmountCents ?? null : null, office_note: input.officeNote?.trim() || null, rejection_reason: input.status === 'rejected' ? input.rejectionReason?.trim() : null, tax_treatment: input.status === 'approved' || input.status === 'partially_approved' ? 'reimbursement' : 'review', reviewed_at: new Date().toISOString(), reviewed_by: (await supabase.auth.getUser()).data.user?.id ?? null }).eq('tenant_id', input.tenantId).eq('id', input.claimId).select('*').single();
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) }; return { ok: true, data: mapExpense(data as Row) };
}

export async function getPayrollPdfUrl(pdfPath: string): Promise<ServiceResult<string>> {
  const supabase = getSupabaseClient(); if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { data, error } = await supabase.storage.from('office-documents').createSignedUrl(pdfPath, 3600);
  if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? 'PDF konnte nicht geöffnet werden.' };
  return { ok: true, data: data.signedUrl };
}
