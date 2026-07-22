import { describe, expect, it } from 'vitest';
import {
  buildPayrollStatementHtml,
  calculatePayrollSnapshot,
  moneyFromMinutes,
} from '@/lib/payroll/payrollCalculator';
import type { PayrollExpenseClaim } from '@/types/modules/payrollMonth';

function expense(overrides: Partial<PayrollExpenseClaim> = {}): PayrollExpenseClaim {
  return {
    id: 'expense-1', tenantId: 'tenant-1', employeeId: 'employee-1',
    expenseDate: '2026-07-14', category: 'public_transport',
    description: 'ÖPNV-Ticket zum Einsatz', amountCents: 1200,
    approvedAmountCents: null, currency: 'EUR', assignmentId: null,
    clientId: null, paymentMethod: null, receiptNumber: null,
    receiptPath: 'tenant/employee/receipt.pdf', mileageKm: null,
    mileageRateCents: null, origin: null, destination: null,
    vehicleLabel: null, businessPurpose: 'Klienteneinsatz',
    taxTreatment: 'reimbursement', status: 'submitted', officeNote: null,
    rejectionReason: null, submittedAt: '2026-07-14T10:00:00.000Z',
    reviewedAt: null, createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z', ...overrides,
  };
}

const base = {
  employeeId: 'employee-1', employeeName: 'Alex Beispiel', employeeNumber: 'MA-100',
  periodYear: 2026, periodMonth: 7, compensationType: 'hourly' as const,
  compensationAmount: 20, maxPayoutHours: null, actualWorkMinutes: 6_000,
  travelMinutes: 600, vacationMinutes: 480, sickMinutes: 0,
  otherPaidAbsenceMinutes: 0, plannedMinutes: 1_200,
  timeAccountBalanceMinutes: 300, expenses: [] as PayrollExpenseClaim[],
  now: '2026-07-22T12:00:00.000Z',
};

describe('payrollCalculator', () => {
  it('berechnet Stundenlohn minutengenau', () => {
    expect(moneyFromMinutes(90, 2_000)).toBe(3_000);
  });

  it('begrenzt die Auszahlung und überträgt den Rest ins Zeitkonto', () => {
    const result = calculatePayrollSnapshot({ ...base, maxPayoutHours: 100 });
    expect(result.payableMinutes).toBe(6_000);
    expect(result.overtimeTransferMinutes).toBe(480);
    expect(result.earnedGrossCents).toBe(200_000);
    expect(result.projectedGrossCents).toBe(200_000);
  });

  it('bezieht geplante Einsätze ausschließlich in die Prognose ein', () => {
    const result = calculatePayrollSnapshot(base);
    expect(result.earnedGrossCents).toBe(216_000);
    expect(result.projectedGrossCents).toBe(256_000);
  });

  it('weist genehmigte Auslagen getrennt vom Bruttolohn aus', () => {
    const result = calculatePayrollSnapshot({
      ...base,
      expenses: [
        expense({ status: 'approved', approvedAmountCents: 1_000 }),
        expense({ id: 'expense-2', category: 'mileage', status: 'partially_approved', amountCents: 2_000, approvedAmountCents: 1_500 }),
        expense({ id: 'expense-3', status: 'submitted', amountCents: 900 }),
      ],
    });
    expect(result.approvedExpensesCents).toBe(2_500);
    expect(result.pendingExpensesCents).toBe(900);
    expect(result.earnedGrossCents).toBe(216_000);
    expect(result.projectedTotalPayoutCents).toBe(258_500);
  });

  it('berechnet Festgehalt unabhängig von geplanten Stunden', () => {
    const result = calculatePayrollSnapshot({ ...base, compensationType: 'salary', compensationAmount: 3_250 });
    expect(result.earnedGrossCents).toBe(325_000);
    expect(result.projectedGrossCents).toBe(325_000);
  });

  it('erzeugt eine vollständige, deutschsprachige PDF-Vorlage', () => {
    const snapshot = calculatePayrollSnapshot({ ...base, expenses: [expense({ status: 'approved' })] });
    const html = buildPayrollStatementHtml(snapshot, 2);
    expect(html).toContain('MONATSÜBERSICHT');
    expect(html).toContain('Version 2');
    expect(html).toContain('Geplante Einsätze bis Monatsende');
    expect(html).toContain('ÖPNV-Ticket zum Einsatz');
    expect(html).toContain('Bruttolohn und Auslagenersatz werden getrennt ausgewiesen');
  });
});
