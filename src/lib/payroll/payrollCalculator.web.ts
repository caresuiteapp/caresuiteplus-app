import { CARESUITE_DOCUMENT_FONT_CSS } from '@/design/fonts/documentFontCss';
import { CARESUITE_FONT_STACK } from '@/design/tokens/fontFamily';
import type {
  PayrollAssignmentTimeLine,
  PayrollExpenseClaim,
  PayrollNextMonthPreview,
  PayrollStatementSnapshot,
} from '@/types/modules/payrollMonth';

/** Optional fields keep already archived snapshots readable. */
export type PayrollWebStatementSnapshot = PayrollStatementSnapshot & {
  reimbursedExpensesCents?: number;
  projectedPaidAbsenceMinutes?: number;
};

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
  /** Future approved paid absences affect the forecast, never accrued actual time. */
  projectedPaidAbsenceMinutes?: number;
  targetWorkMinutes?: number;
  monthlyPlannedMinutes?: number;
  plannedMinutes: number;
  timeAccountBalanceMinutes?: number;
  advancesCents?: number;
  deductionsCents?: number;
  expenses: PayrollExpenseClaim[];
  assignmentTimeLines?: PayrollAssignmentTimeLine[];
  nextMonthPreview?: PayrollNextMonthPreview;
  now?: string;
};

function nonNegative(value: number | null | undefined, label = 'Zahlenwert'): number {
  if (value == null) return 0;
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value))) {
    throw new Error(`${label}: Der gespeicherte Wert ist ungültig. Bitte die Quelldaten prüfen.`);
  }
  return Math.round(value);
}

function safeSum(values: readonly number[], label = 'Summe'): number {
  const result = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(result)) throw new Error(`${label}: Der Wert liegt außerhalb des unterstützten Zahlenbereichs.`);
  return result;
}

function currencyCents(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}: Bitte einen gültigen Betrag hinterlegen.`);
  return nonNegative(Math.round((value + Number.EPSILON * Math.max(1, value)) * 100), label);
}

function integerCents(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label}: Der gespeicherte Centbetrag ist ungültig.`);
  return value;
}

/** Only complete minutes fit under an hours cap; rounding upward would exceed it. */
export function payrollMaxPayoutMinutes(hours: number | null | undefined): number | null {
  if (hours == null) return null;
  if (!Number.isFinite(hours) || hours < 0) throw new Error('Die Auszahlungsgrenze ist ungültig.');
  const exactMinutes = hours * 60;
  const minutes = Math.floor(exactMinutes + Number.EPSILON * Math.max(1, exactMinutes) * 4);
  if (!Number.isSafeInteger(minutes)) throw new Error('Die Auszahlungsgrenze ist zu groß.');
  return minutes;
}

export function moneyFromMinutes(minutes: number, hourlyRateCents: number): number {
  const result = Math.round((nonNegative(minutes, 'Arbeitszeit') / 60) * integerCents(hourlyRateCents, 'Stundenlohn'));
  return integerCents(result, 'Vergütung');
}

export function calculatePayrollTimeAccountBalance(input: {
  actualWorkMinutes: number;
  vacationMinutes?: number;
  sickMinutes?: number;
  otherPaidAbsenceMinutes?: number;
  targetMinutes: number;
}): number {
  return safeSum([
    nonNegative(input.actualWorkMinutes, 'Arbeitszeit'), nonNegative(input.vacationMinutes, 'Urlaubszeit'),
    nonNegative(input.sickMinutes, 'Krankheitszeit'), nonNegative(input.otherPaidAbsenceMinutes, 'Bezahlte Abwesenheit'),
  ]) - nonNegative(input.targetMinutes, 'Vertragliches Soll');
}

