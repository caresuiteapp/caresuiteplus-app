import type { WeekStartDay } from '@/types/modules/calendarEvent';

const MS_PER_DAY = 86_400_000;

export const DEFAULT_CALENDAR_TIMEZONE = 'Europe/Berlin';

/** Calendar date (YYYY-MM-DD) for an instant in the given IANA timezone. */
export function toTimezoneDateKey(
  iso: string | Date,
  timeZone: string = DEFAULT_CALENDAR_TIMEZONE,
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** All-day events use date-only UTC instants (legacy calendar convention). */
export function floatingUtcDayStart(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

export function floatingUtcDayEnd(dateKey: string): string {
  return `${dateKey}T23:59:59.999Z`;
}

/** Normalizes all-day bounds to inclusive floating UTC days in Europe/Berlin. */
export function normalizeAllDayFloatingUtcBounds(
  startIso: string,
  endIso: string,
  timeZone: string = DEFAULT_CALENDAR_TIMEZONE,
): { startAt: string; endAt: string } {
  const alreadyFloating =
    /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(startIso)
    && /^\d{4}-\d{2}-\d{2}T23:59:59\.999Z$/.test(endIso);
  const startKey = alreadyFloating ? startIso.slice(0, 10) : toTimezoneDateKey(startIso, timeZone);
  const endKey = alreadyFloating ? endIso.slice(0, 10) : toTimezoneDateKey(endIso, timeZone);
  return {
    startAt: floatingUtcDayStart(startKey),
    endAt: floatingUtcDayEnd(endKey),
  };
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function startOfWeek(date: Date, weekStartDay: WeekStartDay = 1): Date {
  const day = date.getDay();
  const diff = (day - weekStartDay + 7) % 7;
  return startOfDay(addDays(date, -diff));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function getMonthGridDays(
  anchor: Date,
  weekStartDay: WeekStartDay = 1,
): { date: Date; inMonth: boolean }[] {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, weekStartDay);
  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(gridStart, i);
    days.push({ date, inMonth: isSameMonth(date, anchor) });
  }
  return days;
}

export function getWeekDays(anchor: Date, weekStartDay: WeekStartDay = 1): Date[] {
  const start = startOfWeek(anchor, weekStartDay);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatMonthYear(date: Date, locale = 'de-DE'): string {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function formatDayHeader(date: Date, locale = 'de-DE'): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatWeekRange(anchor: Date, weekStartDay: WeekStartDay = 1, locale = 'de-DE'): string {
  const days = getWeekDays(anchor, weekStartDay);
  const start = days[0];
  const end = days[6];
  const startStr = start.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined,
  });
  return `${startStr} – ${endStr}`;
}

export function formatTime(iso: string, locale = 'de-DE'): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function eventOverlapsDay(
  eventStart: string,
  eventEnd: string,
  day: Date,
  options?: { allDay?: boolean },
): boolean {
  if (options?.allDay) {
    const dayKey = toDateKey(day);
    const startKey = eventStart.slice(0, 10);
    const endKey = eventEnd.slice(0, 10);
    return startKey <= dayKey && endKey >= dayKey;
  }

  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + MS_PER_DAY - 1;
  const start = new Date(eventStart).getTime();
  const end = new Date(eventEnd).getTime();
  return start <= dayEnd && end >= dayStart;
}

export function eventsForDay<T extends { start: string; end: string; allDay?: boolean }>(
  events: T[],
  day: Date,
): T[] {
  return events.filter((e) => eventOverlapsDay(e.start, e.end, day, { allDay: e.allDay }));
}

export const WEEKDAY_LABELS_DE: Record<WeekStartDay, string[]> = {
  0: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  1: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
};

export function orderedWeekdayLabels(weekStartDay: WeekStartDay): string[] {
  return WEEKDAY_LABELS_DE[weekStartDay];
}

export const MONTH_LABELS_DE = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];
