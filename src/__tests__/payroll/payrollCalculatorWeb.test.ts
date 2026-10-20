import { describe, expect, it } from 'vitest';
import {
  buildPayrollStatementHtml, calculatePayrollSnapshot, calculatePayrollTimeAccountBalance,
  formatPayrollBalanceMinutes, formatPayrollMinutes, formatPayrollMoney, moneyFromMinutes,
  payrollExpenseTotals, payrollMaxPayoutMinutes, splitPayrollPdfText,
} from '@/lib/payroll/payrollCalculator.web';
import { resolvePayrollMaxPayoutHours } from '@/lib/payroll/payrollPayoutPolicy.web';
import type { PayrollAssignmentTimeLine, PayrollExpenseClaim } from '@/types/modules/payrollMonth';

const base = {
  employeeId: 'employee-1', employeeName: 'Alex Beispiel', employeeNumber: 'MA-100',
  periodYear: 2026, periodMonth: 10, compensationType: 'hourly' as const,
  compensationAmount: 20, maxPayoutHours: null, overflowToTimeAccount: true,
  actualWorkMinutes: 600, travelMinutes: 60, vacationMinutes: 120, sickMinutes: 0,
  otherPaidAbsenceMinutes: 0, plannedMinutes: 180, projectedPaidAbsenceMinutes: 60,
  targetWorkMinutes: 1_200, timeAccountBalanceMinutes: -480,
  expenses: [] as PayrollExpenseClaim[], now: '2026-10-18T04:00:00.000Z',
};
function expense(overrides: Partial<PayrollExpenseClaim> = {}): PayrollExpenseClaim {
  return {
    id: 'expense-1', tenantId: 'tenant-1', employeeId: base.employeeId,
    expenseDate: '2026-10-15', category: 'public_transport', description: 'Ticket',
    amountCents: 1_000, approvedAmountCents: null, currency: 'EUR', assignmentId: null,
    clientId: null, paymentMethod: null, receiptNumber: null, receiptPath: null,
    mileageKm: null, mileageRateCents: null, origin: null, destination: null,
    vehicleLabel: null, businessPurpose: 'Kundenbesuch', taxTreatment: 'reimbursement',
    status: 'submitted', officeNote: null, rejectionReason: null, submittedAt: base.now,
    reviewedAt: null, createdAt: base.now, updatedAt: base.now, ...overrides,
  };
}
function assignment(overrides: Partial<PayrollAssignmentTimeLine> = {}): PayrollAssignmentTimeLine {
  return {
    assignmentId: 'assignment-1', workDate: '2026-10-15', clientLabel: 'Klient Beispiel',
    assignmentTitle: 'Betreuung', plannedStartAt: '2026-10-15T08:00:00Z', plannedEndAt: '2026-10-15T10:00:00Z',
    actualStartAt: '2026-10-15T08:00:00Z', actualEndAt: '2026-10-15T10:15:00Z',
    plannedMinutes: 120, actualMinutes: 135, travelMinutes: 15, differenceMinutes: 15,
    status: 'completed', ...overrides,
  };
}

