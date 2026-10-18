import type { PayrollEmployeeMonth, PayrollExpenseClaim } from '@/types/modules/payrollMonth';
import type { PayrollOfficePreviewAvailability } from '@/lib/payroll/payrollOfficeReadModel.web';

export type PayrollStatusFilter = 'all' | 'needs_review' | 'not_published' | 'published' | 'confirmed' | 'rejected' | 'blocked';
export type PayrollSort = 'name' | 'gross' | 'expenses';
export type PayrollDetailTab = 'overview' | 'times' | 'expenses' | 'uploads' | 'statements' | 'next';
export type PayrollWorkspaceEmployee = PayrollEmployeeMonth & { calculationReady?: boolean; blockers?: string[]; warnings?: string[]; unapprovedEntryCount?: number; preview?: PayrollOfficePreviewAvailability };
export const payrollStatementLabels: Record<string, string> = { draft: 'Entwurf', published: 'Antwort ausstehend', confirmed: 'Bestätigt', rejected: 'Abgelehnt', superseded: 'Ersetzt', locked: 'Gesperrt', paid: 'Ausgezahlt' };
export const payrollExpenseLabels: Record<string, string> = { draft: 'Entwurf', submitted: 'Eingereicht', needs_info: 'Rückfrage offen', approved: 'Genehmigt', partially_approved: 'Teilweise genehmigt', rejected: 'Abgelehnt', reimbursed: 'Erstattet' };
export const queryText = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
export const validPayrollMonth = (value: string) => /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value);
export const payrollStatusFilter = (value: string): PayrollStatusFilter => ['needs_review', 'not_published', 'published', 'confirmed', 'rejected', 'blocked'].includes(value) ? value as PayrollStatusFilter : 'all';
export const payrollSort = (value: string): PayrollSort => value === 'gross' || value === 'expenses' ? value : 'name';
export const payrollDetailTab = (value: string): PayrollDetailTab => ['times', 'expenses', 'uploads', 'statements', 'next'].includes(value) ? value as PayrollDetailTab : 'overview';
export const openExpense = (claim: PayrollExpenseClaim) => claim.status === 'submitted' || claim.status === 'needs_info';
export const pendingExpenses = (row: PayrollEmployeeMonth) => row.expenseClaims.filter(openExpense).length;
export const payrollInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'MA';
export const payrollTone = (status: string | null | undefined): 'good' | 'warning' | 'bad' | 'blue' | 'muted' => ['confirmed', 'paid', 'approved', 'reimbursed'].includes(status ?? '') ? 'good' : status === 'rejected' ? 'bad' : ['needs_info', 'needs_clarification', 'pending_review', 'corrected', 'partially_approved'].includes(status ?? '') ? 'warning' : ['published', 'submitted', 'locked'].includes(status ?? '') ? 'blue' : 'muted';
export function selectPayrollEmployees<T extends PayrollWorkspaceEmployee>(rows: readonly T[], filters: { search: string; status: PayrollStatusFilter; sort: PayrollSort }): T[] {
  const search = filters.search.trim().toLocaleLowerCase('de-DE');
  return rows.filter(row => {
    if (search && !`${row.employeeName} ${row.employeeNumber ?? ''}`.toLocaleLowerCase('de-DE').includes(search)) return false;
    const status = row.latestStatement?.status;
    if (filters.status === 'needs_review') return pendingExpenses(row) > 0 || (row.unapprovedEntryCount ?? 0) > 0 || status === 'rejected' || (row.blockers?.length ?? 0) > 0;
    if (filters.status === 'not_published') return !status || status === 'draft' || status === 'superseded';
    if (filters.status === 'confirmed') return status === 'confirmed' || status === 'locked' || status === 'paid';
    if (filters.status === 'blocked') return row.calculationReady === false || (row.blockers?.length ?? 0) > 0;
    return filters.status === 'all' || status === filters.status;
  }).sort((a, b) => {
    const order = filters.sort === 'gross' ? (a.preview?.grossAvailable ? a.projectedGrossCents : -1) - (b.preview?.grossAvailable ? b.projectedGrossCents : -1) : filters.sort === 'expenses' ? pendingExpenses(a) - pendingExpenses(b) : 0;
    return -order || a.employeeName.localeCompare(b.employeeName, 'de-DE', { sensitivity: 'base' }) || a.employeeId.localeCompare(b.employeeId);
  });
}
export function payrollWorkspaceTotals(rows: readonly PayrollWorkspaceEmployee[]) {
  const gross = rows.filter(row => row.preview?.grossAvailable);
  const expenses = rows.filter(row => row.preview?.expensesAvailable);
  return { complete: gross.length === rows.length, totalCount: rows.length, grossCount: gross.length, expenseCount: expenses.length,
    provisional: rows.some(row => row.preview?.provisional && (row.preview.grossAvailable || row.preview.expensesAvailable)),
    earned: gross.reduce((sum, row) => sum + row.earnedGrossCents, 0), projected: gross.reduce((sum, row) => sum + row.projectedGrossCents, 0),
    expenses: expenses.reduce((sum, row) => sum + row.approvedExpensesCents, 0), pending: rows.reduce((sum, row) => sum + pendingExpenses(row), 0),
    confirmed: rows.filter(row => ['confirmed', 'locked', 'paid'].includes(row.latestStatement?.status ?? '')).length };
}
export function payrollTotalHint(available: number, total: number, provisional: boolean, fullHint: string): string {
  if (!available && total) return `Keine berechenbaren Werte · 0/${total} Personen`;
  if (available < total) return `Teilsumme · ${available}/${total} Personen${provisional ? ' · vorläufig' : ''}`;
  return provisional ? `Vorläufig · ${available}/${total} Personen` : fullHint;
}
export function validatePayrollExpenseDraft(claim: PayrollExpenseClaim, amount: string, note: string, status: 'approved' | 'rejected' | 'needs_info') {
  const raw = amount.trim(); const cents = Math.round(Number(raw.replace(',', '.')) * 100); const trimmedNote = note.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw) || !Number.isSafeInteger(cents) || cents < 0 || cents > claim.amountCents || claim.currency !== 'EUR') return { ok: false as const, error: 'Bitte einen EUR-Betrag zwischen 0,00 und dem eingereichten Betrag mit höchstens zwei Nachkommastellen eingeben.' };
  if (!claim.updatedAt || !Number.isFinite(Date.parse(claim.updatedAt))) return { ok: false as const, error: 'Der aktuelle Bearbeitungsstand fehlt. Bitte die Monatsdaten neu laden.' };
  if (trimmedNote.length < 5 && (status !== 'approved' || cents < claim.amountCents)) return { ok: false as const, error: 'Bitte begründen Sie die Rückfrage, Ablehnung oder Kürzung im Prüfvermerk mit mindestens fünf Zeichen.' };
  return { ok: true as const, approvedAmountCents: cents, officeNote: trimmedNote || null, status: status === 'approved' && cents < claim.amountCents ? 'partially_approved' as const : status };
}
export function payrollDraftsDirty(claims: readonly PayrollExpenseClaim[], amounts: Readonly<Record<string, string>>, notes: Readonly<Record<string, string>>): boolean {
  return claims.some(claim => (amounts[claim.id] !== undefined && amounts[claim.id] !== (claim.amountCents / 100).toFixed(2).replace('.', ',')) || (notes[claim.id] !== undefined && notes[claim.id] !== (claim.officeNote ?? '')));
}