export function payrollExpenseTotals(
  expenses: readonly PayrollExpenseClaim[],
  scope?: { employeeId: string; periodYear: number; periodMonth: number },
): { approvedExpensesCents: number; pendingExpensesCents: number; reimbursedExpensesCents: number } {
  const approved: number[] = []; const pending: number[] = []; const reimbursed: number[] = [];
  const seen = new Map<string, PayrollExpenseClaim>();
  for (const expense of expenses) {
    if (!expense.id) throw new Error('Eine Auslage hat keine eindeutige Kennung.');
    const prior = seen.get(expense.id);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(expense)) throw new Error('Eine Auslage liegt mit widersprüchlichen Bearbeitungsständen vor. Bitte aktualisieren.');
      continue;
    }
    seen.set(expense.id, expense);
    if (scope && (expense.employeeId !== scope.employeeId
      || expense.expenseDate.slice(0, 7) !== `${scope.periodYear}-${String(scope.periodMonth).padStart(2, '0')}`)) {
      throw new Error('Eine Auslage gehört nicht zur ausgewählten Person oder zum Abrechnungsmonat.');
    }
    if (expense.currency !== 'EUR') throw new Error('Auslagen mit einer anderen Währung benötigen vor der Abrechnung einen geprüften EUR-Betrag.');
    const amount = integerCents(expense.amountCents, 'Auslage');
    const approvedAmount = expense.approvedAmountCents == null ? null : integerCents(expense.approvedAmountCents, 'Genehmigte Auslage');
    if (approvedAmount != null && approvedAmount > amount) throw new Error('Der genehmigte Auslagenbetrag übersteigt den eingereichten Betrag.');
    if (expense.status === 'partially_approved' && approvedAmount == null) throw new Error('Bei einer teilweise genehmigten Auslage fehlt der genehmigte Betrag.');
    if (expense.status === 'approved' || expense.status === 'partially_approved') approved.push(approvedAmount ?? amount);
    else if (expense.status === 'reimbursed') reimbursed.push(approvedAmount ?? amount);
    else if (expense.status === 'submitted' || expense.status === 'needs_info') pending.push(amount);
  }
  return {
    approvedExpensesCents: safeSum(approved, 'Offene Erstattungen'),
    pendingExpensesCents: safeSum(pending, 'Ungeprüfte Auslagen'),
    reimbursedExpensesCents: safeSum(reimbursed, 'Bereits erstattete Auslagen'),
  };
}

