import type { WfmOfficeTimePeriod } from '@/types/modules/wfmOfficeTimekeeping';

export function officeMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function officeMonthPeriod(month: string): WfmOfficeTimePeriod {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Ungültiger Monat.');
  const [year, number] = month.split('-').map(Number);
  const lastDay = new Date(year, number, 0).getDate();
  return { preset: 'custom', fromDate: `${month}-01`, toDate: `${month}-${lastDay}` };
}

export function shiftOfficeMonth(month: string, offset: number): string {
  officeMonthPeriod(month);
  const [year, number] = month.split('-').map(Number);
  return officeMonthKey(new Date(year, number - 1 + offset, 15));
}

export function officeMonthLabel(month: string): string {
  officeMonthPeriod(month);
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
    .format(new Date(`${month}-15T12:00:00`));
}

export function officePeriodLabel(period: Pick<WfmOfficeTimePeriod, 'fromDate' | 'toDate'>): string {
  const format = (date: string) => date.split('-').reverse().join('.');
  return period.fromDate === period.toDate ? format(period.fromDate) : `${format(period.fromDate)} – ${format(period.toDate)}`;
}
