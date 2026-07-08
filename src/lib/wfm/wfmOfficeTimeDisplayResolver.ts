import type { WfmOfficeTimeEntry, WfmOfficeTimeSource } from '@/types/modules/wfmOfficeTimekeeping';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  return `${h}:${String(m).padStart(2, '0')} h`;
}

function formatPlanRange(
  plannedStart: string | null,
  plannedEnd: string | null,
  planStatus?: import('@/types/modules/wfmOfficeTimekeeping').WfmOfficePlanDisplayStatus,
): string {
  if (planStatus === 'no_planned_visit') return 'Kein geplanter Einsatz zugeordnet';
  if (planStatus === 'plan_missing' || (!plannedStart && !plannedEnd)) return 'Planzeit fehlt';
  return `${formatTime(plannedStart)} – ${formatTime(plannedEnd)}`;
}

export type WfmOfficeBookingStatus = 'booked' | 'missing_booking' | 'assignment_only' | 'not_captured';

export interface WfmOfficeTimeDisplay {
  plannedStart: string | null;
  plannedEnd: string | null;
  plannedDurationMinutes: number;
  assignmentActualStart: string | null;
  assignmentActualEnd: string | null;
  assignmentActualDurationMinutes: number;
  timeEntryStart: string | null;
  timeEntryEnd: string | null;
  timeEntryDurationMinutes: number;
  approvedStart: string | null;
  approvedEnd: string | null;
  approvedDurationMinutes: number;
  displayPrimaryTimeLabel: string;
  displaySecondaryTimeLabel: string;
  displayDurationLabel: string;
  displaySource: WfmOfficeTimeSource;
  bookingStatus: WfmOfficeBookingStatus;
  reviewStatus: WfmOfficeTimeEntry['reviewStatus'];
  exportStatus: WfmOfficeTimeEntry['exportStatus'];
  canOpenDetails: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRequestClarification: boolean;
  /** @deprecated use displaySource */
  timeSource: WfmOfficeTimeSource;
  /** @deprecated use timeEntryStart */
  actualStart: string | null;
  /** @deprecated use timeEntryEnd */
  actualEnd: string | null;
  /** @deprecated use timeEntryDurationMinutes */
  actualDurationMinutes: number;
  /** @deprecated */
  displayStart: string | null;
  /** @deprecated */
  displayEnd: string | null;
  /** @deprecated */
  displayDurationMinutes: number;
  hasTimeEntry: boolean;
  hasAssignmentActual: boolean;
  isPlannedOnly: boolean;
}

function minutesBetween(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000);
}

function isApprovedEntry(entry: WfmOfficeTimeEntry): boolean {
  return entry.reviewStatus === 'approved' || entry.reviewStatus === 'exported';
}

function resolveBookingStatus(
  hasTimeEntry: boolean,
  hasAssignmentActual: boolean,
  isPlannedOnly: boolean,
): WfmOfficeBookingStatus {
  if (hasTimeEntry) return 'booked';
  if (hasAssignmentActual) return 'assignment_only';
  if (isPlannedOnly) return 'missing_booking';
  return 'not_captured';
}

function resolveCapabilities(entry: WfmOfficeTimeEntry): {
  canOpenDetails: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRequestClarification: boolean;
} {
  const terminal = entry.reviewStatus === 'exported' || entry.reviewStatus === 'locked';
  const open =
    entry.reviewStatus === 'pending_review' ||
    entry.reviewStatus === 'needs_clarification' ||
    entry.reviewStatus === 'open';
  return {
    canOpenDetails: true,
    canEdit: !terminal,
    canApprove: open && !terminal,
    canReject: open && !terminal,
    canRequestClarification: open && !terminal,
  };
}

