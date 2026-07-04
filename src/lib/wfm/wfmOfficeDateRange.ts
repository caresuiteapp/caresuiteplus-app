import type { WfmOfficePeriodPreset, WfmOfficeTimePeriod } from '@/types/modules/wfmOfficeTimekeeping';
import { todayWorkDate } from './wfmWorkSessionRepository';

function workDateFromDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeekSunday(monday: Date): Date {
  const copy = new Date(monday);
  copy.setDate(copy.getDate() + 6);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function resolveOfficeTimePeriod(
  preset: WfmOfficePeriodPreset,
  customFrom?: string | null,
  customTo?: string | null,
  referenceDate: Date = new Date(),
): WfmOfficeTimePeriod {
  const today = workDateFromDateLocal(referenceDate);

  switch (preset) {
    case 'today':
      return { preset, fromDate: today, toDate: today };
    case 'yesterday': {
      const y = workDateFromDateLocal(addDays(referenceDate, -1));
      return { preset, fromDate: y, toDate: y };
    }
    case 'this_week': {
      const mon = startOfWeekMonday(referenceDate);
      const sun = endOfWeekSunday(mon);
      return {
        preset,
        fromDate: workDateFromDateLocal(mon),
        toDate: workDateFromDateLocal(sun),
      };
    }
    case 'last_week': {
      const thisMon = startOfWeekMonday(referenceDate);
      const lastMon = addDays(thisMon, -7);
      const lastSun = endOfWeekSunday(lastMon);
      return {
        preset,
        fromDate: workDateFromDateLocal(lastMon),
        toDate: workDateFromDateLocal(lastSun),
      };
    }
    case 'this_month': {
      const from = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
      return { preset, fromDate: from, toDate: workDateFromDateLocal(lastDay) };
    }
    case 'last_month': {
      const year = referenceDate.getMonth() === 0 ? referenceDate.getFullYear() - 1 : referenceDate.getFullYear();
      const month = referenceDate.getMonth() === 0 ? 12 : referenceDate.getMonth();
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0);
      return { preset, fromDate: from, toDate: workDateFromDateLocal(lastDay) };
    }
    case 'last_7_days': {
      const from = workDateFromDateLocal(addDays(referenceDate, -6));
      return { preset, fromDate: from, toDate: today };
    }
    case 'last_30_days': {
      const from = workDateFromDateLocal(addDays(referenceDate, -29));
      return { preset, fromDate: from, toDate: today };
    }
    case 'custom':
    default: {
      const from = customFrom?.trim() || today;
      const to = customTo?.trim() || from;
      return {
        preset: 'custom',
        fromDate: from <= to ? from : to,
        toDate: from <= to ? to : from,
      };
    }
  }
}

export function enumerateWorkDates(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [todayWorkDate()];
  }
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(workDateFromDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function workDateFromDate(date: Date): string {
  return workDateFromDateLocal(date);
}
