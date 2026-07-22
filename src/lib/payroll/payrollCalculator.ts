import type {
  PayrollExpenseClaim,
  PayrollStatementSnapshot,
} from '@/types/modules/payrollMonth';

export type PayrollCalculationInput = {
  employeeId: string;
  employeeName: string;
  employeeNumber?: string | null;
  periodYear: number;
  periodMonth: number;
  compensationType: 'salary' | 'hourly';
  compensationAmount: number;
  maxPayoutHours?: number | null;
  overflowToTimeAccount?: boolean;
  actualWorkMinutes: number;
  travelMinutes: number;
  vacationMinutes: number;
  sickMinutes: number;
  otherPaidAbsenceMinutes: number;
  plannedMinutes: number;
  timeAccountBalanceMinutes?: number;
  advancesCents?: number;
  deductionsCents?: number;
  expenses: PayrollExpenseClaim[];
  now?: string;
};

const nonNegative = (value: number | null | undefined) =>
  Number.isFinite(value) ? Math.max(0, Math.round(value ?? 0)) : 0;

export function moneyFromMinutes(minutes: number, hourlyRateCents: number): number {
  return Math.round((nonNegative(minutes) / 60) * nonNegative(hourlyRateCents));
}

export function calculatePayrollSnapshot(input: PayrollCalculationInput): PayrollStatementSnapshot {
  const actualWorkMinutes = nonNegative(input.actualWorkMinutes);
  const vacationMinutes = nonNegative(input.vacationMinutes);
  const sickMinutes = nonNegative(input.sickMinutes);
  const otherPaidAbsenceMinutes = nonNegative(input.otherPaidAbsenceMinutes);
  const plannedMinutes = nonNegative(input.plannedMinutes);
  const contractualPayableMinutes =
    actualWorkMinutes + vacationMinutes + sickMinutes + otherPaidAbsenceMinutes;
  const maxPayoutMinutes = input.maxPayoutHours == null
    ? null
    : Math.round(Math.max(0, input.maxPayoutHours) * 60);
  const payableMinutes = maxPayoutMinutes == null
    ? contractualPayableMinutes
    : Math.min(contractualPayableMinutes, maxPayoutMinutes);
  const overtimeTransferMinutes = input.overflowToTimeAccount === false
    ? 0
    : Math.max(0, contractualPayableMinutes - payableMinutes);
  const hourlyRateCents = input.compensationType === 'hourly'
    ? Math.round(Math.max(0, input.compensationAmount) * 100)
    : 0;
  const fixedSalaryCents = input.compensationType === 'salary'
    ? Math.round(Math.max(0, input.compensationAmount) * 100)
    : 0;
  const earnedGrossCents = input.compensationType === 'salary'
    ? fixedSalaryCents
    : moneyFromMinutes(payableMinutes, hourlyRateCents);
  const projectedPayableMinutes = maxPayoutMinutes == null
    ? contractualPayableMinutes + plannedMinutes
    : Math.min(contractualPayableMinutes + plannedMinutes, maxPayoutMinutes);
  const projectedGrossCents = input.compensationType === 'salary'
    ? fixedSalaryCents
    : moneyFromMinutes(projectedPayableMinutes, hourlyRateCents);
  const approvedExpensesCents = input.expenses.reduce(
    (sum, item) => sum + (
      item.status === 'approved' || item.status === 'partially_approved' || item.status === 'reimbursed'
        ? nonNegative(item.approvedAmountCents ?? item.amountCents)
        : 0
    ),
    0,
  );
  const pendingExpensesCents = input.expenses.reduce(
    (sum, item) => sum + (
      item.status === 'submitted' || item.status === 'needs_info'
        ? nonNegative(item.amountCents)
        : 0
    ),
    0,
  );
  const advancesCents = nonNegative(input.advancesCents);
  const deductionsCents = nonNegative(input.deductionsCents);

  return {
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    employeeNumber: input.employeeNumber ?? null,
    periodYear: input.periodYear,
    periodMonth: input.periodMonth,
    compensationType: input.compensationType,
    hourlyRateCents,
    fixedSalaryCents,
    maxPayoutMinutes,
    actualWorkMinutes,
    travelMinutes: Math.min(actualWorkMinutes, nonNegative(input.travelMinutes)),
    vacationMinutes,
    sickMinutes,
    otherPaidAbsenceMinutes,
    plannedMinutes,
    payableMinutes,
    overtimeTransferMinutes,
    timeAccountBalanceMinutes: Math.round(input.timeAccountBalanceMinutes ?? 0),
    earnedGrossCents,
    projectedGrossCents,
    approvedExpensesCents,
    pendingExpensesCents,
    advancesCents,
    deductionsCents,
    payoutGrossCents: Math.max(0, earnedGrossCents - advancesCents - deductionsCents),
    projectedTotalPayoutCents: Math.max(
      0,
      projectedGrossCents + approvedExpensesCents - advancesCents - deductionsCents,
    ),
    generatedAt: input.now ?? new Date().toISOString(),
    expenseClaims: input.expenses,
  };
}

