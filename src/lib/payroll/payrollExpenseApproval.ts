import type { ServiceResult } from '@/types';
import type { PayrollExpenseClaim } from '@/types/modules/payrollMonth';

export type ExpenseApprovalScope = { tenantId: string; employeeId: string; year: number; month: number };
export type ExpenseApprovalItem = {
  claim: PayrollExpenseClaim;
  status: 'approved' | 'partially_approved';
  approvedAmountCents: number;
  officeNote: string | null;
};

export function openPayrollExpenseClaims(claims: readonly PayrollExpenseClaim[], scope: ExpenseApprovalScope): PayrollExpenseClaim[] {
  const period = `${scope.year}-${String(scope.month).padStart(2, '0')}`;
  const seen = new Set<string>();
  return claims.filter(claim => {
    if (seen.has(claim.id) || claim.tenantId !== scope.tenantId || claim.employeeId !== scope.employeeId
      || claim.expenseDate.slice(0, 7) !== period || !['submitted', 'needs_info'].includes(claim.status)) return false;
    seen.add(claim.id);
    return true;
  });
}

/** Validate the complete batch before the first write and preserve edited amounts. */
export function preparePayrollExpenseApproval(
  claims: readonly PayrollExpenseClaim[], scope: ExpenseApprovalScope,
  amounts: Readonly<Record<string, string>>, notes: Readonly<Record<string, string>>,
): ServiceResult<{ items: ExpenseApprovalItem[]; totalCents: number }> {
  const items: ExpenseApprovalItem[] = [];
  for (const claim of openPayrollExpenseClaims(claims, scope)) {
    const raw = amounts[claim.id]?.trim() || (claim.amountCents / 100).toFixed(2);
    const cents = Math.round(Number(raw.replace(',', '.')) * 100);
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw) || !Number.isSafeInteger(cents) || cents < 0
      || !Number.isSafeInteger(claim.amountCents) || cents > claim.amountCents || claim.currency !== 'EUR') {
      return { ok: false, error: `${claim.expenseDate} · ${claim.description}: Bitte einen gültigen EUR-Betrag zwischen 0,00 und dem eingereichten Betrag angeben (höchstens zwei Nachkommastellen).` };
    }
    if (!claim.updatedAt || !Number.isFinite(Date.parse(claim.updatedAt))) {
      return { ok: false, error: `${claim.expenseDate} · ${claim.description}: Der aktuelle Bearbeitungsstand fehlt. Bitte die Monatsdaten neu laden.` };
    }
    items.push({ claim, approvedAmountCents: cents, status: cents < claim.amountCents ? 'partially_approved' : 'approved',
      officeNote: (notes[claim.id] ?? claim.officeNote ?? '').trim() || null });
  }
  return { ok: true, data: { items, totalCents: items.reduce((sum, item) => sum + item.approvedAmountCents, 0) } };
}

export async function approvePayrollExpenses(
  items: readonly ExpenseApprovalItem[],
  save: (item: ExpenseApprovalItem) => Promise<ServiceResult<PayrollExpenseClaim>>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ saved: PayrollExpenseClaim[]; failed: { claim: PayrollExpenseClaim; error: string }[] }> {
  const saved: PayrollExpenseClaim[] = [];
  const failed: { claim: PayrollExpenseClaim; error: string }[] = [];
  const unique = [...new Map(items.map(item => [item.claim.id, item])).values()];
  for (const [index, item] of unique.entries()) {
    try {
      const result = await save(item);
      if (!result.ok) failed.push({ claim: item.claim, error: result.error });
      else if (result.data.id !== item.claim.id || result.data.tenantId !== item.claim.tenantId
        || result.data.employeeId !== item.claim.employeeId || result.data.status !== item.status
        || result.data.approvedAmountCents !== item.approvedAmountCents) {
        failed.push({ claim: item.claim, error: 'Die Genehmigung wurde nicht wie angefordert bestätigt. Bitte aktualisieren und den Beleg prüfen.' });
      } else saved.push(result.data);
    } catch (error) {
      failed.push({ claim: item.claim, error: error instanceof Error ? error.message : 'Die Genehmigung konnte nicht bestätigt werden.' });
    }
    onProgress?.(index + 1, unique.length);
  }
  return { saved, failed };
}
