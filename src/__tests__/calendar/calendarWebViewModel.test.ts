import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import {
  addCalendarMonthsClamped,
  addCalendarYearsClamped,
  buildCalendarMonthStats,
  buildTimedDayLayout,
  calendarEventDateKey,
  groupCalendarEventsByDay,
  sortedCalendarEvents,
} from '@/lib/calendar/calendarWebViewModel';

const day = (date: number, month = 9, year = 2026) => new Date(year, month, date);
const instant = (date: number, hour = 0, minute = 0, month = 9, year = 2026) => new Date(year, month, date, hour, minute).toISOString();
const event = (id: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id, title: id, start, end, type: 'termin', color: '#2581d8', ...extra,
});

describe('calendar web date navigation', () => {
  it('advances January 31 into February and clamps backward navigation as well', () => {
    const original = new Date(2026, 0, 31, 14, 25);
    const next = addCalendarMonthsClamped(original, 1);
    expect([next.getFullYear(), next.getMonth(), next.getDate(), next.getHours(), next.getMinutes()]).toEqual([2026, 1, 28, 14, 25]);
    expect(addCalendarMonthsClamped(new Date(2026, 2, 31), -1)).toEqual(new Date(2026, 1, 28));
    expect(original).toEqual(new Date(2026, 0, 31, 14, 25));
  });

  it('retains February in leap-year navigation and crosses year boundaries', () => {
    expect(addCalendarMonthsClamped(new Date(2024, 0, 31), 1)).toEqual(new Date(2024, 1, 29));
    expect(addCalendarYearsClamped(new Date(2024, 1, 29), 1)).toEqual(new Date(2025, 1, 28));
    expect(addCalendarYearsClamped(new Date(2024, 1, 29), 4)).toEqual(new Date(2028, 1, 29));
    expect(addCalendarMonthsClamped(new Date(2026, 11, 31), 1)).toEqual(new Date(2027, 0, 31));
  });
});

describe('calendar web chronological grouping', () => {
  it('sorts actual instants across offsets and titles without changing the original array', () => {
    const late = event('Spät', '2026-10-17T09:00:00Z', '2026-10-17T10:00:00Z');
    const earlyB = event('B', '2026-10-17T10:00:00+02:00', '2026-10-17T11:00:00+02:00');
    const earlyA = { ...earlyB, id: 'A', title: 'A' };
    const source = [late, earlyB, earlyA];
    expect(sortedCalendarEvents(source).map((item) => item.id)).toEqual(['A', 'B', 'Spät']);
    expect(source).toEqual([late, earlyB, earlyA]);
  });

  it('uses local dates for timed events and floating dates for all-day absences', () => {
    // These instants cross UTC date boundaries in Europe/Berlin and Los Angeles.
    const early = event('early', instant(17, 0, 15), instant(17, 0, 30));
    const late = event('late', instant(17, 23, 30), instant(18, 1));
    const absence = event('absence', '2026-10-17T00:00:00.000Z', '2026-10-18T23:59:59.999Z', { allDay: true, type: 'urlaub' });
    expect(calendarEventDateKey(early)).toBe('2026-10-17');
    expect(calendarEventDateKey(late)).toBe('2026-10-17');
    expect(calendarEventDateKey(absence)).toBe('2026-10-17');
    const groups = groupCalendarEventsByDay([late, absence, early]);
    expect([...groups.keys()]).toEqual(['2026-10-17']);
    expect(groups.get('2026-10-17')).toHaveLength(3);
    expect([...groups.values()].flat().filter((item) => item === late)).toHaveLength(1);
  });

  it('orders mixed date groups and skips invalid dates', () => {
    const invalid = event('invalid', 'invalid', 'invalid');
    const wrongDate = event('wrong-date', '2026-02-31T00:00:00Z', '2026-03-02T23:59:59Z', { allDay: true });
    const later = event('later', instant(18), instant(18, 1));
    const earlier = event('earlier', instant(16), instant(16, 1));
    expect([...groupCalendarEventsByDay([later, invalid, wrongDate, earlier]).keys()]).toEqual(['2026-10-16', '2026-10-18']);
    expect(sortedCalendarEvents([invalid, earlier])[1]).toBe(invalid);
  });
});

