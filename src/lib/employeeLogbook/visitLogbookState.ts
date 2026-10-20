import type { LogbookTrip } from '@/types/modules/employeeLogbook';

export function parseTripKilometres(input: string): number | null {
  const value = input.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const distance = Number(value);
  return Number.isFinite(distance) ? distance : null;
}

/** Never let a visit confirm or stop a future assignment's trip. */
export function selectVisitLogbookState(trips: LogbookTrip[], assignmentId: string) {
  // Return journeys have their own resumable confirmation dialog.
  const mine = trips.filter((trip) => trip.assignmentId === assignmentId && !['client_to_home', 'client_to_office'].includes(trip.routeType));
  return {
    active: mine.find((trip) => trip.status === 'recording') ?? null,
    pending: mine.filter((trip) => trip.status === 'confirmation_required')
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0] ?? null,
    otherActive: trips.find((trip) => trip.status === 'recording' && trip.assignmentId !== assignmentId) ?? null,
  };
}
