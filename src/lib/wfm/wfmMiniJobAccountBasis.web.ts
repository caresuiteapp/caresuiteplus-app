import { isMiniJobEmploymentType, resolvePayrollMaxPayoutHours } from '@/lib/payroll/payrollPayoutPolicy.web';
import { payrollMaxPayoutMinutes } from '@/lib/payroll/payrollCalculator.web';
import { hasOfficeContractSchedule } from './wfmOfficeAccountTotals';

type Row = Record<string, unknown>;
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** An explicitly configured payout model is a comparison basis, never an invented contractual obligation. */
export function miniJobAccountBasisMinutes(input: {
  employee?: Row; payroll?: Row; workDays: unknown; fromDate: string; toDate: string;
}): number | null {
  const { employee, payroll, workDays, fromDate, toDate } = input;
  if (!isMiniJobEmploymentType(employee?.employment_type) || payroll?.compensation_type !== 'hourly'
    || payroll.overflow_to_time_account !== true || payroll.max_payout_hours_month == null) return null;
  if (workDays != null && !hasOfficeContractSchedule(workDays)) return null;
  if (hasOfficeContractSchedule(workDays) && days.some(day => Number(workDays[day] ?? 0) > 0)) return null;
  const start = new Date(`${fromDate}T00:00:00Z`), end = new Date(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end
    || start.toISOString().slice(0, 10) !== fromDate || end.toISOString().slice(0, 10) !== toDate
    || start.getUTCDate() !== 1 || end.getUTCDate() !== new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()) return null;
  // A partial employment month needs its own agreement; do not prorate a statutory reference into a contract.
  if ((typeof employee?.entry_date === 'string' && employee.entry_date > fromDate)
    || (typeof employee?.exit_date === 'string' && employee.exit_date < toDate)) return null;
  const amount = Number(payroll.compensation_amount), configured = Number(payroll.max_payout_hours_month);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(configured) || configured <= 0) return null;
  let minutes = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    const hours = resolvePayrollMaxPayoutHours({ periodYear: cursor.getUTCFullYear(), employmentType: employee?.employment_type,
      compensationType: payroll.compensation_type, compensationAmount: amount, configuredMaxPayoutHours: configured });
    minutes += payrollMaxPayoutMinutes(hours) ?? 0;
  }
  return minutes;
}
