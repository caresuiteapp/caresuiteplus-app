import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { eventOverlapsDay, toDateKey } from '@/lib/office/calendarDateUtils';

/** Month navigation keeps the selected day when possible, without skipping February. */
export function addCalendarMonthsClamped(date: Date, amount: number): Date {
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(amount)) return new Date(NaN);
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + Math.trunc(amount));
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

/** Leap-day navigation lands on February 28 in a non-leap year. */
export function addCalendarYearsClamped(date: Date, amount: number): Date {
  return addCalendarMonthsClamped(date, Math.trunc(amount) * 12);
}

/** Keep every view in chronological order without mutating the fetched events. */
export function sortedCalendarEvents<T extends CalendarEvent>(events: readonly T[]): T[] {
  return [...events].sort((left, right) => {
    const leftTime = Date.parse(left.start);
    const rightTime = Date.parse(right.start);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) {
      return Number.isFinite(leftTime) ? -1 : 1;
    }
    return left.title.localeCompare(right.title, 'de');
  });
}

function validFloatingDateKey(value: string): string | null {
  const key = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : null;
}

/** Floating all-day dates must not move a day when viewed in another timezone. */
export function calendarEventDateKey(event: CalendarEvent): string {
  if (event.allDay) return validFloatingDateKey(event.start) ?? '';
  const date = new Date(event.start);
  return Number.isFinite(date.getTime()) ? toDateKey(date) : '';
}

/** Agenda/list grouping lists an event once, under its local start date. */
export function groupCalendarEventsByDay<T extends CalendarEvent>(events: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const event of sortedCalendarEvents(events)) {
    const key = calendarEventDateKey(event);
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.push(event);
    else groups.set(key, [event]);
  }
  // Mixed floating and timed dates can sort differently from their UTC instants.
  return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export type TimedDayLayoutOptions = {
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  minHeight?: number;
};

export type TimedCalendarEventLayout<T extends CalendarEvent = CalendarEvent> = {
  event: T;
  top: number;
  height: number;
  column: number;
  columnCount: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

function localMinuteOffset(date: Date, day: Date): number {
  const dayOffset = (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    - Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())
  ) / 86_400_000;
  return dayOffset * 1440 + date.getHours() * 60 + date.getMinutes()
    + date.getSeconds() / 60 + date.getMilliseconds() / 60_000;
}

/**
 * Geometry for a wall-clock timeline. End instants are exclusive; zero-duration
 * reminders remain visible. Collision groups use the painted minimum height,
 * so neighbouring short appointments cannot cover one another.
 */