export function resolveWfmOfficeTimeDisplay(entry: WfmOfficeTimeEntry): WfmOfficeTimeDisplay {
  const plannedStart = entry.plannedStartAt ?? null;
  const plannedEnd = entry.plannedEndAt ?? null;
  const plannedDurationMinutes = minutesBetween(plannedStart, plannedEnd);

  const assignmentActualStart = entry.assignmentActualStartAt ?? null;
  const assignmentActualEnd = entry.assignmentActualEndAt ?? null;
  const assignmentActualDurationMinutes = minutesBetween(assignmentActualStart, assignmentActualEnd);
  const hasAssignmentActual = Boolean(assignmentActualStart || assignmentActualEnd);

  const timeEntryStart = entry.actualStartAt ?? null;
  const timeEntryEnd = entry.actualEndAt ?? null;
  const hasTimeEntry = Boolean(timeEntryStart || timeEntryEnd);
  const timeEntryDurationMinutes = hasTimeEntry
    ? entry.netMinutes > 0
      ? entry.netMinutes
      : minutesBetween(timeEntryStart, timeEntryEnd)
    : 0;

  const approved = isApprovedEntry(entry);
  const approvedStart = approved ? timeEntryStart ?? assignmentActualStart : null;
  const approvedEnd = approved ? timeEntryEnd ?? assignmentActualEnd : null;
  const approvedDurationMinutes = approved
    ? timeEntryDurationMinutes > 0
      ? timeEntryDurationMinutes
      : minutesBetween(approvedStart, approvedEnd)
    : 0;

  let displaySource: WfmOfficeTimeSource = 'missing';
  if (approved && (approvedStart || approvedEnd)) {
    displaySource = 'approved_time_entry';
  } else if (hasTimeEntry) {
    displaySource = 'time_entry';
  } else if (hasAssignmentActual) {
    displaySource = 'assignment_actual';
  } else if (plannedStart || plannedEnd) {
    displaySource = 'planned_only';
  }

  const isPlannedOnly = displaySource === 'planned_only';
  const bookingStatus = resolveBookingStatus(hasTimeEntry, hasAssignmentActual, isPlannedOnly);
  const capabilities = resolveCapabilities(entry);

  let displayPrimaryTimeLabel = 'Noch nicht erfasst';
  let displaySecondaryTimeLabel = '';
  let displayDurationLabel = '—';

  if (displaySource === 'approved_time_entry' || displaySource === 'time_entry') {
    displayPrimaryTimeLabel = `Ist: ${formatTime(timeEntryStart)} – ${formatTime(timeEntryEnd)}`;
    displayDurationLabel = formatDurationMinutes(timeEntryDurationMinutes);
  } else if (displaySource === 'assignment_actual') {
    displayPrimaryTimeLabel = `Einsatz-Ist: ${formatTime(assignmentActualStart)} – ${formatTime(assignmentActualEnd)}`;
    displaySecondaryTimeLabel = 'Fehlende Buchung';
    displayDurationLabel = `Dauer Einsatz-Ist: ${formatDurationMinutes(assignmentActualDurationMinutes)}`;
  } else if (displaySource === 'planned_only') {
    displayPrimaryTimeLabel = 'Ist: noch nicht gebucht';
    displaySecondaryTimeLabel = `Plan: ${formatPlanRange(plannedStart, plannedEnd, entry.planDisplayStatus)}`;
    displayDurationLabel = `Geplante Dauer: ${formatDurationMinutes(plannedDurationMinutes)}`;
  }

  const displayStart =
    displaySource === 'time_entry' || displaySource === 'approved_time_entry'
      ? timeEntryStart
      : displaySource === 'assignment_actual'
        ? assignmentActualStart
        : null;
  const displayEnd =
    displaySource === 'time_entry' || displaySource === 'approved_time_entry'
      ? timeEntryEnd
      : displaySource === 'assignment_actual'
        ? assignmentActualEnd
        : null;
  const displayDurationMinutes =
    displaySource === 'time_entry' || displaySource === 'approved_time_entry'
      ? timeEntryDurationMinutes
      : displaySource === 'assignment_actual'
        ? assignmentActualDurationMinutes
        : 0;

  return {
    plannedStart,
    plannedEnd,
    plannedDurationMinutes,
    assignmentActualStart,
    assignmentActualEnd,
    assignmentActualDurationMinutes,
    timeEntryStart,
    timeEntryEnd,
    timeEntryDurationMinutes,
    approvedStart,
    approvedEnd,
    approvedDurationMinutes,
    displayPrimaryTimeLabel,
    displaySecondaryTimeLabel,
    displayDurationLabel,
    displaySource,
    bookingStatus,
    reviewStatus: entry.reviewStatus,
    exportStatus: entry.exportStatus,
    ...capabilities,
    timeSource: displaySource === 'approved_time_entry' ? 'time_entry' : displaySource,
    actualStart: timeEntryStart,
    actualEnd: timeEntryEnd,
    actualDurationMinutes: timeEntryDurationMinutes,
    displayStart,
    displayEnd,
    displayDurationMinutes,
    hasTimeEntry,
    hasAssignmentActual,
    isPlannedOnly,
  };
}

export function enrichOfficeTimeEntryDisplay(entry: WfmOfficeTimeEntry): WfmOfficeTimeEntry {
  const display = resolveWfmOfficeTimeDisplay(entry);
  return {
    ...entry,
    timeSource: display.displaySource === 'approved_time_entry' ? 'time_entry' : display.displaySource,
    displayStartAt: display.displayStart,
    displayEndAt: display.displayEnd,
    displayDurationMinutes: display.displayDurationMinutes,
    plannedDurationMinutes: display.plannedDurationMinutes,
    displayPrimaryTimeLabel: display.displayPrimaryTimeLabel,
    displaySecondaryTimeLabel: display.displaySecondaryTimeLabel,
    displayDurationLabel: display.displayDurationLabel,
    displaySource: display.displaySource,
    bookingStatus: display.bookingStatus,
    canOpenDetails: display.canOpenDetails,
    canEdit: display.canEdit,
    canApprove: display.canApprove,
    canReject: display.canReject,
    canRequestClarification: display.canRequestClarification,
  };
}