export function calculatePayrollSnapshot(input: PayrollCalculationInput): PayrollWebStatementSnapshot {
  if (!input.employeeId || !Number.isInteger(input.periodYear) || input.periodYear < 1900 || input.periodYear > 9999
    || !Number.isInteger(input.periodMonth) || input.periodMonth < 1 || input.periodMonth > 12) {
    throw new Error('Person oder Abrechnungsmonat ist ungültig.');
  }
  if (input.compensationType !== 'salary' && input.compensationType !== 'hourly') throw new Error('Die Vergütungsart fehlt.');
  const actualWorkMinutes = nonNegative(input.actualWorkMinutes, 'Arbeitszeit');
  const vacationMinutes = nonNegative(input.vacationMinutes, 'Urlaubszeit');
  const sickMinutes = nonNegative(input.sickMinutes, 'Krankheitszeit');
  const otherPaidAbsenceMinutes = nonNegative(input.otherPaidAbsenceMinutes, 'Bezahlte Abwesenheit');
  const projectedPaidAbsenceMinutes = nonNegative(input.projectedPaidAbsenceMinutes, 'Geplante bezahlte Abwesenheit');
  const targetWorkMinutes = nonNegative(input.targetWorkMinutes, 'Vertragliches Soll');
  const plannedMinutes = nonNegative(input.plannedMinutes, 'Offener Einsatzplan');
  const contractualPayableMinutes = safeSum([actualWorkMinutes, vacationMinutes, sickMinutes, otherPaidAbsenceMinutes]);
  const maxPayoutMinutes = payrollMaxPayoutMinutes(input.maxPayoutHours);
  const payableMinutes = maxPayoutMinutes == null ? contractualPayableMinutes : Math.min(contractualPayableMinutes, maxPayoutMinutes);
  const overtimeTransferMinutes = input.overflowToTimeAccount === false ? 0 : contractualPayableMinutes - payableMinutes;
  const amountCents = currencyCents(input.compensationAmount, 'Vergütung');
  const hourlyRateCents = input.compensationType === 'hourly' ? amountCents : 0;
  const fixedSalaryCents = input.compensationType === 'salary' ? amountCents : 0;
  const earnedGrossCents = input.compensationType === 'salary' ? fixedSalaryCents : moneyFromMinutes(payableMinutes, hourlyRateCents);
  const forecastMinutes = safeSum([contractualPayableMinutes, plannedMinutes, projectedPaidAbsenceMinutes]);
  const projectedPayableMinutes = maxPayoutMinutes == null ? forecastMinutes : Math.min(forecastMinutes, maxPayoutMinutes);
  const projectedGrossCents = input.compensationType === 'salary' ? fixedSalaryCents : moneyFromMinutes(projectedPayableMinutes, hourlyRateCents);
  const totals = payrollExpenseTotals(input.expenses, input);
  const advancesCents = integerCents(input.advancesCents ?? 0, 'Vorschüsse');
  const deductionsCents = integerCents(input.deductionsCents ?? 0, 'Abzüge');
  const offsets = safeSum([advancesCents, deductionsCents]);
  const balance = input.timeAccountBalanceMinutes ?? 0;
  if (!Number.isFinite(balance) || !Number.isSafeInteger(Math.round(balance))) throw new Error('Der Zeitkontostand ist ungültig.');
  const generatedAt = input.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('Der Erstellungszeitpunkt ist ungültig.');
  return {
    employeeId: input.employeeId, employeeName: input.employeeName, employeeNumber: input.employeeNumber ?? null,
    periodYear: input.periodYear, periodMonth: input.periodMonth, compensationType: input.compensationType,
    hourlyRateCents, fixedSalaryCents, maxPayoutMinutes, actualWorkMinutes,
    travelMinutes: Math.min(actualWorkMinutes, nonNegative(input.travelMinutes, 'Fahrzeit')),
    vacationMinutes, sickMinutes, otherPaidAbsenceMinutes, projectedPaidAbsenceMinutes,
    targetWorkMinutes, creditedActualMinutes: contractualPayableMinutes,
    targetActualDifferenceMinutes: contractualPayableMinutes - targetWorkMinutes,
    monthlyPlannedMinutes: nonNegative(input.monthlyPlannedMinutes ?? plannedMinutes, 'Monatsplan'),
    plannedMinutes, payableMinutes, overtimeTransferMinutes, timeAccountBalanceMinutes: Math.round(balance),
    earnedGrossCents, projectedGrossCents, ...totals, advancesCents, deductionsCents,
    payoutGrossCents: Math.max(0, earnedGrossCents - offsets),
    projectedTotalPayoutCents: Math.max(0, safeSum([projectedGrossCents, totals.approvedExpensesCents]) - offsets),
    generatedAt, expenseClaims: [...new Map(input.expenses.map(expense => [expense.id, expense])).values()],
    assignmentTimeLines: input.assignmentTimeLines ?? [], nextMonthPreview: input.nextMonthPreview,
  };
}

export const formatPayrollMoney = (cents: number): string => Number.isFinite(cents)
  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100) : '—';

export function formatPayrollMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return '—';
  const rounded = Math.round(minutes); const absolute = Math.abs(rounded);
  return `${rounded < 0 ? '−' : ''}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')} Std.`;
}

