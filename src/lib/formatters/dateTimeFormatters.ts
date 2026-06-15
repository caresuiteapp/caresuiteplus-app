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

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** TT.MM.JJJJ */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = toDate(value);
  if (!d) return '';
  return dateFormatter.format(d);
}

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
