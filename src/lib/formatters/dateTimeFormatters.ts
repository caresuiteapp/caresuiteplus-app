import { APP_LOCALE, APP_TIME_ZONE } from '@/lib/i18n/locale';

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const weekdayFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  weekday: 'long',
});

const fullDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  const isoDateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** TT.MM.JJJJ — zentrale Anzeige für Datumsfelder (ISO, Date oder bereits TT.MM.JJJJ). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isoDateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnly) {
      const [, year, month, day] = isoDateOnly;
      return `${day}.${month}.${year}`;
    }
    if (/^(\d{2})\.(\d{2})\.(\d{4})$/.test(trimmed)) return trimmed;
  }
  const d = toDate(value);
  if (!d) return '';
  return dateFormatter.format(d);
}

/** Alias für konsistente Verwendung in Detail- und Formular-Ansichten. */
export const formatDateForDisplay = formatDate;

/** HH:MM Uhr */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = toDate(value);
  if (!d) return '';
  return `${timeFormatter.format(d)} Uhr`;
}

/** 08:00–12:30 Uhr */
export function formatTimeRange(
  start: string | Date,
  end: string | Date,
): string {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return '';
  return `${timeFormatter.format(s)}–${timeFormatter.format(e)} Uhr`;
}

/** Mittwoch */
export function formatWeekday(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = toDate(value);
  if (!d) return '';
  return weekdayFormatter.format(d);
}

/** 09:00 Uhr bis 10:00 Uhr */
export function formatAssignmentTimeRange(
  start: string | Date,
  end: string | Date,
): string {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return '';
  return `${formatTime(s)} bis ${formatTime(e)}`;
}

/** 60 Min. */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} Min.`;
  if (remainder === 0) return `${hours} Std.`;
  return `${hours} Std. ${remainder} Min.`;
}

/** Mittwoch - 17.06.2026 09:00 Uhr bis 10:00 Uhr - geplant (60 Min.) */
export function formatAssignmentSchedule(
  start: string | Date,
  end: string | Date,
  options?: {
    planningStatusLabel?: string;
    durationMinutes?: number | null;
  },
): string {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return '';

  const weekday = formatWeekday(s);
  const date = fullDateFormatter.format(s);
  const timePart = formatAssignmentTimeRange(s, e);
  const statusPart = options?.planningStatusLabel
    ? ` - ${options.planningStatusLabel.toLowerCase()}`
    : '';
  const durationPart = options?.durationMinutes
    ? ` (${formatDurationMinutes(options.durationMinutes)})`
    : '';

  return `${weekday} - ${date} ${timePart}${statusPart}${durationPart}`;
}

/** TT.MM.JJJJ, HH:MM Uhr */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = toDate(value);
  if (!d) return '';
  return `${formatDate(d)}, ${formatTime(d)}`;
}

/** ISO JJJJ-MM-TT aus TT.MM.JJJJ (oder bereits ISO) */
export function parseGermanDate(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