export function buildTimedDayLayout<T extends CalendarEvent>(
  events: readonly T[],
  day: Date,
  { startHour = 0, endHour = 24, hourHeight = 72, minHeight = 28 }: TimedDayLayoutOptions = {},
): TimedCalendarEventLayout<T>[] {
  if (!Number.isFinite(day.getTime()) || ![startHour, endHour, hourHeight, minHeight].every(Number.isFinite)) return [];
  const firstHour = Math.max(0, Math.min(24, startHour));
  const lastHour = Math.max(0, Math.min(24, endHour));
  if (lastHour <= firstHour || hourHeight <= 0 || minHeight < 0) return [];
  const windowStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, firstHour * 60).getTime();
  const windowEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, lastHour * 60).getTime();
  const totalHeight = (lastHour - firstHour) * hourHeight;
  const minimumHeight = Math.min(minHeight, totalHeight);
  const blocks: TimedCalendarEventLayout<T>[] = [];

  for (const event of sortedCalendarEvents(events)) {
    if (event.allDay) continue;
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const point = end === start;
    if (point ? start < windowStart || start >= windowEnd : start >= windowEnd || end <= windowStart) continue;

    const clippedStart = new Date(Math.max(start, windowStart));
    const clippedEnd = new Date(Math.min(end, windowEnd));
    const actualTop = Math.max(0, (localMinuteOffset(clippedStart, day) / 60 - firstHour) * hourHeight);
    const actualBottom = Math.min(totalHeight, (localMinuteOffset(clippedEnd, day) / 60 - firstHour) * hourHeight);
    // Keep the minimum-height hit target inside the last visible hour as well.
    const top = Math.min(actualTop, totalHeight - minimumHeight);
    const height = Math.min(totalHeight - top, Math.max(minimumHeight, actualBottom - top));
    blocks.push({
      event,
      top,
      height,
      column: 0,
      columnCount: 1,
      continuesBefore: start < windowStart,
      continuesAfter: end > windowEnd,
    });
  }

  const visualOrder = [...blocks].sort((left, right) => left.top - right.top || right.height - left.height);
  let group: TimedCalendarEventLayout<T>[] = [];
  let columnEnds: number[] = [];
  let groupBottom = -Infinity;
  const finishGroup = () => {
    for (const block of group) block.columnCount = columnEnds.length;
  };
  for (const block of visualOrder) {
    if (block.top >= groupBottom) {
      finishGroup();
      group = [];
      columnEnds = [];
      groupBottom = -Infinity;
    }
    let column = columnEnds.findIndex((bottom) => bottom <= block.top);
    if (column < 0) column = columnEnds.length;
    block.column = column;
    columnEnds[column] = block.top + block.height;
    groupBottom = Math.max(groupBottom, block.top + block.height);
    group.push(block);
  }
  finishGroup();
  return blocks;
}

export type CalendarMonthStats = {
  totalEvents: number;
  absenceDays: number;
  days: { date: Date; key: string; count: number; absence: boolean }[];
};

const absenceTypes = new Set<CalendarEvent['type']>(['urlaub', 'krank', 'abwesenheit', 'weiterbildung']);

function hasValidBounds(event: CalendarEvent): boolean {
  if (event.allDay) {
    const start = validFloatingDateKey(event.start);
    const end = validFloatingDateKey(event.end);
    return start !== null && end !== null && start <= end;
  }
  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  return Number.isFinite(start) && Number.isFinite(end) && start <= end;
}

/** Full real months, including events which began before the selected month. */
export function buildCalendarMonthStats(
  events: readonly CalendarEvent[],
  year: number,
  monthIndex: number,
): CalendarMonthStats {
  const monthStart = new Date(year, monthIndex, 1);
  if (!Number.isFinite(monthStart.getTime())) return { totalEvents: 0, absenceDays: 0, days: [] };
  const monthLength = new Date(year, monthIndex + 1, 0).getDate();
  const monthStartTime = monthStart.getTime();
  const nextMonthStartTime = new Date(year, monthIndex + 1, 1).getTime();
  const firstDateKey = toDateKey(monthStart);
  const lastDateKey = toDateKey(new Date(year, monthIndex, monthLength));
  // A year view calls this for every month. Exclude unrelated events once,
  // before testing the individual days of the selected month.
  const monthEvents = events.filter((event) => {
    if (!hasValidBounds(event)) return false;
    if (event.allDay) {
      return event.start.slice(0, 10) <= lastDateKey && event.end.slice(0, 10) >= firstDateKey;
    }
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (start === end) return start >= monthStartTime && start < nextMonthStartTime;
    return start < nextMonthStartTime && end > monthStartTime;
  });
  const overlappingEvents = new Set<CalendarEvent>();
  const days: CalendarMonthStats['days'] = Array.from({ length: monthLength }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1);
    const matches = monthEvents.filter((event) => eventOverlapsDay(event.start, event.end, date, { allDay: event.allDay }));
    for (const event of matches) overlappingEvents.add(event);
    return {
      date,
      key: toDateKey(date),
      count: matches.length,
      absence: matches.some((event) => absenceTypes.has(event.type)),
    };
  });
  return {
    totalEvents: overlappingEvents.size,
    absenceDays: days.filter((day) => day.absence).length,
    days,
  };
}
