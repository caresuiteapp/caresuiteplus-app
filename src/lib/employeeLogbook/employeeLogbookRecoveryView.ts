import type { EmployeeLogbookGpsRecoveryCandidate, EmployeeLogbookGpsRecoveryLeg } from './employeeLogbookAssistGpsRecovery';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
import { isLogbookTripInBerlinRange } from './employeeLogbookDate';

export function canImportRecoveryLeg(candidate: EmployeeLogbookGpsRecoveryCandidate, leg: EmployeeLogbookGpsRecoveryLeg) {
  return !candidate.active && Boolean(candidate.endedAt) && candidate.carSelectionProven &&
    !leg.imported && leg.pointCount >= 2 && leg.finalDistanceKm >= 0.05 && leg.unresolvedGapCount === 0;
}

/** Reconcile the GPS snapshot with current trips, including cancellation tombstones. */
export function buildLogbookRecoveryView(candidates: EmployeeLogbookGpsRecoveryCandidate[], trips: LogbookTrip[], from: string, to: string) {
  const bySource = new Map(trips.filter((trip) => trip.source).map((trip) => [trip.source, trip]));
  return candidates.filter((candidate) => isLogbookTripInBerlinRange(candidate.startedAt, from, to)).map((candidate) => {
    const legacyTrip = bySource.get(candidate.source);
    const legs = candidate.legs.map((leg) => {
      const trip = bySource.get(leg.source);
      return { ...leg, imported: leg.imported || Boolean(trip), trip, deleted: trip?.status === 'cancelled' };
    });
    const needsAction = legacyTrip?.status === 'review_required' || legacyTrip?.status === 'confirmation_required' ||
      legs.some((leg) => !leg.deleted && (leg.trip
        ? ['review_required', 'confirmation_required'].includes(leg.trip.status)
        : !leg.imported && !candidate.active));
    return { ...candidate, legs, legacyTrip, needsAction };
  });
}
