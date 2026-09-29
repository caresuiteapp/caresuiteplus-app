import { describe, expect, it } from 'vitest';
import { berlinTimestamp, datesInMonth, dayPlanability, eventIntervalForDate, filterEmployeeEvents, planningAbsenceEvents, subtractIntervals, validatePlanningSlots, type PlanningSlot } from '@/lib/calendar/employeeMonthPlanning';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
const date = '2026-10-01';
const slot = (patch: Partial<PlanningSlot> = {}): PlanningSlot => ({ id: 's', date, kind: 'available', startTime: '08:00', endTime: '17:00', label: '', ...patch });
const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({ id: 'e', employeeId: 'a', title: 'Einsatz', type: 'einsatz', color: '#fff', start: berlinTimestamp(date, '10:00'), end: berlinTimestamp(date, '11:00'), ...patch });
describe('employee month planning', () => {
  it('computes remaining time around appointments and another job', () => {
    const result = dayPlanability(date, [slot(), slot({ id: 'b', kind: 'blocked', startTime: '12:00', endTime: '14:00' })], [event()]);
    expect(result.free).toEqual([{ start: 480, end: 600 }, { start: 660, end: 720 }, { start: 840, end: 1020 }]);
    expect(result.conflict).toBe(false);
  });
  it('does not infer availability for unreported days or outside an external job', () => {
    expect(dayPlanability(date, [], []).status).toBe('unknown');
    const result = dayPlanability(date, [slot({ kind: 'blocked' })], []);
    expect(result.status).toBe('unknown'); expect(result.free).toEqual([]);
  });
  it('blocks approved all-day absence even when availability was declared', () => {
    const result = dayPlanability(date, [slot()], [event({ type: 'urlaub', allDay: true, start: date, end: date })]);
    expect(result.status).toBe('blocked'); expect(result.free).toEqual([]);
  });
  it('shows conflicts for appointments overlapping a block or outside reported hours', () => {
    expect(dayPlanability(date, [slot({ startTime: '12:00' })], [event()]).conflict).toBe(true);
    expect(dayPlanability(date, [slot({ kind: 'blocked', startTime: '10:30', endTime: '11:30' })], [event()]).conflict).toBe(true);
  });
  it('handles exact boundaries and overlapping declarations without duplicates', () => {
    expect(subtractIntervals([{ start: 480, end: 600 }, { start: 500, end: 660 }], [{ start: 660, end: 800 }])).toEqual([{ start: 480, end: 660 }]);
  });
  it('ignores cancelled appointments, holidays and birthdays', () => {
    for (const patch of [{ status: ' Cancelled ' }, { type: 'geburtstag' as const }, { type: 'feiertag' as const }]) {
      expect(dayPlanability(date, [slot()], [event(patch)]).free).toEqual([{ start: 480, end: 1020 }]);
    }
  });
  it('filters by employee id even with identical names; excludes unrelated/global events', () => {
    const rows = [event({ employeeName: 'Alex' }), event({ id: 'other', employeeId: 'b', employeeName: 'Alex' }), event({ id: 'global', employeeId: undefined })];
    expect(filterEmployeeEvents(rows, 'a').map((e) => e.id)).toEqual(['e']);
    expect(filterEmployeeEvents(rows, '')).toBe(rows);
  });
  it('splits overnight appointments on Berlin calendar days', () => {
    const night = event({ start: berlinTimestamp(date, '22:00'), end: berlinTimestamp('2026-10-02', '06:00') });
    expect(eventIntervalForDate(night, date)).toEqual({ start: 1320, end: 1440 });
    expect(eventIntervalForDate(night, '2026-10-02')).toEqual({ start: 0, end: 360 });
  });
  it('converts Berlin summer/winter and 24:00 without an extra next-day block', () => {
    expect(berlinTimestamp(date, '08:00')).toBe('2026-10-01T06:00:00.000Z');
    expect(berlinTimestamp('2026-12-01', '08:00')).toBe('2026-12-01T07:00:00.000Z');
    const allDay = event({ start: berlinTimestamp(date, '00:00'), end: berlinTimestamp(date, '24:00') });
    expect(eventIntervalForDate(allDay, '2026-10-02')).toBeNull();
    expect(() => berlinTimestamp('2026-03-29', '02:30')).toThrow(/Zeitumstellung/);
  });
  it('rejects missing ends, wrong months, duplicates, impossible dates and overnight single rows', () => {
    for (const patch of [{ endTime: '' }, { date: '2026-11-01' }, { date: '2026-10-32' }, { startTime: '22:00', endTime: '06:00' }]) {
      expect(validatePlanningSlots([slot(patch)], '2026-10').length).toBeGreaterThan(0);
    }
    expect(validatePlanningSlots([slot(), slot()], '2026-10')).toContain('Zeile 2: doppelte oder fehlende Kennung.');
    expect(datesInMonth('2028-02')).toHaveLength(29);
    expect(validatePlanningSlots([slot({ endTime: '24:00' })], '2026-10')).toEqual([]);
  });
  it('blocks both occurrences of the repeated autumn hour', () => {
    expect(eventIntervalForDate(event({ start: '2026-10-25T00:30:00Z', end: '2026-10-25T01:15:00Z' }), '2026-10-25')).toEqual({ start: 120, end: 180 });
  });
  it('keeps the source date when midnight is in the previous UTC month', () => {
    const [block] = planningAbsenceEvents({ tenant_id: 't', employee_id: 'a', month: '2026-10-01', revision: 1, slots: [slot({ kind: 'blocked', startTime: '00:00', endTime: '24:00' })] }, 'Alex');
    expect(block.sourceId).toBe(date); expect(block.start.startsWith('2026-09-30')).toBe(true);
  });
});
