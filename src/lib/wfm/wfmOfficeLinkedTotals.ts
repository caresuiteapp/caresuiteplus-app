import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

type Interval = [number, number];
type Trip = { started_at: unknown; ended_at: unknown; status: unknown; counts_as_work_time: unknown };
function interval(start: unknown, end: unknown): Interval | null {
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const a = Date.parse(start), b = Date.parse(end);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : null;
}
function union(input: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const [start, end] of input.sort((a, b) => a[0] - b[0])) {
    const previous = result[result.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else result.push([start, end]);
  }
  return result;
}
/** Travel is part of working time. Add only intervals not already captured by a booking. */
export function calculateOfficeLogbookTime(trips: Trip[], entries: WfmOfficeTimeEntry[]) {
  const travel = union(trips.filter(trip => trip.counts_as_work_time === true && ['completed', 'corrected', 'confirmed'].includes(String(trip.status)))
    .map(trip => interval(trip.started_at, trip.ended_at)).filter((value): value is Interval => value !== null));
  const booked = union(entries.map(entry => interval(entry.actualStartAt, entry.actualEndAt)).filter((value): value is Interval => value !== null));
  let travelMs = 0, coveredMs = 0;
  for (const [start, end] of travel) {
    travelMs += end - start;
    for (const [a, b] of booked) coveredMs += Math.max(0, Math.min(end, b) - Math.max(start, a));
  }
  return { travelMinutes: Math.round(travelMs / 60_000), additionalMinutes: Math.round((travelMs - coveredMs) / 60_000) };
}

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export function officeAbsenceMinutes(absence: Record<string, unknown>, workDays: unknown, fromDate: string, toDate: string): number {
  if (!['approved', 'active', 'completed'].includes(String(absence.status)) || ['unpaid_leave', 'parental_leave'].includes(String(absence.absence_type))) return 0;
  const schedule = workDays && typeof workDays === 'object' ? workDays as Record<string, unknown> : {};
  const dateKey = (value: unknown) => typeof value === 'string' ? value.slice(0, 10) : '';
  const from = dateKey(absence.starts_at), to = dateKey(absence.ends_at);
  if (!from || !to || to < fromDate || from > toDate) return 0;
  const cursor = new Date(`${from > fromDate ? from : fromDate}T12:00:00Z`);
  const end = new Date(`${to < toDate ? to : toDate}T12:00:00Z`);
  let minutes = 0;
  while (cursor <= end) {
    const hours = Number(schedule[days[cursor.getUTCDay()]]);
    if (Number.isFinite(hours) && hours > 0) minutes += Math.round(hours * 60);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return minutes;
}