describe('calendar web timed layout', () => {
  it('includes both sides of an overnight appointment but excludes a midnight end from the next day', () => {
    const overnight = event('night', instant(16, 22), instant(17, 6));
    const midnight = event('midnight', instant(16, 23), instant(17));
    const first = buildTimedDayLayout([overnight], day(16), { hourHeight: 60 });
    expect(first[0]).toMatchObject({ top: 1320, height: 120, continuesBefore: false, continuesAfter: true });
    const second = buildTimedDayLayout([overnight, midnight], day(17), { hourHeight: 60 });
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ event: overnight, top: 0, height: 360, continuesBefore: true, continuesAfter: false });
  });

  it('clips appointments to business hours and excludes points at the exclusive window end', () => {
    const before = event('before', instant(17, 6), instant(17, 10));
    const after = event('after', instant(17, 17), instant(17, 20));
    const outside = event('outside', instant(17, 5), instant(17, 8));
    const endPoint = event('endpoint', instant(17, 18), instant(17, 18));
    const blocks = buildTimedDayLayout([outside, after, before, endPoint], day(17), { startHour: 8, endHour: 18, hourHeight: 60 });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ event: before, top: 0, height: 120, continuesBefore: true });
    expect(blocks[1]).toMatchObject({ event: after, top: 540, height: 60, continuesAfter: true });
  });

  it('shows point events and keeps minimum-height cards inside the visible lower edge', () => {
    const point = event('point', instant(17, 9, 30), instant(17, 9, 30));
    const latePoint = event('late-point', instant(17, 23, 59), instant(17, 23, 59));
    const blocks = buildTimedDayLayout([latePoint, point], day(17), { hourHeight: 60 });
    expect(blocks[0]).toMatchObject({ event: point, top: 570, height: 28 });
    expect(blocks[1]).toMatchObject({ event: latePoint, top: 1412, height: 28 });
    expect(blocks.every((block) => block.top >= 0 && block.top + block.height <= 1440)).toBe(true);
  });

  it('ignores all-day, invalid, reversed, and non-intersecting events', () => {
    const items = [
      event('all-day', instant(17), instant(18), { allDay: true }),
      event('invalid', 'invalid', instant(18)),
      event('reverse', instant(17, 10), instant(17, 9)),
      event('tomorrow', instant(18), instant(18, 1)),
    ];
    expect(buildTimedDayLayout(items, day(17))).toEqual([]);
  });

  it('assigns consistent widths throughout a connected collision group and reuses columns', () => {
    const items = [
      event('A', instant(17, 9), instant(17, 10, 30)),
      event('B', instant(17, 10), instant(17, 11)),
      event('C', instant(17, 10, 45), instant(17, 12)),
      event('D', instant(17, 13), instant(17, 14)),
    ];
    const blocks = buildTimedDayLayout(items, day(17), { hourHeight: 60 });
    expect(blocks.map(({ column, columnCount }) => [column, columnCount])).toEqual([[0, 2], [1, 2], [0, 2], [0, 1]]);
  });

  it('prevents visual collisions between short appointments even when their actual times do not overlap', () => {
    const items = [
      event('A', instant(17, 9), instant(17, 9, 5)),
      event('B', instant(17, 9, 10), instant(17, 9, 15)),
      event('C', instant(17, 10), instant(17, 10, 5)),
    ];
    const blocks = buildTimedDayLayout(items, day(17), { hourHeight: 60, minHeight: 28 });
    expect(blocks.map(({ column, columnCount }) => [column, columnCount])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });

  it('keeps touching appointments in one column and expands an entire group for a triple overlap', () => {
    const items = [
      event('A', instant(17, 8), instant(17, 9)),
      event('B', instant(17, 9), instant(17, 12)),
      event('C', instant(17, 10), instant(17, 11)),
      event('D', instant(17, 10, 30), instant(17, 11, 30)),
    ];
    const blocks = buildTimedDayLayout(items, day(17), { hourHeight: 60 });
    expect(blocks.map(({ column, columnCount }) => [column, columnCount])).toEqual([[0, 1], [0, 3], [1, 3], [2, 3]]);
  });

  it.each([[29, 2], [25, 9]])('places late appointments by wall-clock time across DST on %s/%s', (date, month) => {
    const appointment = event('late', instant(date, 23, 30, month), instant(date + 1, 0, 0, month));
    const blocks = buildTimedDayLayout([appointment], day(date, month), { hourHeight: 60 });
    expect(blocks[0]).toMatchObject({ top: 1410, height: 30, continuesAfter: false });
    expect(buildTimedDayLayout([appointment], day(date + 1, month))).toEqual([]);
  });
});

