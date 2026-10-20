import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { isAssignmentCalendarEvent } from '@/lib/calendar/calendarEventDisplay';

export type AssignmentCalendarState =
  | 'scheduled'
  | 'active'
  | 'open'
  | 'problem'
  | 'completed'
  | 'cancelled';

export type AssignmentCalendarVisual = {
  state: AssignmentCalendarState;
  label: string;
  legendLabel: string;
  symbol: string;
  color: string;
  tint: string;
  outline: string;
};

export const ASSIGNMENT_CALENDAR_VISUALS: Record<
  AssignmentCalendarState,
  AssignmentCalendarVisual
> = {
  scheduled: {
    state: 'scheduled',
    label: 'Geplant',
    legendLabel: 'Geplant / bestätigt',
    symbol: '●',
    color: '#1D4ED8',
    tint: 'rgba(37, 99, 235, 0.12)',
    outline: 'rgba(37, 99, 235, 0.42)',
  },
  active: {
    state: 'active',
    label: 'Läuft',
    legendLabel: 'Anfahrt / läuft',
    symbol: '▶',
    color: '#0E7490',
    tint: 'rgba(8, 145, 178, 0.13)',
    outline: 'rgba(8, 145, 178, 0.45)',
  },
  open: {
    state: 'open',
    label: 'Offen',
    legendLabel: 'Nacharbeit offen',
    symbol: '!',
    color: '#B45309',
    tint: 'rgba(217, 119, 6, 0.14)',
    outline: 'rgba(217, 119, 6, 0.46)',
  },
  problem: {
    state: 'problem',
    label: 'Problem',
    legendLabel: 'Problem / überfällig',
    symbol: '!',
    color: '#B91C1C',
    tint: 'rgba(220, 38, 38, 0.13)',
    outline: 'rgba(220, 38, 38, 0.48)',
  },
  completed: {
    state: 'completed',
    label: 'Abgeschlossen',
    legendLabel: 'Abgeschlossen',
    symbol: '✓',
    color: '#15803D',
    tint: 'rgba(22, 163, 74, 0.13)',
    outline: 'rgba(22, 163, 74, 0.46)',
  },
  cancelled: {
    state: 'cancelled',
    label: 'Abgesagt',
    legendLabel: 'Abgesagt',
    symbol: '×',
    color: '#475569',
    tint: 'rgba(100, 116, 139, 0.12)',
    outline: 'rgba(100, 116, 139, 0.44)',
  },
};

const CANCELLED_STATUSES = new Set([
  'storniert',
  'cancelled',
  'canceled',
  'abgesagt',
]);

const PROBLEM_STATUSES = new Set([
  'nicht_erschienen',
  'no_show',
  'fehlerhaft',
  'at_risk',
  'blocked',
  'rejected',
]);

const COMPLETED_STATUSES = new Set(['abgeschlossen', 'completed', 'complete']);

const OPEN_STATUSES = new Set([
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
  'documentation_open',
  'signature_open',
  'review',
]);

const ACTIVE_STATUSES = new Set([
  'unterwegs',
  'angekommen',
  'gestartet',
  'pausiert',
  'on_way',
  'arrived',
  'in_progress',
  'paused',
]);

function normalizedStatus(event: CalendarEvent): string {
  return event.status?.trim().toLowerCase() ?? '';
}

function isPastDue(event: CalendarEvent, now: Date): boolean {
  if (event.allDay) return false;
  const endMs = new Date(event.end).getTime();
  return Number.isFinite(endMs) && endMs < now.getTime();
}

export function resolveAssignmentCalendarVisual(
  event: CalendarEvent,
  now = new Date(),
): AssignmentCalendarVisual | null {
  if (!isAssignmentCalendarEvent(event)) return null;

  const status = normalizedStatus(event);

  if (CANCELLED_STATUSES.has(status)) {
    return ASSIGNMENT_CALENDAR_VISUALS.cancelled;
  }
  if (event.isAtRisk || PROBLEM_STATUSES.has(status)) {
    return ASSIGNMENT_CALENDAR_VISUALS.problem;
  }
  if (COMPLETED_STATUSES.has(status)) {
    return ASSIGNMENT_CALENDAR_VISUALS.completed;
  }
  if (event.isIncomplete || OPEN_STATUSES.has(status)) {
    return ASSIGNMENT_CALENDAR_VISUALS.open;
  }
  if (ACTIVE_STATUSES.has(status)) {
    return ASSIGNMENT_CALENDAR_VISUALS.active;
  }
  if (isPastDue(event, now)) {
    return {
      ...ASSIGNMENT_CALENDAR_VISUALS.problem,
      label: 'Überfällig',
    };
  }
  return ASSIGNMENT_CALENDAR_VISUALS.scheduled;
}
