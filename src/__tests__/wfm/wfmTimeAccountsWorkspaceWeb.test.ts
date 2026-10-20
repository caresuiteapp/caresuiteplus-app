import { describe, expect, it } from 'vitest';
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';
import { accountDuration, accountPeriodPreset, accountReviewFilter, accountSort, selectTimeAccounts, timeAccountTotals, validAccountMonth } from '@/components/wfm/wfmTimeAccountsModel.web';

function account(employeeId: string, employeeName: string, values: Partial<WfmOfficeEmployeeTimeAccount> = {}): WfmOfficeEmployeeTimeAccount {
  return {
    employeeId, employeeName, plannedMinutes: 0, actualMinutes: 0, approvedMinutes: 0, exportedMinutes: 0,
    saldoMinutes: 0, openReviewCount: 0, targetMinutes: 0, overtimeMinutes: 0, undertimeMinutes: 0,
    travelMinutes: 0, absenceMinutes: 0, vacationDaysUsed: 0, sickDays: 0, annualVacationDays: null,
    remainingVacationDays: null, payrollStatements: [], entries: [], ...values,
  };
}

describe('Web Zeitkonten filters and summaries', () => {
  it('combines employee, multi-word accent-insensitive search and open-review filter', () => {
    const rows = [account('anna', 'Anna Müller', { openReviewCount: 2 }), account('ben', 'Ben Müller', { openReviewCount: 1 })];
    expect(selectTimeAccounts(rows, { employeeId: 'anna', search: ' muller anna ', review: 'open', sort: 'name' }).map(row => row.employeeId)).toEqual(['anna']);
    expect(selectTimeAccounts(rows, { employeeId: 'ben', search: 'anna', review: 'all', sort: 'name' })).toEqual([]);
  });
  it('sorts review counts and balances without changing the service dataset', () => {
    const rows = [account('b', 'Ben', { openReviewCount: 2, saldoMinutes: -40 }), account('a', 'Anna', { openReviewCount: 2, saldoMinutes: 0 }), account('c', 'Carla', { openReviewCount: 3, saldoMinutes: -80 })];
    expect(selectTimeAccounts(rows, { employeeId: '', search: '', review: 'all', sort: 'reviews' }).map(row => row.employeeId)).toEqual(['c', 'a', 'b']);
    expect(selectTimeAccounts(rows, { employeeId: '', search: '', review: 'negative', sort: 'balance' }).map(row => row.employeeId)).toEqual(['c', 'b']);
    expect(rows.map(row => row.employeeId)).toEqual(['b', 'a', 'c']);
  });
  it('preserves a zero contractual target and sums only the selected accounts', () => {
    const zero = account('a', 'Anna', { plannedMinutes: 180, targetMinutes: 0, actualMinutes: 60, approvedMinutes: 60, saldoMinutes: 60 });
    const other = account('b', 'Ben', { targetMinutes: 120, actualMinutes: 30, absenceMinutes: 60, saldoMinutes: -30, openReviewCount: 2 });
    expect(timeAccountTotals([zero])).toMatchObject({ employees: 1, targetMinutes: 0, actualMinutes: 60, saldoMinutes: 60 });
    expect(timeAccountTotals([zero, other])).toEqual({ employees: 2, targetMinutes: 120, actualMinutes: 90, approvedMinutes: 60, saldoMinutes: 30, absenceMinutes: 60, openReviews: 2 });
  });
  it('validates persisted URL values and never forwards arbitrary filter strings', () => {
    expect(validAccountMonth('2026-10')).toBe(true);
    for (const value of ['2026-00', '2026-13', '2026-1', '', '2026-10-01', '0000-01']) expect(validAccountMonth(value)).toBe(false);
    expect(accountPeriodPreset('unexpected')).toBe('this_month');
    expect(accountReviewFilter('unexpected')).toBe('all');
    expect(accountSort('unexpected')).toBe('name');
  });
  it('keeps signed balances and hour/minute notation explicit', () => {
    expect(accountDuration(-65, true)).toBe('−1:05 h');
    expect(accountDuration(65, true)).toBe('+1:05 h');
    expect(accountDuration(0, true)).toBe('0:00 h');
    expect(accountDuration(119.8)).toBe('2:00 h');
  });
});
