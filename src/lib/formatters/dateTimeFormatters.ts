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
  if (typeof value === 'string') {
    const wallTime = value.trim().match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
    if (wallTime) return `${wallTime[1]} Uhr`;
  }
  const d = toDate(value);
  if (!d) return '';
  return `${timeFormatter.format(d)} Uhr`;
}

/** 08:00–12:30 Uhr */
export function formatTimeRange(
  start: string | Date,
  end: string | Date,
): string {
  if (typeof start === 'string' && typeof end === 'string') {
    const startWall = start.trim().match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
    const endWall = end.trim().match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/);
    if (startWall && endWall) return `${startWall[1]}–${endWall[1]} Uhr`;
  }
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

/** Freitag, 04.07.2026 — Wochentag mit Kalenderdatum für Einsatzkarten */
export function formatAssignmentWeekdayDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return '';
  const d = toDate(value);
  if (!d) return '';
  return `${formatWeekday(d)}, ${formatDate(d)}`;
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
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export type ParseGermanOrIsoDateInputOptions = {
  /** Ganztägig: Tagesanfang (00:00) oder -ende (23:59:59.999) in lokaler Zeit */
  timeOfDay?: 'start' | 'end';
};

function localDateFromParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, second, ms);
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function applyTimeOfDay(date: Date, timeOfDay: 'start' | 'end'): Date {
  if (timeOfDay === 'end') {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

/** Parst deutsche/ISO-Datumseingaben zu einem gültigen Date (nie Invalid Date). */
export function parseGermanOrIsoDateInput(
  value: string | Date | null | undefined,
  options?: ParseGermanOrIsoDateInputOptions,
): Date | null {
  const timeOfDay = options?.timeOfDay ?? 'start';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const copy = new Date(value.getTime());
    return applyTimeOfDay(copy, timeOfDay);
  }

  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoDateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, y, m, d] = isoDateOnly;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!isValidCalendarDate(year, month, day)) return null;
    const date = localDateFromParts(year, month, day);
    return applyTimeOfDay(date, timeOfDay);
  }

  const isoDateTime = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/,
  );
  if (isoDateTime) {
    const [, y, m, d, hh, mm, ss] = isoDateTime;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!isValidCalendarDate(year, month, day)) return null;
    const date = localDateFromParts(
      year,
      month,
      day,
      Number(hh),
      Number(mm),
      ss ? Number(ss) : 0,
    );
    return date;
  }

  const germanDateTime = trimmed.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:[, ]+(\d{2}):(\d{2}))?$/,
  );
  if (germanDateTime) {
    const [, d, m, y, hh, mm] = germanDateTime;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!isValidCalendarDate(year, month, day)) return null;
    const hasTime = hh !== undefined;
    const date = localDateFromParts(
      year,
      month,
      day,
      hasTime ? Number(hh) : 0,
      hasTime ? Number(mm) : 0,
    );
    return hasTime ? date : applyTimeOfDay(date, timeOfDay);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return applyTimeOfDay(parsed, timeOfDay);
}

/** ISO-String aus parseGermanOrIsoDateInput; null bei ungültiger Eingabe. */
export function parseGermanOrIsoDateInputToIso(
  value: string | Date | null | undefined,
  options?: ParseGermanOrIsoDateInputOptions,
): string | null {
  const date = parseGermanOrIsoDateInput(value, options);
  if (!date) return null;
  return date.toISOString();
}

const WFM_ABSENCE_DATE_ERROR = 'Bitte prüfen Sie das Datum.';

function parseWfmDateOnlyKey(value: string): string | null {
  const trimmed = value.trim();
  const german = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  const parts = german
    ? { year: Number(german[3]), month: Number(german[2]), day: Number(german[1]) }
    : iso
      ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
      : null;
  if (!parts || !isValidCalendarDate(parts.year, parts.month, parts.day)) return null;
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** Parst Start/Ende für WFM-Abwesenheitsanträge (ganztägig, lokale Tagesgrenzen). */
export function parseWfmAbsenceDateRange(
  startInput: string,
  endInput: string,
): { ok: true; startsAt: string; endsAt: string } | { ok: false; error: string } {
  const startKey = parseWfmDateOnlyKey(startInput);
  const endKey = parseWfmDateOnlyKey(endInput);
  if (!startKey || !endKey) {
    return { ok: false, error: WFM_ABSENCE_DATE_ERROR };
  }
  if (endKey < startKey) {
    return { ok: false, error: WFM_ABSENCE_DATE_ERROR };
  }
  return {
    ok: true,
    startsAt: `${startKey}T00:00:00.000Z`,
    endsAt: `${endKey}T23:59:59.999Z`,
  };
}