describe('calendar web complete month statistics', () => {
  it.each([[2026, 1, 28], [2024, 1, 29], [2026, 3, 30], [2026, 9, 31]])('includes all %s/%s month days through day %s', (year, month, length) => {
    const last = event('last', instant(length, 12, 0, month, year), instant(length, 13, 0, month, year));
    const stats = buildCalendarMonthStats([last], year, month);
    expect(stats.days).toHaveLength(length);
    expect(stats.days.at(-1)).toMatchObject({ count: 1, absence: false });
    expect(stats.totalEvents).toBe(1);
  });

  it('counts multi-day events once in monthly totals and every affected absence day', () => {
    const spanning = event('spanning', '2026-09-29T00:00:00.000Z', '2026-10-02T23:59:59.999Z', { allDay: true, type: 'urlaub' });
    const overlapping = event('overlapping', '2026-10-02T00:00:00.000Z', '2026-10-03T23:59:59.999Z', { allDay: true, type: 'krank' });
    const stats = buildCalendarMonthStats([spanning, overlapping], 2026, 9);
    expect(stats.totalEvents).toBe(2);
    expect(stats.absenceDays).toBe(3);
    expect(stats.days.slice(0, 4).map(({ count, absence }) => [count, absence])).toEqual([[1, true], [2, true], [1, true], [0, false]]);
  });

  it('retains absences across the year boundary while excluding foreign months and next-month points', () => {
    const spanning = event('year-boundary', '2025-12-31T00:00:00.000Z', '2026-01-02T23:59:59.999Z', { allDay: true, type: 'urlaub' });
    const december = event('december', instant(15, 9, 0, 11, 2025), instant(15, 10, 0, 11, 2025));
    const february = event('february', '2026-02-01T00:00:00.000Z', '2026-02-02T23:59:59.999Z', { allDay: true });
    const firstPoint = event('first-point', instant(1, 0, 0, 0), instant(1, 0, 0, 0));
    const nextPoint = event('next-point', instant(1, 0, 0, 1), instant(1, 0, 0, 1));
    const stats = buildCalendarMonthStats([spanning, december, february, firstPoint, nextPoint], 2026, 0);
    expect(stats.totalEvents).toBe(2);
    expect(stats.absenceDays).toBe(2);
    expect(stats.days[0]).toMatchObject({ key: '2026-01-01', count: 2, absence: true });
    expect(stats.days[1].count).toBe(1);
    expect(stats.days.slice(2).every(({ count }) => count === 0)).toBe(true);
  });

  it('includes overnight and point events but excludes exclusive month-end and invalid bounds', () => {
    const night = event('night', instant(30, 23, 30, 8), instant(1, 1));
    const ended = event('ended', instant(30, 23, 0, 8), instant(1));
    const point = event('point', instant(31, 23, 59), instant(31, 23, 59));
    const reversed = event('reversed', instant(2), instant(1));
    const malformed = event('malformed', 'invalid', instant(2), { allDay: true, type: 'urlaub' });
    const stats = buildCalendarMonthStats([night, ended, point, reversed, malformed], 2026, 9);
    expect(stats.totalEvents).toBe(2);
    expect(stats.days[0].count).toBe(1);
    expect(stats.days[30].count).toBe(1);
    expect(stats.absenceDays).toBe(0);
  });
});
