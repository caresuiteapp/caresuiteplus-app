import { describe, expect, it } from 'vitest';
import { eventOverlapsDay, eventsForDay } from '@/lib/office/calendarDateUtils';

const day = (date: number, month = 9) => new Date(2026, month, date);
const instant = (date: number, hour = 0, minute = 0, month = 9) => new Date(2026, month, date, hour, minute).toISOString();

describe('calendar day boundaries', () => {
  it.each([6, 12, 19, 26])('shows a block on October %s only, without a duplicate on the next day', (date) => {
    const block = { start: instant(date), end: instant(date + 1), allDay: false };
    expect(eventsForDay([block], day(date - 1))).toEqual([]);
    expect(eventsForDay([block], day(date))).toEqual([block]);
    expect(eventsForDay([block], day(date + 1))).toEqual([]);
  });

  it('keeps an actual overnight shift on both affected days', () => {
    const shift = { start: instant(6, 22), end: instant(7, 6) };
    expect(eventsForDay([shift], day(6))).toEqual([shift]);
    expect(eventsForDay([shift], day(7))).toEqual([shift]);
    expect(eventsForDay([shift], day(8))).toEqual([]);
  });

  it('keeps an evening block ending at midnight off the following day', () => {
    expect(eventOverlapsDay(instant(6, 13), instant(7), day(6))).toBe(true);
    expect(eventOverlapsDay(instant(6, 13), instant(7), day(7))).toBe(false);
  });

  it.each([[29, 2], [25, 9]])('uses the actual local midnight on the daylight-saving date %s/%s', (date, month) => {
    const late = { start: instant(date, 23, 30, month), end: instant(date + 1, 0, 0, month) };
    const next = { start: instant(date + 1, 0, 15, month), end: instant(date + 1, 0, 45, month) };
    expect(eventsForDay([late, next], day(date, month))).toEqual([late]);
    expect(eventsForDay([late, next], day(date + 1, month))).toEqual([next]);
  });

  it('preserves inclusive date-only bounds for existing all-day absences', () => {
    const absence = { start: '2026-10-06T00:00:00.000Z', end: '2026-10-07T23:59:59.999Z', allDay: true };
    expect(eventsForDay([absence], day(6))).toEqual([absence]);
    expect(eventsForDay([absence], day(7))).toEqual([absence]);
    expect(eventsForDay([absence], day(8))).toEqual([]);
  });

  it('keeps point events on their own day and excludes invalid or reversed ranges', () => {
    expect(eventOverlapsDay(instant(7), instant(7), day(7))).toBe(true);
    expect(eventOverlapsDay(instant(7), instant(7), day(6))).toBe(false);
    expect(eventOverlapsDay(instant(7), instant(6), day(6))).toBe(false);
    expect(eventOverlapsDay('invalid', instant(7), day(6))).toBe(false);
  });
});
