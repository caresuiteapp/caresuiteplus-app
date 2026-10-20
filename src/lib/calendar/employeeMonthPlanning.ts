import type { CalendarEvent } from '@/types/modules/calendarEvent';

export type PlanningKind = 'available' | 'blocked';
export type PlanningSlot = {
  id: string;
  date: string;
  kind: PlanningKind;
  startTime: string;
  endTime: string;
  label: string;
};
export type PlanningDraft = PlanningSlot & { sourceText?: string; uncertain?: boolean; requiresClassification?: boolean; endTimeDefaulted?: boolean };

/** User-selected availability default; known end times and unclassified/external shifts stay intact. */
export function withDefaultAvailabilityEnd(row: PlanningDraft): PlanningDraft {
  return row.kind === 'available' && !row.requiresClassification && !row.endTime.trim()
    ? { ...row, endTime: '24:00', endTimeDefaulted: true }
    : row;
}
export type EmployeeMonthPlan = {
  tenant_id: string;
  employee_id: string;
  month: string;
  revision: number;
  slots: PlanningSlot[];
};
export type PlanningInterval = { start: number; end: number };
export type DayPlanability = {
  status: 'available' | 'busy' | 'blocked' | 'unknown';
  declared: PlanningInterval[];
  free: PlanningInterval[];
  blocked: PlanningInterval[];
  conflict: boolean;
};
export const PLANNING_TIMEZONE = 'Europe/Berlin';

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
export function datesInMonth(month: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, mon] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
export function timeMinutes(time: string, end = false): number {
  if (end && time === '24:00') return 1440;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function minuteTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function intervalText(intervals: PlanningInterval[]): string {
  return intervals.map(({ start, end }) => start === 0 && end === 1440 ? 'ganztägig' : `${minuteTime(start)}–${minuteTime(end)}`).join(', ');
}
export function validatePlanningSlots(slots: PlanningSlot[], month: string): string[] {
  const validDates = new Set(datesInMonth(month));
  const errors: string[] = [];
  const ids = new Set<string>();
  if (!validDates.size) errors.push('Ungültiger Monat.');
  if (slots.length > 300) errors.push('Maximal 300 Zeitfenster je Monat.');
  for (const [index, slot] of slots.entries()) {
    const prefix = `Zeile ${index + 1}`;
    if (!slot.id || ids.has(slot.id)) errors.push(`${prefix}: doppelte oder fehlende Kennung.`);
    ids.add(slot.id);
    if (!validDates.has(slot.date)) errors.push(`${prefix}: Datum muss im gewählten Monat liegen.`);
    if (!['available', 'blocked'].includes(slot.kind)) errors.push(`${prefix}: Art fehlt.`);
    const start = timeMinutes(slot.startTime), end = timeMinutes(slot.endTime, true);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errors.push(`${prefix}: vollständige Uhrzeiten HH:MM mit Ende nach Beginn erforderlich (Nachtdienst auf zwei Tage aufteilen).`);
    }
    if (slot.label.length > 160) errors.push(`${prefix}: Bezeichnung höchstens 160 Zeichen.`);
  }
  return errors;
}
export function mergeIntervals(intervals: PlanningInterval[]): PlanningInterval[] {
  const sorted = intervals.filter((i) => i.end > i.start).map((i) => ({ ...i })).sort((a, b) => a.start - b.start);
  const result: PlanningInterval[] = [];
  for (const interval of sorted) {
    const last = result[result.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else result.push(interval);
  }
  return result;
}
export function subtractIntervals(available: PlanningInterval[], blocked: PlanningInterval[]): PlanningInterval[] {
  let result = mergeIntervals(available);
  for (const block of mergeIntervals(blocked)) {
    result = result.flatMap((window) => {
      if (block.end <= window.start || block.start >= window.end) return [window];
      return [
        ...(block.start > window.start ? [{ start: window.start, end: block.start }] : []),
        ...(block.end < window.end ? [{ start: block.end, end: window.end }] : []),
      ];
    });
  }
  return result;
}
const berlinFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: PLANNING_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function berlinParts(value: string | number) {
  const parts = berlinFormatter.formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}
export function berlinTimestamp(date: string, time: string): string {
  const target = Date.parse(`${date}T${time === '24:00' ? '00:00' : time}:00Z`) + (time === '24:00' ? 86400000 : 0);
  let utc = target;
  for (let i = 0; i < 3; i++) {
    const actual = berlinParts(utc);
    const delta = target - Date.parse(`${actual.date}T${actual.time}:00Z`);
    if (!delta) return new Date(utc).toISOString();
    utc += delta;
  }
  throw new Error('Diese Ortszeit existiert wegen der Zeitumstellung nicht. Bitte Uhrzeit anpassen.');
}
export function eventEmployeeId(event: CalendarEvent): string | null {
  return event.employeeId ?? event.record?.relatedEmployeeId ?? (event.sourceType === 'employee_birthday' ? event.sourceId : null) ?? null;
}
export function filterEmployeeEvents(events: CalendarEvent[], employeeId: string): CalendarEvent[] {
  return employeeId ? events.filter((event) => eventEmployeeId(event) === employeeId) : events;
}
export function eventIntervalForDate(event: CalendarEvent, date: string): PlanningInterval | null {
  if (['cancelled', 'canceled', 'abgesagt', 'storniert', 'rejected', 'archiviert'].includes(event.status?.trim().toLowerCase() ?? '')) return null;
  if (['geburtstag', 'feiertag', 'erinnerung'].includes(event.type)) return null;
  if (event.allDay) {
    // Existing all-day events use inclusive calendar dates rather than UTC instants.
    return date >= event.start.slice(0, 10) && date <= event.end.slice(0, 10) ? { start: 0, end: 1440 } : null;
  }
  const start = berlinParts(event.start), end = berlinParts(event.end);
  if (date < start.date || date > end.date) return null;
  const interval = { start: date === start.date ? timeMinutes(start.time) : 0, end: date === end.date ? timeMinutes(end.time) : 1440 };
  // A booking spanning the repeated autumn hour blocks both occurrences of 02:xx.
  const startOffset = Math.round((Date.parse(`${start.date}T${start.time}:00Z`) - Date.parse(event.start)) / 60000);
  const endOffset = Math.round((Date.parse(`${end.date}T${end.time}:00Z`) - Date.parse(event.end)) / 60000);
  if (start.date === date && end.date === date && endOffset - startOffset === -60) {
    interval.start = Math.min(interval.start, 120);
    interval.end = Math.max(interval.end, 180);
  }
  return interval.end > interval.start ? interval : null;
}
export function dayPlanability(date: string, slots: PlanningSlot[], employeeEvents: CalendarEvent[]): DayPlanability {
  const own = slots.filter((s) => s.date === date);
  const declared = mergeIntervals(own.filter((s) => s.kind === 'available').map((s) => ({ start: timeMinutes(s.startTime), end: timeMinutes(s.endTime, true) })));
  const absenceTypes = new Set(['urlaub', 'krank', 'abwesenheit', 'weiterbildung']);
  const explicit = own.filter((s) => s.kind === 'blocked').map((s) => ({ start: timeMinutes(s.startTime), end: timeMinutes(s.endTime, true) }));
  const absenceBlocks = employeeEvents.filter((e) => absenceTypes.has(e.type)).map((e) => eventIntervalForDate(e, date)).filter((i): i is PlanningInterval => !!i);
  const booked = employeeEvents.filter((e) => !absenceTypes.has(e.type)).map((e) => eventIntervalForDate(e, date)).filter((i): i is PlanningInterval => !!i);
  const blocked = mergeIntervals([...explicit, ...absenceBlocks]);
  const allowed = subtractIntervals(declared, blocked);
  const free = subtractIntervals(allowed, booked);
  const conflict = booked.some((booking) => blocked.some((b) => b.start < booking.end && booking.start < b.end)
    || (declared.length > 0 && subtractIntervals([booking], allowed).length > 0));
  return {
    status: free.length ? 'available' : declared.length ? (allowed.length ? 'busy' : 'blocked') : blocked.some((b) => b.start === 0 && b.end === 1440) ? 'blocked' : 'unknown',
    declared, free, blocked, conflict,
  };
}
export function planningAbsenceEvents(plan: EmployeeMonthPlan, employeeName: string): CalendarEvent[] {
  return plan.slots.filter((s) => s.kind === 'blocked').map((slot) => ({
    id: `month-plan:${plan.employee_id}:${slot.id}`, employeeId: plan.employee_id,
    title: `${slot.label || 'Nicht verfügbar'} · ${employeeName}`, employeeName,
    start: berlinTimestamp(slot.date, slot.startTime), end: berlinTimestamp(slot.date, slot.endTime),
    type: 'abwesenheit', sourceType: 'employee_month_plan', sourceId: slot.date, color: '#A78BFA', status: 'active',
    allDay: false,
  }));
}
