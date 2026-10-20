import type { ReportingDateRange, ReportingDateRangePreset } from '@/types/reporting/metrics';

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function toIsoDate(d: Date): string {
  return d.toISOString();
}

function mondayOfWeek(d: Date): Date {
  const copy = startOfDay(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

const PRESET_LABELS: Record<Exclude<ReportingDateRangePreset, 'custom'>, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  current_week: 'Aktuelle Woche',
  last_week: 'Letzte Woche',
  current_month: 'Aktueller Monat',
  last_month: 'Letzter Monat',
  quarter: 'Quartal',
  year: 'Jahr',
};

export function resolveReportingDateRange(
  preset: ReportingDateRangePreset,
  customFrom?: string,
  customTo?: string,
  referenceDate: Date = new Date(),
): ReportingDateRange {
  const ref = startOfDay(referenceDate);

  if (preset === 'custom' && customFrom && customTo) {
    return {
      preset,
      from: startOfDay(new Date(customFrom)).toISOString(),
      to: endOfDay(new Date(customTo)).toISOString(),
      label: `${customFrom} – ${customTo}`,
    };
  }

  switch (preset) {
    case 'today':
      return {
        preset,
        from: toIsoDate(ref),
        to: toIsoDate(endOfDay(ref)),
        label: PRESET_LABELS.today,
      };
    case 'yesterday': {
      const y = new Date(ref);
      y.setDate(y.getDate() - 1);
      return {
        preset,
        from: toIsoDate(startOfDay(y)),
        to: toIsoDate(endOfDay(y)),
        label: PRESET_LABELS.yesterday,
      };
    }
    case 'current_week': {
      const start = mondayOfWeek(ref);
      const end = endOfDay(new Date(start));
      end.setDate(start.getDate() + 6);
      return {
        preset,
        from: toIsoDate(start),
        to: toIsoDate(end),
        label: PRESET_LABELS.current_week,
      };
    }
    case 'last_week': {
      const thisWeekStart = mondayOfWeek(ref);
      const start = new Date(thisWeekStart);
      start.setDate(start.getDate() - 7);
      const end = endOfDay(new Date(start));
      end.setDate(start.getDate() + 6);
      return {
        preset,
        from: toIsoDate(start),
        to: toIsoDate(end),
        label: PRESET_LABELS.last_week,
      };
    }
    case 'current_month': {
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const end = endOfDay(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
      return {
        preset,
        from: toIsoDate(start),
        to: toIsoDate(end),
        label: PRESET_LABELS.current_month,
      };
    }
    case 'last_month': {
      const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
      const end = endOfDay(new Date(ref.getFullYear(), ref.getMonth(), 0));
      return {
        preset,
        from: toIsoDate(start),
        to: toIsoDate(end),
        label: PRESET_LABELS.last_month,
      };
    }
    case 'quarter': {
      const quarter = Math.floor(ref.getMonth() / 3);
      const start = new Date(ref.getFullYear(), quarter * 3, 1);
      const end = endOfDay(new Date(ref.getFullYear(), quarter * 3 + 3, 0));
      return {
        preset,
        from: toIsoDate(start),
        to: toIsoDate(end),
        label: PRESET_LABELS.quarter,
      };
    }
    case 'year': {
      const start = new Date(ref.getFullYear(), 0, 1);
      const end = endOfDay(new Date(ref.getFullYear(), 11, 31));
      return {
        preset,
        from: toIsoDate(start),
        to: toIsoDate(end),
        label: PRESET_LABELS.year,
      };
    }
    default:
      return resolveReportingDateRange('current_month', undefined, undefined, referenceDate);
  }
}

export function isIsoInReportingRange(iso: string, range: ReportingDateRange): boolean {
  const ts = new Date(iso).getTime();
  return ts >= new Date(range.from).getTime() && ts <= new Date(range.to).getTime();
}

export const REPORTING_DATE_RANGE_PRESETS: ReportingDateRangePreset[] = [
  'today',
  'yesterday',
  'current_week',
  'last_week',
  'current_month',
  'last_month',
  'quarter',
  'year',
  'custom',
];