export function formatPayrollBalanceMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return '—';
  const rounded = Math.round(minutes); const absolute = Math.abs(rounded);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'} ${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')} Std.`;
}

export function escapePayrollHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const timeFormatter = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const monthFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
const dateTimeFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const formatDate = (value: string) => {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? dateFormatter.format(parsed) : 'Datum fehlt';
};
const formatTime = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? timeFormatter.format(parsed) : '—';
};
const monthLabel = (year: number, month: number) => monthFormatter.format(new Date(Date.UTC(year, month - 1, 1, 12)));
const statusLabels: Record<string, string> = {
  planned: 'Geplant', confirmed: 'Bestätigt', assigned: 'Zugewiesen', in_progress: 'Läuft', started: 'Begonnen',
  completed: 'Abgeschlossen', finished: 'Beendet', ended: 'Beendet', documentation_open: 'Dokumentation offen',
  signature_open: 'Unterschrift offen', cancelled: 'Abgesagt', canceled: 'Abgesagt', no_show: 'Nicht erschienen',
  pending: 'Prüfung offen', open: 'Offen', approved: 'Freigegeben', partially_approved: 'Teilweise genehmigt',
  rejected: 'Abgelehnt', clarification: 'Rückfrage', corrected: 'Korrigiert', locked: 'Gesperrt', exported: 'Exportiert',
  submitted: 'Eingereicht', needs_info: 'Rückfrage offen', reimbursed: 'Bereits erstattet', draft: 'Entwurf',
  scheduled: 'Geplant', paid: 'Bezahlt', superseded: 'Ersetzt', changed_after_export: 'Nach Export geändert',
};

/** Fixed screenshot pages need bounded fragments, not hidden overflow or a fixed row count. */
export function splitPayrollPdfText(value: string, maxCharacters: number): string[] {
  if (!Number.isFinite(maxCharacters) || maxCharacters < 1) throw new Error('Die PDF-Zeilenbreite ist ungültig.');
  const characters = Array.from(value.replace(/\r\n?/g, '\n'));
  if (characters.length === 0) return [''];
  const parts: string[] = [];
  const width = Math.max(1, Math.floor(maxCharacters));
  for (let offset = 0; offset < characters.length; offset += width) parts.push(characters.slice(offset, offset + width).join(''));
  return parts;
}

type PdfRow = { html: string; height: number };
function packRows(rows: PdfRow[], maxHeight = 810): PdfRow[][] {
  const pages: PdfRow[][] = []; let page: PdfRow[] = []; let height = 0;
  for (const row of rows) {
    if (page.length && height + row.height > maxHeight) { pages.push(page); page = []; height = 0; }
    page.push(row); height += row.height;
  }
  if (page.length) pages.push(page);
  return pages;
}

function textLines(value: string, width: number): string[] {
  // A line contains a bounded number of Unicode characters, including long unbroken words.
  return value.split('\n').flatMap(line => splitPayrollPdfText(line, width));
}
const escapedLines = (lines: string[]) => lines.map(escapePayrollHtml).join('<br>');
const statusLabel = (value: string | null) => statusLabels[value ?? ''] ?? value ?? 'Nicht angegeben';

function assignmentRows(lines: PayrollAssignmentTimeLine[], includeActual: boolean): PdfRow[] {
  return lines.flatMap(line => {
    const labelLines = textLines(line.clientLabel ?? 'Ohne Klientenzuordnung', includeActual ? 14 : 25);
    const titleLines = textLines(line.assignmentTitle, includeActual ? 14 : 25);
    const details = [...labelLines, ...titleLines];
    const status = textLines(statusLabel(line.status), includeActual ? 8 : 12);
    const fragments = Math.max(1, Math.ceil(details.length / 6), Math.ceil(status.length / 6));
    return Array.from({ length: fragments }, (_, index) => {
      const actualPresent = Boolean(line.actualStartAt || line.actualEndAt || line.actualMinutes > 0);
      const currentDetails = details.slice(index * 6, index * 6 + 6);
      const currentStatus = status.slice(index * 6, index * 6 + 6);
      const primary = index === 0;
      const timeCell = (start: string | null, end: string | null, minutes: number, present = true) => present
        ? `${formatTime(start)}–${formatTime(end)}<br><span class="muted">${formatPayrollMinutes(minutes)}</span>` : '—';
      return {
        height: 24 + Math.max(3, currentDetails.length, currentStatus.length) * 17,
        html: `<tr><td>${primary ? formatDate(line.workDate) : '<span class="muted">Fortsetzung</span>'}</td>
          <td class="long-text">${escapedLines(currentDetails)}</td>
          <td>${primary ? timeCell(line.plannedStartAt, line.plannedEndAt, line.plannedMinutes) : ''}</td>
          ${includeActual ? `<td>${primary ? timeCell(line.actualStartAt, line.actualEndAt, line.actualMinutes, actualPresent) : ''}</td>
          <td>${primary ? formatPayrollMinutes(line.travelMinutes) : ''}</td>
          <td>${primary && actualPresent ? formatPayrollBalanceMinutes(line.differenceMinutes) : primary ? '—' : ''}</td>` : ''}
          <td>${escapedLines(currentStatus)}</td></tr>`,
      };
    });
  });
}

function expenseRows(claims: PayrollExpenseClaim[]): PdfRow[] {
  return claims.flatMap(claim => {
    const details = textLines(claim.description, 24);
    const purpose = claim.businessPurpose.trim() ? textLines(`Zweck: ${claim.businessPurpose}`, 24) : [];
    const allLines = [...details, ...purpose];
    const fragments = Math.max(1, Math.ceil(allLines.length / 7));
    return Array.from({ length: fragments }, (_, index) => {
      const current = allLines.slice(index * 7, index * 7 + 7);
      const primary = index === 0;
      const approved = ['approved', 'partially_approved', 'reimbursed'].includes(claim.status);
      return {
        height: 24 + Math.max(3, current.length) * 17,
        html: `<tr><td>${primary ? formatDate(claim.expenseDate) : '<span class="muted">Fortsetzung</span>'}</td>
          <td class="long-text">${escapedLines(current)}</td>
          <td>${primary ? escapePayrollHtml(statusLabel(claim.status)) : ''}</td>
          <td class="number">${primary ? formatPayrollMoney(claim.amountCents) : ''}</td>
          <td class="number">${primary && approved ? formatPayrollMoney(claim.approvedAmountCents ?? claim.amountCents) : primary ? '—' : ''}</td></tr>`,
      };
    });
  });
}

function row(label: string, value: string, extra = ''): string {
  return `<div class="summary-row ${extra}"><span>${label}</span><strong>${value}</strong></div>`;
}

export function buildPayrollStatementHtml(snapshot: PayrollWebStatementSnapshot, version: number): string {
  if (!Number.isInteger(version) || version < 1) throw new Error('Die Abrechnungsversion ist ungültig.');
  const month = monthLabel(snapshot.periodYear, snapshot.periodMonth);
  const generatedDate = new Date(snapshot.generatedAt);
  if (!Number.isFinite(generatedDate.getTime())) throw new Error('Der Erstellungszeitpunkt fehlt.');
  const expenseTotals = payrollExpenseTotals(snapshot.expenseClaims, snapshot);
  const expenses = [...new Map(snapshot.expenseClaims.map(claim => [claim.id, claim])).values()];
  const credited = snapshot.creditedActualMinutes ?? safeSum([snapshot.actualWorkMinutes, snapshot.vacationMinutes, snapshot.sickMinutes, snapshot.otherPaidAbsenceMinutes]);
  const target = snapshot.targetWorkMinutes;
  const nameLines = textLines(snapshot.employeeName, 26);
  const employeeNumberLines = textLines(snapshot.employeeNumber ?? 'Nicht hinterlegt', 55);
  const pages: { title: string; subtitle: string; content: string }[] = [];
  const headerName = escapedLines(nameLines.slice(0, 3));
  const primaryNumber = escapedLines(employeeNumberLines.slice(0, 2));
  pages.push({ title: 'Gehaltsübersicht', subtitle: `${month} · Version ${version}`, content: `
    <div class="identity"><h1>${headerName}</h1><p>Personalnummer: ${primaryNumber}</p></div>
    <div class="notice">Diese Übersicht zeigt Bruttowerte und Auslagen. Sie ersetzt keine Lohnabrechnung und weist keinen Nettoauszahlungsbetrag aus. Geplante Zeiten sind eine Prognose.</div>
    <div class="columns"><section><h2>Arbeitszeit</h2>
      ${row('Erfasste Arbeitszeit', formatPayrollMinutes(snapshot.actualWorkMinutes))}
      ${row('Davon Fahrzeit', formatPayrollMinutes(snapshot.travelMinutes))}
      ${row('Angerechneter Urlaub', formatPayrollMinutes(snapshot.vacationMinutes))}
      ${row('Angerechnete Krankheit', formatPayrollMinutes(snapshot.sickMinutes))}
      ${row('Weitere bezahlte Abwesenheit', formatPayrollMinutes(snapshot.otherPaidAbsenceMinutes))}
      ${row('Anrechenbares Ist', formatPayrollMinutes(credited), 'strong')}
      ${row('Vertragliches Monatssoll', target == null ? 'Nicht hinterlegt' : formatPayrollMinutes(target))}
      ${row('Soll-/Ist-Differenz', target == null ? '—' : formatPayrollBalanceMinutes(snapshot.targetActualDifferenceMinutes ?? credited - target))}
      ${row('Offener Einsatzplan', formatPayrollMinutes(snapshot.plannedMinutes), 'forecast')}
      ${row('Geplante bezahlte Abwesenheit', formatPayrollMinutes(snapshot.projectedPaidAbsenceMinutes ?? 0), 'forecast')}
      ${row('Vorgesehener Übertrag', formatPayrollMinutes(snapshot.overtimeTransferMinutes))}
    </section><section><h2>Vergütung und Auslagen</h2>
      ${snapshot.compensationType === 'hourly' ? row('Stundenlohn brutto', formatPayrollMoney(snapshot.hourlyRateCents)) : ''}
      ${row(snapshot.compensationType === 'salary' ? 'Festgehalt des Monats' : 'Brutto aus erfasster Zeit und Abwesenheit', formatPayrollMoney(snapshot.earnedGrossCents), 'strong')}
      ${row('Voraussichtliches Monatsbrutto', formatPayrollMoney(snapshot.projectedGrossCents), 'forecast')}
      ${row('Genehmigte Auslagen, noch offen', formatPayrollMoney(expenseTotals.approvedExpensesCents))}
      ${row('Bereits erstattete Auslagen', formatPayrollMoney(expenseTotals.reimbursedExpensesCents))}
      ${row('Auslagen zur Prüfung', formatPayrollMoney(expenseTotals.pendingExpensesCents))}
      ${row('Vorschüsse', formatPayrollMoney(snapshot.advancesCents))}
      ${row('Weitere Abzüge', formatPayrollMoney(snapshot.deductionsCents))}
      ${row('Prognose vor Lohnabgaben', formatPayrollMoney(snapshot.projectedTotalPayoutCents), 'total')}
      <p class="explanation">Monatsbrutto + noch offene genehmigte Auslagen − Vorschüsse und Abzüge. Bereits erstattete Auslagen werden nicht erneut hinzugerechnet.</p>
    </section></div>
    <div class="notice subtle">${snapshot.compensationType === 'salary' ? 'Das Festgehalt wird als vereinbarter Monatsbetrag dargestellt, nicht anteilig als bereits erarbeiteter Verdienst. ' : ''}Fahrzeit ist Teil der erfassten Arbeitszeit und wird nicht nochmals addiert. Vorgesehene Überträge sind noch keine Zeitkontobuchung. Zeiten werden in Europe/Berlin angezeigt.</div>` });
  const identityRemainder = [...nameLines.slice(3), ...employeeNumberLines.slice(2)];
  if (identityRemainder.length) {
    for (let index = 0; index < identityRemainder.length; index += 40) pages.push({ title: 'Personendaten · Fortsetzung', subtitle: month, content: `<p class="long-text">${escapedLines(identityRemainder.slice(index, index + 40))}</p>` });
  }
  const current = packRows(assignmentRows(snapshot.assignmentTimeLines ?? [], true));
  const assignmentHead = '<colgroup><col style="width:12%"><col style="width:23%"><col style="width:14%"><col style="width:14%"><col style="width:10%"><col style="width:13%"><col style="width:14%"></colgroup><thead><tr><th>Datum</th><th>Klient:in / Einsatz</th><th>Plan</th><th>Erfasst</th><th>Fahrt</th><th>Differenz</th><th>Status</th></tr></thead>';
  if (!current.length) pages.push({ title: 'Einsätze und erfasste Arbeitszeiten', subtitle: month, content: '<div class="empty">Für diesen Monat sind keine Einsatz- oder Zeiterfassungszeilen gespeichert.</div>' });
  current.forEach((entries, index) => pages.push({ title: 'Einsätze und erfasste Arbeitszeiten', subtitle: `${month}${current.length > 1 ? ` · ${index + 1}/${current.length}` : ''}`, content: `<p class="explanation">Die Zeilen geben den gespeicherten Stand wieder. Ein Einsatzstatus allein bestätigt keine Arbeitszeitfreigabe. Bei noch nicht erfassten Zeiten bleibt die Differenz offen.</p><table>${assignmentHead}<tbody>${entries.map(entry => entry.html).join('')}</tbody></table>` }));
  const expensesByPage = packRows(expenseRows(expenses));
  expensesByPage.forEach((entries, index) => pages.push({ title: 'Auslagen und Erstattungen', subtitle: `${month}${expensesByPage.length > 1 ? ` · ${index + 1}/${expensesByPage.length}` : ''}`, content: `<p class="explanation">Eingereicht, genehmigt und bereits erstattet werden getrennt dargestellt. Die steuerliche Behandlung ist anhand der Belege zu prüfen.</p><table><colgroup><col style="width:13%"><col style="width:40%"><col style="width:19%"><col style="width:14%"><col style="width:14%"></colgroup><thead><tr><th>Datum</th><th>Beschreibung / Zweck</th><th>Status</th><th>Eingereicht</th><th>Genehmigt</th></tr></thead><tbody>${entries.map(entry => entry.html).join('')}</tbody></table>` }));
  const next = snapshot.nextMonthPreview;
  if (next) {
    const nextMonth = monthLabel(next.periodYear, next.periodMonth);
    const nextPages = packRows(assignmentRows(next.assignments, false));
    if (!nextPages.length) pages.push({ title: 'Vorschau auf den Folgemonat', subtitle: nextMonth, content: '<div class="empty">Zum Erstellungszeitpunkt sind keine Einsätze für den Folgemonat gespeichert.</div>' });
    nextPages.forEach((entries, index) => pages.push({ title: 'Vorschau auf den Folgemonat', subtitle: `${nextMonth}${nextPages.length > 1 ? ` · ${index + 1}/${nextPages.length}` : ''}`, content: `<p class="explanation">Gespeicherter Einsatzplan: ${formatPayrollMinutes(next.totalPlannedMinutes)}. Diese Vorschau enthält keine bereits verdiente Vergütung.</p><table><colgroup><col style="width:14%"><col style="width:43%"><col style="width:23%"><col style="width:20%"></colgroup><thead><tr><th>Datum</th><th>Klient:in / Einsatz</th><th>Geplante Zeit</th><th>Status</th></tr></thead><tbody>${entries.map(entry => entry.html).join('')}</tbody></table>` }));
  }
  const rendered = pages.map((page, index) => `<main class="payroll-pdf-page" data-pdf-page="${index + 1}">
    <header><span class="brand">CARESUITE+ · MONATSÜBERSICHT</span><span>${escapePayrollHtml(dateTimeFormatter.format(generatedDate))}</span></header>
    <div class="page-heading"><h2>${page.title}</h2><p>${escapePayrollHtml(page.subtitle)}</p></div>
    <div class="pdf-content">${page.content}</div><footer>Bruttowerte · ${escapePayrollHtml(month)} · Version ${version} · Seite ${index + 1} von ${pages.length}</footer>
  </main>`).join('');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Gehaltsübersicht ${escapePayrollHtml(month)}</title><style>${CARESUITE_DOCUMENT_FONT_CSS}
    @page{size:A4;margin:0}.payroll-pdf-page,.payroll-pdf-page *{box-sizing:border-box}.payroll-pdf-page{position:relative;width:794px;height:1123px;padding:36px 40px 48px;background:#fff;color:#142c49;font-family:${CARESUITE_FONT_STACK};font-size:11px;line-height:1.5;break-after:page}.payroll-pdf-page:last-child{break-after:auto}
    .payroll-pdf-page header{display:flex;justify-content:space-between;gap:14px;padding-bottom:12px;border-bottom:2px solid #cfe1f6;font-size:9px;color:#456079}.payroll-pdf-page .brand{font-weight:800;letter-spacing:.5px;color:#185b9b}.payroll-pdf-page .page-heading{margin:17px 0 14px}.payroll-pdf-page .page-heading h2{margin:0;font-size:20px;line-height:1.25;color:#173b66}.payroll-pdf-page .page-heading p{margin:5px 0 0;color:#52677f;font-size:11px}
    .payroll-pdf-page .identity{padding:16px 18px;border:1px solid #cfdeee;background:#f1f7fd;border-radius:12px;margin-bottom:14px}.payroll-pdf-page h1{margin:0;font-size:23px;line-height:1.3;overflow-wrap:anywhere}.payroll-pdf-page .identity p{margin:6px 0 0;color:#435f7a}.payroll-pdf-page .columns{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:16px 0}.payroll-pdf-page section h2{font-size:14px;margin:0 0 10px;color:#1c4c80}
    .payroll-pdf-page .summary-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #e4ebf2;padding:7px 0}.payroll-pdf-page .summary-row span{flex:1}.payroll-pdf-page .summary-row strong{text-align:right;white-space:nowrap}.payroll-pdf-page .strong{color:#153f6e}.payroll-pdf-page .forecast{color:#573a90}.payroll-pdf-page .total{padding:12px 9px;margin-top:6px;border:1px solid #bbd5ee;background:#edf5fe;border-radius:8px;color:#114c88;font-weight:700}
    .payroll-pdf-page .notice{padding:11px 13px;background:#edf4fc;border:1px solid #d6e3f3;border-radius:8px;line-height:1.5}.payroll-pdf-page .subtle{background:#f7f9fc;color:#405872}.payroll-pdf-page .explanation{margin:8px 0 12px;color:#48617c;font-size:10px;line-height:1.5}.payroll-pdf-page .muted{color:#52677f;font-size:10px}.payroll-pdf-page .long-text{overflow-wrap:anywhere;word-break:break-word}
    .payroll-pdf-page table{width:100%;border-collapse:collapse;table-layout:fixed}.payroll-pdf-page th{font-weight:700;background:#eaf2fb;color:#1b4778}.payroll-pdf-page td,.payroll-pdf-page th{padding:9px 5px;border-bottom:1px solid #dfe8f1;text-align:left;vertical-align:top;overflow-wrap:anywhere}.payroll-pdf-page td{line-height:17px}.payroll-pdf-page .number{text-align:right}.payroll-pdf-page tr{break-inside:avoid}.payroll-pdf-page footer{position:absolute;left:40px;right:40px;bottom:19px;border-top:1px solid #dbe5ef;padding-top:7px;text-align:right;font-size:9px;color:#52677f}.payroll-pdf-page .empty{padding:18px;background:#f3f7fb;border:1px solid #e0e9f2;border-radius:10px;color:#48617c}
  </style></head><body>${rendered}</body></html>`;
}
