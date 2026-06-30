import { expandVisitRecurrenceDates } from '@/lib/assist/calculateAssistBudgetAllocation';
import type {
  VisitDispositionDetail,
  VisitDispositionListItem,
  VisitRecurrenceJson,
  VisitRecurrencePattern,
  VisitWeekdayKey,
} from '@/lib/assist/visitTypes';
import { isUuid } from '@/lib/validation/uuid';

export const VISIT_OCCURRENCE_SEPARATOR = '::';

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseVisitOccurrenceId(id: string): { visitId: string; occurrenceDate: string | null } {
  const idx = id.indexOf(VISIT_OCCURRENCE_SEPARATOR);
  if (idx === -1) {
    return { visitId: id, occurrenceDate: null };
  }

  const visitId = id.slice(0, idx);
  const occurrenceDate = id.slice(idx + VISIT_OCCURRENCE_SEPARATOR.length);
  if (!isUuid(visitId) || !DATE_KEY_REGEX.test(occurrenceDate)) {
    return { visitId: id, occurrenceDate: null };
  }

  return { visitId, occurrenceDate };
}

export function buildVisitOccurrenceId(visitId: string, occurrenceDate: string): string {
  return `${visitId}${VISIT_OCCURRENCE_SEPARATOR}${occurrenceDate}`;
}

export function resolveVisitMasterId(id: string): string {
  return parseVisitOccurrenceId(id).visitId;
}

export function isResolvableVisitId(id: string): boolean {
  return isUuid(resolveVisitMasterId(id));
}

export function parseVisitRecurrenceJson(raw: unknown): VisitRecurrenceJson {
  if (!raw || typeof raw !== 'object') return { pattern: 'none' };

  const obj = raw as Record<string, unknown>;
  const pattern = (obj.pattern as VisitRecurrencePattern) ?? 'none';
  if (pattern === 'none') return { pattern: 'none' };

  return {
    pattern,
    weekdays: Array.isArray(obj.weekdays) ? (obj.weekdays as VisitWeekdayKey[]) : undefined,
    endDate: typeof obj.endDate === 'string' ? obj.endDate : null,
    occurrenceCount: typeof obj.occurrenceCount === 'number' ? obj.occurrenceCount : null,
  };
}

function extractLocalTimeParts(iso: string): { hours: number; minutes: number; seconds: number } {
  const d = new Date(iso);
  return { hours: d.getHours(), minutes: d.getMinutes(), seconds: d.getSeconds() };
}

function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function shiftVisitScheduleToDate(
  scheduledStart: string,
  scheduledEnd: string,
  occurrenceDate: string,
): { scheduledStart: string; scheduledEnd: string } {
  const startParts = extractLocalTimeParts(scheduledStart);
  const endParts = extractLocalTimeParts(scheduledEnd);

  const start = new Date(
    `${occurrenceDate}T${padTimePart(startParts.hours)}:${padTimePart(startParts.minutes)}:${padTimePart(startParts.seconds)}`,
  );
  const end = new Date(
    `${occurrenceDate}T${padTimePart(endParts.hours)}:${padTimePart(endParts.minutes)}:${padTimePart(endParts.seconds)}`,
  );

  return {
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
  };
}

function durationMinutesFromRange(start: string, end: string, fallback: number | null): number | null {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return fallback;
  return Math.round(diff / 60000);
}

export type VisitRecurrenceSourceRow = {
  assignment_date: string;
  planned_start_at: string;
  planned_end_at: string;
  recurrence_json?: unknown;
};

export function expandVisitRowToListItems(
  row: VisitRecurrenceSourceRow,
  item: VisitDispositionListItem,
): VisitDispositionListItem[] {
  const recurrence = parseVisitRecurrenceJson(row.recurrence_json);
  if (recurrence.pattern === 'none') {
    return [item];
  }

  const dates = expandVisitRecurrenceDates({
    assignmentDate: row.assignment_date,
    recurrencePattern: recurrence.pattern,
    recurrenceWeekdays: recurrence.weekdays,
    recurrenceEndDate: recurrence.endDate ?? null,
    recurrenceOccurrenceCount: recurrence.occurrenceCount ?? null,
    maxOccurrences: recurrence.occurrenceCount ?? 52,
  });

  if (dates.length <= 1) {
    return [item];
  }

  return dates.map((dateKey, index) => {
    const shifted = shiftVisitScheduleToDate(row.planned_start_at, row.planned_end_at, dateKey);
    return {
      ...item,
      id: index === 0 ? item.id : buildVisitOccurrenceId(item.id, dateKey),
      scheduledStart: shifted.scheduledStart,
      scheduledEnd: shifted.scheduledEnd,
      durationMinutes: durationMinutesFromRange(
        shifted.scheduledStart,
        shifted.scheduledEnd,
        item.durationMinutes,
      ),
    };
  });
}

export function expandVisitDispositionListItems(
  rows: Array<{ row: VisitRecurrenceSourceRow; item: VisitDispositionListItem }>,
): VisitDispositionListItem[] {
  const expanded = rows.flatMap(({ row, item }) => expandVisitRowToListItems(row, item));
  return expanded.sort(
    (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
  );
}

export function applyOccurrenceDateToVisitDetail(
  detail: VisitDispositionDetail,
  occurrenceDate: string,
  occurrenceId: string,
): VisitDispositionDetail {
  const shifted = shiftVisitScheduleToDate(
    detail.scheduledStart,
    detail.scheduledEnd,
    occurrenceDate,
  );

  return {
    ...detail,
    id: occurrenceId,
    scheduledStart: shifted.scheduledStart,
    scheduledEnd: shifted.scheduledEnd,
    durationMinutes: durationMinutesFromRange(
      shifted.scheduledStart,
      shifted.scheduledEnd,
      detail.durationMinutes,
    ),
  };
}
