import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';

export type EmployeeReturnTripDestination = 'home' | 'office';

const TERMINAL_ASSIGNMENT_STATUSES = new Set(['storniert', 'nicht_erschienen']);

function localDayKey(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * A return trip is offered only when no later, non-cancelled assignment is
 * scheduled for the employee on the current assignment's local calendar day.
 */
export function isLastScheduledEmployeeAssignmentOfDay(input: {
  assignmentId: string;
  plannedStartAt: string;
  appointments: PortalAppointmentItem[];
}): boolean {
  const currentStart = new Date(input.plannedStartAt).getTime();
  const currentDay = localDayKey(input.plannedStartAt);
  if (!Number.isFinite(currentStart) || !currentDay) return false;

  return !input.appointments.some((appointment) => {
    const candidateStart = new Date(appointment.startsAt).getTime();
    if (!Number.isFinite(candidateStart) || localDayKey(appointment.startsAt) !== currentDay) {
      return false;
    }
    if (
      TERMINAL_ASSIGNMENT_STATUSES.has(appointment.assignmentStatus ?? '') ||
      appointment.status === 'fehlerhaft'
    ) {
      return false;
    }
    if (appointment.id === input.assignmentId && candidateStart === currentStart) return false;
    return candidateStart > currentStart;
  });
}

export function returnTripRouteType(destination: EmployeeReturnTripDestination) {
  return destination === 'home' ? ('client_to_home' as const) : ('client_to_office' as const);
}

export function returnTripDestinationFromTrip(
  trip: Pick<LogbookTrip, 'routeType'>,
): EmployeeReturnTripDestination | null {
  if (trip.routeType === 'client_to_home') return 'home';
  if (trip.routeType === 'client_to_office') return 'office';
  return null;
}

export function returnTripDestinationLabel(destination: EmployeeReturnTripDestination): string {
  return destination === 'home' ? 'Nach Hause' : 'Zum Büro';
}

export function formatReturnTripDuration(startedAt: string, now = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
