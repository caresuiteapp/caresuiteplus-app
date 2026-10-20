import { describe, expect, it } from 'vitest';
import {
  buildPayrollStatementHtml,
  calculatePayrollSnapshot,
  moneyFromMinutes,
} from '@/lib/payroll/payrollCalculator';
import { isPayrollRelevantEmployee } from '@/lib/payroll/payrollEmployeeStatus';
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
  compensationAmount: 20, maxPayoutHours: null, overflowToTimeAccount: true, actualWorkMinutes: 6_000,
  travelMinutes: 600, vacationMinutes: 480, sickMinutes: 0,
  otherPaidAbsenceMinutes: 0, plannedMinutes: 1_200,
  targetWorkMinutes: 6_300,
  timeAccountBalanceMinutes: 300, expenses: [] as PayrollExpenseClaim[],
  now: '2026-07-22T12:00:00.000Z',
};

describe('payrollCalculator', () => {
  it('filtert Beschäftigungsstatus schemaunabhängig ohne PostgREST-Enumfilter', () => {
    expect(isPayrollRelevantEmployee({ status: 'aktiv' })).toBe(true);
    expect(isPayrollRelevantEmployee({ status: 'in_bearbeitung' })).toBe(true);
    expect(isPayrollRelevantEmployee({ status: 'probezeit' })).toBe(true);
    expect(isPayrollRelevantEmployee({ status: 'ausgeschieden' })).toBe(false);
    expect(isPayrollRelevantEmployee({ status: 'archiviert' })).toBe(false);
  });

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

  it('begrenzt den Minijob bei 15 Euro auf 40,2 Stunden und überträgt 13:49 Stunden', () => {
    const result = calculatePayrollSnapshot({
      ...base,
      compensationAmount: 15,
      maxPayoutHours: 40.2,
      actualWorkMinutes: 3_241,
      vacationMinutes: 0,
      targetWorkMinutes: 2_412,
    });
    expect(result.payableMinutes).toBe(2_412);
    expect(result.earnedGrossCents).toBe(60_300);
    expect(result.overtimeTransferMinutes).toBe(829);
  });

  it('respektiert die manuelle Prüfung statt automatischem Zeitkonto-Übertrag', () => {
    const result = calculatePayrollSnapshot({ ...base, maxPayoutHours: 100, overflowToTimeAccount: false });
    expect(result.payableMinutes).toBe(6_000);
    expect(result.overtimeTransferMinutes).toBe(0);
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
    const snapshot = calculatePayrollSnapshot({
      ...base,
      expenses: [expense({ status: 'approved' })],
      assignmentTimeLines: [{
        assignmentId: 'assignment-1', workDate: '2026-07-14', clientLabel: 'Iris Jäger',
        assignmentTitle: 'Hauswirtschaftliche Unterstützung',
        plannedStartAt: '2026-07-14T08:00:00.000Z', plannedEndAt: '2026-07-14T10:00:00.000Z',
        actualStartAt: '2026-07-14T08:05:00.000Z', actualEndAt: '2026-07-14T10:10:00.000Z',
        plannedMinutes: 120, actualMinutes: 125, travelMinutes: 20, differenceMinutes: 5, status: 'completed',
      }],
      nextMonthPreview: {
        periodYear: 2026, periodMonth: 8, totalPlannedMinutes: 180,
        assignments: [{
          assignmentId: 'assignment-2', workDate: '2026-08-03', clientLabel: 'Frank Hartmann',
          assignmentTitle: 'Betreuungseinsatz',
          plannedStartAt: '2026-08-03T09:00:00.000Z', plannedEndAt: '2026-08-03T12:00:00.000Z',
          actualStartAt: null, actualEndAt: null, plannedMinutes: 180, actualMinutes: 0,
          travelMinutes: 0, differenceMinutes: -180, status: 'confirmed',
        }],
      },
    });
    const html = buildPayrollStatementHtml(snapshot, 2);
    expect(html).toContain('MONATSÜBERSICHT');
    expect(html).toContain('Version 2');
    expect(html).toContain('Geplante Einsätze bis Monatsende');
    expect(html).toContain('ÖPNV-Ticket zum Einsatz');
    expect(html).toContain('Vertragliches Soll');
    expect(html).toContain('Anrechenbares Ist');
    expect(html).toContain('Soll-/Ist-Differenz');
    expect(html).toContain('Einsätze und erfasste Arbeitszeiten');
    expect(html).toContain('Iris Jäger');
    expect(html).toContain('Hauswirtschaftliche Unterstützung');
    expect(html).toContain('Vollständige Vorschau');
    expect(html).toContain('August 2026');
    expect(html).toContain('Frank Hartmann');
    expect(html).toContain('Bruttolohn und Auslagenersatz werden getrennt ausgewiesen');
    const escaped = buildPayrollStatementHtml({ ...snapshot, employeeName: '<script>alert(1)</script>' }, 3);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('verteilt lange Abrechnungen auf echte, großzügige A4-Seiten ohne abgeschnittene Zeilen', () => {
    const assignment = (index: number, month: 7 | 8) => ({
      assignmentId: `assignment-${month}-${index}`,
      workDate: `2026-${String(month).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
      clientLabel: `Klient:in ${index}`,
      assignmentTitle: 'Hauswirtschaftliche Unterstützung mit vollständiger Dokumentation',
      plannedStartAt: `2026-${String(month).padStart(2, '0')}-01T08:00:00.000Z`,
      plannedEndAt: `2026-${String(month).padStart(2, '0')}-01T10:00:00.000Z`,
      actualStartAt: month === 7 ? `2026-07-01T08:05:00.000Z` : null,
      actualEndAt: month === 7 ? `2026-07-01T10:05:00.000Z` : null,
      plannedMinutes: 120,
      actualMinutes: month === 7 ? 120 : 0,
      travelMinutes: 0,
      differenceMinutes: 0,
      status: month === 7 ? 'documentation_open' : 'confirmed',
    });
    const snapshot = calculatePayrollSnapshot({
      ...base,
      assignmentTimeLines: Array.from({ length: 21 }, (_, index) => assignment(index, 7)),
      nextMonthPreview: {
        periodYear: 2026,
        periodMonth: 8,
        totalPlannedMinutes: 2_400,
        assignments: Array.from({ length: 20 }, (_, index) => assignment(index, 8)),
      },
    });

    const html = buildPayrollStatementHtml(snapshot, 4);
    expect(html.match(/data-pdf-page=/g)).toHaveLength(7);
    expect(html).toContain('width:794px;height:1123px');
    expect(html).toContain('font-size:11px;line-height:1.45');
    expect(html).toContain('padding:9px 6px');
    expect(html).toContain('Einsätze und erfasste Arbeitszeiten · Juli 2026 · 3/3');
    expect(html).toContain('Vollständige Vorschau · August 2026 · 3/3');
    expect(html).toContain('Seite 7 von 7');
  });
});
