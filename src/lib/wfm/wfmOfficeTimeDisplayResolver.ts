import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

export type WfmOfficeTimeSource =
  | 'time_entry'
  | 'assignment_actual'
  | 'assignment_planned'
  | 'missing';

export interface WfmOfficeTimeDisplay {
  plannedStart: string | null;
  plannedEnd: string | null;
  plannedDurationMinutes: number;
  actualStart: string | null;
  actualEnd: string | null;
  actualDurationMinutes: number;
  displayStart: string | null;
  displayEnd: string | null;
  displayDurationMinutes: number;
  timeSource: WfmOfficeTimeSource;
  hasTimeEntry: boolean;
}

function minutesBetween(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000);
}

export function resolveWfmOfficeTimeDisplay(entry: WfmOfficeTimeEntry): WfmOfficeTimeDisplay {
  const plannedStart = entry.plannedStartAt ?? null;
  const plannedEnd = entry.plannedEndAt ?? null;
  const plannedDurationMinutes = minutesBetween(plannedStart, plannedEnd);

  const actualStart = entry.actualStartAt ?? null;
  const actualEnd = entry.actualEndAt ?? null;
  const hasTimeEntry = Boolean(actualStart || actualEnd);

  const assignmentActualStart = entry.assignmentActualStartAt ?? null;
  const assignmentActualEnd = entry.assignmentActualEndAt ?? null;
  const hasAssignmentActual = Boolean(assignmentActualStart || assignmentActualEnd);

  let timeSource: WfmOfficeTimeSource = 'missing';
  let displayStart: string | null = null;
  let displayEnd: string | null = null;
  let displayDurationMinutes = 0;

  if (hasTimeEntry) {
    timeSource = 'time_entry';
    displayStart = actualStart;
    displayEnd = actualEnd;
    displayDurationMinutes =
      entry.netMinutes > 0 ? entry.netMinutes : minutesBetween(actualStart, actualEnd);
  } else if (hasAssignmentActual) {
    timeSource = 'assignment_actual';
    displayStart = assignmentActualStart;
    displayEnd = assignmentActualEnd;
    displayDurationMinutes = minutesBetween(assignmentActualStart, assignmentActualEnd);
  } else if (plannedStart || plannedEnd) {
    timeSource = 'assignment_planned';
    displayStart = plannedStart;
    displayEnd = plannedEnd;
    displayDurationMinutes = plannedDurationMinutes;
  }

  const actualDurationMinutes = hasTimeEntry
    ? entry.netMinutes > 0
      ? entry.netMinutes
      : minutesBetween(actualStart, actualEnd)
    : 0;

  return {
    plannedStart,
    plannedEnd,
    plannedDurationMinutes,
    actualStart,
    actualEnd,
    actualDurationMinutes,
    displayStart,
    displayEnd,
    displayDurationMinutes,
    timeSource,
    hasTimeEntry,
  };
}

export function enrichOfficeTimeEntryDisplay(entry: WfmOfficeTimeEntry): WfmOfficeTimeEntry {
  const display = resolveWfmOfficeTimeDisplay(entry);
  return {
    ...entry,
    timeSource: display.timeSource,
    displayStartAt: display.displayStart,
    displayEndAt: display.displayEnd,
    displayDurationMinutes: display.displayDurationMinutes,
    plannedDurationMinutes: display.plannedDurationMinutes,
  };
}