describe('Office Web payroll calculations', () => {
  it('keeps actual, future paid absence and visit forecast separate', () => {
    const result = calculatePayrollSnapshot(base);
    expect(result.creditedActualMinutes).toBe(720);
    expect(result.payableMinutes).toBe(720);
    expect(result.earnedGrossCents).toBe(24_000);
    expect(result.projectedGrossCents).toBe(32_000);
    expect(result.plannedMinutes).toBe(180);
    expect(result.projectedPaidAbsenceMinutes).toBe(60);
    expect(result.targetActualDifferenceMinutes).toBe(-480);
  });
  it('does not add travel to actual work twice', () => {
    const result = calculatePayrollSnapshot({ ...base, travelMinutes: 900 });
    expect(result.actualWorkMinutes).toBe(600);
    expect(result.travelMinutes).toBe(600);
    expect(result.earnedGrossCents).toBe(24_000);
  });
  it('floors fractional-minute caps so the rounded gross stays below the reference', () => {
    const hours = resolvePayrollMaxPayoutHours({ periodYear: 2026, employmentType: 'mini_job', compensationType: 'hourly', compensationAmount: 13.9, configuredMaxPayoutHours: null });
    const result = calculatePayrollSnapshot({ ...base, compensationAmount: 13.9, actualWorkMinutes: 5_000, maxPayoutHours: hours });
    expect(result.payableMinutes).toBe(2_602);
    expect(result.earnedGrossCents).toBe(60_280);
    expect(result.earnedGrossCents).toBeLessThanOrEqual(60_300);
    expect(result.overtimeTransferMinutes).toBe(2_518);
  });
  it('preserves zero cap and exact whole-minute values', () => {
    expect(payrollMaxPayoutMinutes(40.2)).toBe(2_412);
    expect(payrollMaxPayoutMinutes(0)).toBe(0);
    const result = calculatePayrollSnapshot({ ...base, maxPayoutHours: 0 });
    expect(result.payableMinutes).toBe(0);
    expect(result.projectedGrossCents).toBe(0);
    expect(result.targetWorkMinutes).toBe(1_200);
  });
  it('does not fabricate an automatic transfer when it is disabled', () => {
    const result = calculatePayrollSnapshot({ ...base, maxPayoutHours: 1, overflowToTimeAccount: false });
    expect(result.payableMinutes).toBe(60);
    expect(result.overtimeTransferMinutes).toBe(0);
    expect(result.timeAccountBalanceMinutes).toBe(-480);
  });
  it('keeps fixed monthly salary independent of planned hours', () => {
    const result = calculatePayrollSnapshot({ ...base, compensationType: 'salary', compensationAmount: 3_250, actualWorkMinutes: 0 });
    expect(result.earnedGrossCents).toBe(325_000);
    expect(result.projectedGrossCents).toBe(325_000);
    expect(buildPayrollStatementHtml(result, 1)).toContain('Festgehalt des Monats');
    expect(buildPayrollStatementHtml(result, 1)).not.toContain('Bis heute erarbeitetes Brutto');
  });
  it('keeps reimbursed expenses visible without paying them a second time', () => {
    const result = calculatePayrollSnapshot({ ...base, expenses: [
      expense({ status: 'approved', approvedAmountCents: 900 }),
      expense({ id: 'paid', status: 'reimbursed', approvedAmountCents: 800 }),
      expense({ id: 'part', status: 'partially_approved', approvedAmountCents: 100 }),
      expense({ id: 'pending', status: 'needs_info', amountCents: 200 }),
      expense({ id: 'draft', status: 'draft', amountCents: 500 }),
    ] });
    expect(result.approvedExpensesCents).toBe(1_000);
    expect(result.reimbursedExpensesCents).toBe(800);
    expect(result.pendingExpensesCents).toBe(200);
    expect(result.projectedTotalPayoutCents).toBe(33_000);
    expect(result.expenseClaims).toHaveLength(5);
  });
  it('keeps zero partial approval and deducts advances once', () => {
    const result = calculatePayrollSnapshot({ ...base, advancesCents: 1_000, deductionsCents: 500,
      expenses: [expense({ status: 'partially_approved', approvedAmountCents: 0 })] });
    expect(result.approvedExpensesCents).toBe(0);
    expect(result.payoutGrossCents).toBe(22_500);
    expect(result.projectedTotalPayoutCents).toBe(30_500);
  });
  it('deduplicates identical rows but rejects conflicting saved revisions', () => {
    const row = expense({ status: 'approved' });
    expect(payrollExpenseTotals([row, row]).approvedExpensesCents).toBe(1_000);
    expect(() => payrollExpenseTotals([row, { ...row, approvedAmountCents: 500 }])).toThrow('widersprüchlichen');
  });
  it.each([
    { patch: { compensationAmount: Number.NaN }, label: 'Vergütung' },
    { patch: { maxPayoutHours: Number.POSITIVE_INFINITY }, label: 'Auszahlungsgrenze' },
    { patch: { actualWorkMinutes: -1 }, label: 'Arbeitszeit' },
    { patch: { timeAccountBalanceMinutes: Number.NaN }, label: 'Zeitkontostand' },
    { patch: { advancesCents: 1.5 }, label: 'Centbetrag' },
  ])('rejects invalid saved numbers: $label', ({ patch, label }) => {
    expect(() => calculatePayrollSnapshot({ ...base, ...patch })).toThrow(label);
  });
  it.each([
    { patch: { currency: 'USD' }, label: 'Währung' },
    { patch: { employeeId: 'different' }, label: 'Person' },
    { patch: { expenseDate: '2026-09-30' }, label: 'Abrechnungsmonat' },
    { patch: { status: 'partially_approved' as const, approvedAmountCents: null }, label: 'fehlt' },
    { patch: { approvedAmountCents: 1_001 }, label: 'übersteigt' },
  ])('rejects mismatching or incomplete expenses: $label', ({ patch, label }) => {
    expect(() => calculatePayrollSnapshot({ ...base, expenses: [expense(patch)] })).toThrow(label);
  });
  it('rejects unsafe totals and keeps signed time balance', () => {
    expect(() => moneyFromMinutes(Number.MAX_SAFE_INTEGER, 20_000)).toThrow();
    expect(calculatePayrollTimeAccountBalance({ actualWorkMinutes: 60, vacationMinutes: 60, targetMinutes: 180 })).toBe(-60);
    expect(formatPayrollBalanceMinutes(-90)).toBe('− 1:30 Std.');
    expect(formatPayrollMinutes(Number.NaN)).toBe('—');
    expect(formatPayrollMoney(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('Office Web minijob reference policy', () => {
  it.each([{ year: 2024, cents: 53_800 }, { year: 2025, cents: 55_600 }, { year: 2026, cents: 60_300 }, { year: 2027, cents: 63_300 }])('uses verified year $year', ({ year, cents }) => {
    expect(resolvePayrollMaxPayoutHours({ periodYear: year, employmentType: 'minijob', compensationType: 'hourly', compensationAmount: 20, configuredMaxPayoutHours: null })).toBe(cents / 2_000);
  });
  it('does not silently remove the cap for an unsupported year', () => {
    expect(() => resolvePayrollMaxPayoutHours({ periodYear: 2028, employmentType: 'mini_job', compensationType: 'hourly', compensationAmount: 20, configuredMaxPayoutHours: null })).toThrow('2028');
  });
  it('preserves a configured zero and leaves non-minijob settings intact', () => {
    expect(resolvePayrollMaxPayoutHours({ periodYear: 2026, employmentType: 'mini_job', compensationType: 'hourly', compensationAmount: 20, configuredMaxPayoutHours: 0 })).toBe(0);
    expect(resolvePayrollMaxPayoutHours({ periodYear: 2028, employmentType: 'full_time', compensationType: 'hourly', compensationAmount: 20, configuredMaxPayoutHours: 120 })).toBe(120);
  });
});

describe('Office Web monthly statement HTML', () => {
  it('escapes names, descriptions and arbitrary statuses and uses Berlin time', () => {
    const html = buildPayrollStatementHtml(calculatePayrollSnapshot({ ...base,
      employeeName: '<script>bad()</script>', expenses: [expense({ description: '<img src=x onerror=alert(1)>', status: 'approved' })],
      assignmentTimeLines: [assignment({ status: '<svg onload=x>' })],
    }), 2);
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=x'); expect(html).not.toContain('<svg onload=x>');
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('10:00–12:15');
    expect(html).toContain('Prognose vor Lohnabgaben'); expect(html).toContain('keinen Nettoauszahlungsbetrag');
    expect(html).toContain('18.10.2026, 06:00');
  });
  it('does not present a future visit as negative worked time', () => {
    const html = buildPayrollStatementHtml(calculatePayrollSnapshot({ ...base,
      assignmentTimeLines: [assignment({ actualStartAt: null, actualEndAt: null, actualMinutes: 0, differenceMinutes: -120, status: 'planned' })],
    }), 1);
    expect(html).toContain('Geplant'); expect(html).not.toContain('− 2:00 Std.');
  });
  it('keeps all characters in Unicode text fragments', () => {
    const text = 'Ä👩🏽‍⚕️B'.repeat(80);
    expect(splitPayrollPdfText(text, 14).join('')).toBe(text);
    expect(splitPayrollPdfText(text, 14).every(part => Array.from(part).length <= 14)).toBe(true);
  });
  it('puts long descriptions into bounded continuation rows and retains the last source row', () => {
    const tail = 'FinaleZeile';
    const html = buildPayrollStatementHtml(calculatePayrollSnapshot({ ...base,
      assignmentTimeLines: Array.from({ length: 18 }, (_, index) => assignment({ assignmentId: String(index), assignmentTitle: index === 17 ? tail : 'Betreuung und hauswirtschaftliche Unterstützung '.repeat(12) })),
      expenses: [expense({ description: 'X'.repeat(3_000) + 'Schlussteil', businessPurpose: '', status: 'approved' })],
    }), 1);
    expect(html).toContain(tail);
    expect(html.replaceAll('<br>', '')).toContain('Schlussteil');
    expect(html.match(/data-pdf-page=/g)!.length).toBeGreaterThan(8);
    expect(html).toContain('Fortsetzung'); expect(html).not.toContain('overflow:hidden');
  });
  it('does not invent a contractual target in older snapshots', () => {
    const snapshot = calculatePayrollSnapshot(base);
    delete snapshot.targetWorkMinutes;
    expect(buildPayrollStatementHtml(snapshot, 1)).toContain('Nicht hinterlegt');
  });
});