export const formatPayrollMoney = (cents: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);

export function formatPayrollMinutes(minutes: number): string {
  const sign = minutes < 0 ? '−' : '';
  const absolute = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')} Std.`;
}

function escapePayrollHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildPayrollStatementHtml(snapshot: PayrollStatementSnapshot, version: number): string {
  const month = new Date(snapshot.periodYear, snapshot.periodMonth - 1, 1).toLocaleDateString('de-DE', {
    month: 'long', year: 'numeric',
  });
  const expenseRows = snapshot.expenseClaims
    .filter((claim) => ['approved', 'partially_approved', 'reimbursed'].includes(claim.status))
    .map((claim) => `<tr><td>${escapePayrollHtml(claim.expenseDate)}</td><td>${escapePayrollHtml(claim.description)}</td><td>${formatPayrollMoney(claim.approvedAmountCents ?? claim.amountCents)}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#17192b;background:#fff;padding:28px;font-size:12px}
    h1{font-size:24px;margin:0;color:#17192b} h2{font-size:15px;margin-top:24px;color:#343757}
    .brand{color:#177d8d;font-weight:800;letter-spacing:1px}.meta{color:#686b7e;margin:6px 0 18px}
    .hero{border:1px solid #b9dfe4;border-radius:18px;padding:22px;background:#f5fbfc}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-top:16px}
    .row{display:flex;justify-content:space-between;border-bottom:1px solid #ececf1;padding:7px 0}
    .total{font-size:15px;font-weight:800;color:#0f6875}.forecast{color:#7657c8}
    table{width:100%;border-collapse:collapse}td,th{padding:7px;border-bottom:1px solid #ececf1;text-align:left}th{background:#f4f5f8}
    .notice{margin-top:24px;padding:14px;border-radius:12px;background:#f4f5f8;color:#55586b}
  </style></head><body>
  <div class="hero"><div class="brand">CARESUITE+ · MONATSÜBERSICHT</div><h1>${escapePayrollHtml(snapshot.employeeName)}</h1>
  <div class="meta">${month} · Version ${version} · erstellt ${new Date(snapshot.generatedAt).toLocaleString('de-DE')}</div>
  <div class="grid">
   <div class="row"><span>Erfasste Arbeitszeit</span><strong>${formatPayrollMinutes(snapshot.actualWorkMinutes)}</strong></div>
   <div class="row"><span>davon Fahrzeit</span><strong>${formatPayrollMinutes(snapshot.travelMinutes)}</strong></div>
   <div class="row"><span>Urlaub</span><strong>${formatPayrollMinutes(snapshot.vacationMinutes)}</strong></div>
   <div class="row"><span>Krankheit</span><strong>${formatPayrollMinutes(snapshot.sickMinutes)}</strong></div>
   <div class="row"><span>Weitere bezahlte Abwesenheit</span><strong>${formatPayrollMinutes(snapshot.otherPaidAbsenceMinutes)}</strong></div>
   <div class="row"><span>Zeitkonto-Übertrag</span><strong>${formatPayrollMinutes(snapshot.overtimeTransferMinutes)}</strong></div>
  </div></div>
  <h2>Vergütung</h2>
  <div class="row"><span>Bis heute erarbeitetes Brutto</span><strong>${formatPayrollMoney(snapshot.earnedGrossCents)}</strong></div>
  <div class="row forecast"><span>Geplante Einsätze bis Monatsende</span><strong>${formatPayrollMinutes(snapshot.plannedMinutes)}</strong></div>
  <div class="row forecast"><span>Voraussichtliches Monatsbrutto</span><strong>${formatPayrollMoney(snapshot.projectedGrossCents)}</strong></div>
  <div class="row"><span>Genehmigte Auslagen</span><strong>${formatPayrollMoney(snapshot.approvedExpensesCents)}</strong></div>
  <div class="row"><span>Vorschüsse / Abzüge</span><strong>− ${formatPayrollMoney(snapshot.advancesCents + snapshot.deductionsCents)}</strong></div>
  <div class="row total"><span>Voraussichtliche Gesamtauszahlung</span><strong>${formatPayrollMoney(snapshot.projectedTotalPayoutCents)}</strong></div>
  <h2>Genehmigte Auslagen und Erstattungen</h2>
  ${expenseRows ? `<table><thead><tr><th>Datum</th><th>Beschreibung</th><th>Erstattung</th></tr></thead><tbody>${expenseRows}</tbody></table>` : '<p>Keine genehmigten Auslagen in diesem Abrechnungsmonat.</p>'}
  <div class="notice">Geplante Einsätze sind eine Prognose und noch kein endgültig entstandener Vergütungsanspruch. Bruttolohn und Auslagenersatz werden getrennt ausgewiesen. Diese Abrechnungsversion wird nach Bestätigung unveränderbar archiviert.</div>
  </body></html>`;
}
