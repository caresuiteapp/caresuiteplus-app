import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

type Row = Record<string, unknown>;
const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const OFFICE_ACCOUNT_PAGE_SIZE = 500;

/** A failed or malformed page must never become a successful partial account. */
export async function readAllOfficeAccountRows(
  readPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<{ data: Row[]; error: unknown }> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += OFFICE_ACCOUNT_PAGE_SIZE) {
    const result = await readPage(offset, offset + OFFICE_ACCOUNT_PAGE_SIZE - 1);
    if (result.error) return { data: [], error: result.error };
    if (!Array.isArray(result.data) || result.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      return { data: [], error: new Error('Die Zeitkontodaten wurden unvollständig zurückgegeben. Bitte erneut laden.') };
    }
    rows.push(...result.data as Row[]);
    if (result.data.length < OFFICE_ACCOUNT_PAGE_SIZE) return { data: rows, error: null };
  }
}

/** Bound the IN filter as well as each page for larger teams. */
export async function readOfficeEmployeeAccountRows(
  employeeIds: string[],
  readPage: (employeeIds: string[], from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<{ data: Row[]; error: unknown }> {
  const rows: Row[] = [];
  const ids = [...new Set(employeeIds)];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const result = await readAllOfficeAccountRows((first, last) => readPage(batch, first, last));
    if (result.error) return { data: [], error: result.error };
    rows.push(...result.data);
  }
  return { data: rows, error: null };
}

export function hasOfficeContractSchedule(workDays: unknown): workDays is Row {
  if (!workDays || typeof workDays !== 'object' || Array.isArray(workDays)) return false;
  const schedule = workDays as Row;
  const present = weekdays.filter(day => schedule[day] != null);
  return present.length > 0 && present.every(day => {
    const value = schedule[day];
    return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
      && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 24;
  });
}

export function resolveOfficeAccountTarget(contractMinutes: number | null, savedMinutes: number | null, plannedMinutes: number) {
  if (contractMinutes != null) return { targetMinutes: contractMinutes, targetSource: 'contract' as const };
  if (savedMinutes != null) return { targetMinutes: savedMinutes, targetSource: 'saved_account' as const };
  return { targetMinutes: plannedMinutes, targetSource: 'planned' as const };
}

export function isOfficeAccountOpenReview(entry: WfmOfficeTimeEntry): boolean {
  return entry.rowKind !== 'planned_upcoming' && !entry.flags.includes('upcoming')
    && ['open', 'pending_review', 'needs_clarification', 'corrected'].includes(entry.reviewStatus);
}

/** Respect recorded zero net time and subtract pauses in the legacy duration fallback. */
export function officeAccountRecordedMinutes(entry: WfmOfficeTimeEntry): number {
  if (!entry.actualStartAt && !entry.actualEndAt) return 0;
  const start = Date.parse(entry.actualStartAt ?? ''), end = Date.parse(entry.actualEndAt ?? '');
  const gross = Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 60_000) : 0;
  const pause = Number.isFinite(entry.pauseMinutes) ? Math.max(0, entry.pauseMinutes) : 0;
  if (Number.isFinite(entry.netMinutes) && (entry.netMinutes > 0 || entry.source === 'correction' || entry.source === 'manual_addition' || pause >= gross)) {
    return Math.max(0, entry.netMinutes);
  }
  return Math.max(0, gross - pause);
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function berlinDay(value: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function berlinMidnight(day: string): number {
  const approximate = Date.parse(`${day}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(approximate));
  return approximate - hour * 3_600_000;
}

/** Each contractual day can be credited once, including overlapping requests. */
export function calculateOfficeAbsenceCredit(absences: Row[], workDays: unknown, fromDate: string, toDate: string): number {
  if (!hasOfficeContractSchedule(workDays) || !isDateKey(fromDate) || !isDateKey(toDate) || fromDate > toDate) return 0;
  const fullDays = new Set<string>();
  const partialByDay = new Map<string, [number, number][]>();
  for (const absence of absences) {
    if (!['approved', 'active', 'completed'].includes(String(absence.status)) || ['unpaid_leave', 'parental_leave'].includes(String(absence.absence_type))) continue;
    if (typeof absence.starts_at !== 'string' || typeof absence.ends_at !== 'string') continue;
    const start = Date.parse(absence.starts_at), end = Date.parse(absence.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    // All-day requests are stored as UTC date markers by parseWfmAbsenceDateRange.
    // Partial requests represent instants, and therefore use the Berlin work day.
    const fullDay = absence.all_day !== false;
    const first = fullDay ? absence.starts_at.slice(0, 10) : berlinDay(start);
    const last = fullDay ? absence.ends_at.slice(0, 10) : berlinDay(Math.max(start, end - 1));
    if (!isDateKey(first) || !isDateKey(last)) continue;
    const cursor = new Date(`${first > fromDate ? first : fromDate}T12:00:00Z`);
    const lastDay = last < toDate ? last : toDate;
    while (cursor.toISOString().slice(0, 10) <= lastDay) {
      const day = cursor.toISOString().slice(0, 10);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (fullDay) { fullDays.add(day); continue; }
      const segment: [number, number] = [Math.max(start, berlinMidnight(day)), Math.min(end, berlinMidnight(cursor.toISOString().slice(0, 10)))];
      if (segment[1] > segment[0]) partialByDay.set(day, [...(partialByDay.get(day) ?? []), segment]);
    }
  }
  let minutes = 0;
  for (const day of new Set([...fullDays, ...partialByDay.keys()])) {
    const weekday = weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()];
    const target = Math.round(Number(workDays[weekday] ?? 0) * 60);
    if (fullDays.has(day)) { minutes += target; continue; }
    let duration = 0;
    let previous: [number, number] | null = null;
    for (const segment of (partialByDay.get(day) ?? []).sort((a, b) => a[0] - b[0])) {
      if (previous && segment[0] <= previous[1]) previous[1] = Math.max(previous[1], segment[1]);
      else { if (previous) duration += previous[1] - previous[0]; previous = [...segment]; }
    }
    if (previous) duration += previous[1] - previous[0];
    minutes += Math.min(target, Math.round(duration / 60_000));
  }
  return minutes;
}
