import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateContractTargetMinutesForRange } from '@/lib/wfm/wfmOfficeZeitkontenService';
import {
  calculatePayrollTimeAccountBalance,
  formatPayrollBalanceMinutes,
} from '@/lib/payroll/payrollCalculator';

describe('WFM contract-backed time accounts', () => {
  it('calculates the selected period target from the stored work-day schedule', () => {
    expect(calculateContractTargetMinutesForRange(
      { mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 0, sun: 0 },
      '2026-07-06',
      '2026-07-12',
    )).toBe(20 * 60);
  });

  it('does not create target time on contractually free days', () => {
    expect(calculateContractTargetMinutesForRange(
      { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 5, sun: 0 },
      '2026-07-06',
      '2026-07-12',
    )).toBe(5 * 60);
  });

  it('accepts persisted numeric work-day values without silently losing the target', () => {
    expect(calculateContractTargetMinutesForRange(
      { mon: '7.5', tue: '7.5', wed: '7.5', thu: '7.5', fri: '7.5' },
      '2026-07-06',
      '2026-07-12',
    )).toBe(37.5 * 60);
  });

  it('recomputes saldo, overtime and undertime instead of trusting stale zero rows', () => {
    const service = readFileSync('src/lib/wfm/wfmOfficeZeitkontenService.ts', 'utf8');
    expect(service).toContain('const creditedMinutes = account.actualMinutes + account.absenceMinutes');
    expect(service).toContain('overtimeMinutes: Math.max(0, saldoMinutes)');
    expect(service).toContain('undertimeMinutes: Math.max(0, -saldoMinutes)');
  });

  it('shows positive overtime, zero balance and undertime with an unambiguous sign', () => {
    expect(calculatePayrollTimeAccountBalance({
      actualWorkMinutes: 38 * 60 + 5,
      targetMinutes: 30 * 60,
    })).toBe(8 * 60 + 5);
    expect(calculatePayrollTimeAccountBalance({
      actualWorkMinutes: 28 * 60,
      vacationMinutes: 2 * 60,
      targetMinutes: 30 * 60,
    })).toBe(0);
    expect(formatPayrollBalanceMinutes(485)).toBe('+ 8:05 Std.');
    expect(formatPayrollBalanceMinutes(0)).toBe('± 0:00 Std.');
    expect(formatPayrollBalanceMinutes(-55)).toBe('− 0:55 Std.');
  });

  it('shows a global loading popup while time-account data refreshes', () => {
    const screen = readFileSync('src/components/wfm/TimeTrackingTeamScreen.tsx', 'utf8');
    expect(screen).toContain("feedback.showLoading('Arbeitszeit und Zeitkonten werden aktualisiert…')");
    expect(screen).toContain('accountsQuery.refreshing');
    expect(screen).toContain('teamQuery.refreshing');
  });

  it('shows the calculated time-account balance on payroll cards', () => {
    const screen = readFileSync('src/screens/office/PayrollMonthOverviewScreen.tsx', 'utf8');
    expect(screen).toContain('formatPayrollBalanceMinutes(employee.timeAccountBalanceMinutes)');
    expect(screen).not.toContain('Zeitkonto + <Text');
    expect(screen).not.toContain("feedback.showLoading('Arbeitszeit, Zeitkonto und Abrechnung werden aktualisiert…')");
    expect(screen).toContain("healthosPayrollRevision: 'r8'");
    expect(screen).toContain('QUERY_TIMEOUT_MS = 30_000');
    expect(screen).toContain('query.refreshing');
    expect(screen).toContain("feedback.showLoading(`${employee.employeeName}: Abrechnung und PDF werden erstellt…`)");
  });
});
