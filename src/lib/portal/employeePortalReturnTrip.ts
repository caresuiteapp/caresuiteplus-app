import { Platform } from 'react-native';
import {
  appendLogbookPoints,
  createLogbookTrip,
  finishLogbookTrip,
  flushLogbookPointQueue,
  getCurrentLogbookPoint,
  loadEmployeeLogbook,
  requestLogbookLocationPermission,
  saveLogbookProfile,
  startNativeBackgroundTracking,
  stopNativeBackgroundTracking,
} from '@/lib/employeeLogbook';
import { resolveEmployeeLogbookEligibility } from '@/lib/employeeLogbook/employeeLogbookAutomation';
import {
  acquireEmployeeLogbookForegroundTracking,
  type EmployeeGpsWatchHandle,
} from '@/lib/employeeLogbook/employeeLogbookAutomation';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
import {
  returnTripDestinationFromTrip,
  returnTripDestinationLabel,
  returnTripRouteType,
  type EmployeeReturnTripDestination,
} from './employeePortalReturnTripRules';

export {
  formatReturnTripDuration,
  isLastScheduledEmployeeAssignmentOfDay,
  returnTripDestinationFromTrip,
  returnTripDestinationLabel,
  returnTripRouteType,
  type EmployeeReturnTripDestination,
} from './employeePortalReturnTripRules';

export async function loadActiveEmployeeReturnTrip(
  tenantId: string,
  employeeId: string,
): Promise<LogbookTrip | null> {
  const bundle = await loadEmployeeLogbook(tenantId, employeeId);
  return bundle.trips.find((trip) => trip.status === 'recording') ?? null;
}

export async function startEmployeeReturnTrip(input: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  clientId: string;
  clientName: string;
  startAddress: string;
  destination: EmployeeReturnTripDestination;
}): Promise<{ trip: LogbookTrip; resumed: boolean }> {
  const eligibility = await resolveEmployeeLogbookEligibility(input.tenantId, input.employeeId);
  if (!eligibility.eligible) {
    throw new Error(
      eligibility.reason === 'no_car_mode'
        ? 'Für dieses Mitarbeitendenkonto ist kein PKW-Verkehrsmittel hinterlegt.'
        : 'Für dieses Mitarbeitendenkonto ist kein aktiver PKW zugeordnet.',
    );
  }
  const bundle = await loadEmployeeLogbook(input.tenantId, input.employeeId);
  const existing = bundle.trips.find((trip) => trip.status === 'recording') ?? null;
  if (existing) {
    const destination = returnTripDestinationFromTrip(existing);
    if (
      destination &&
      existing.assignmentId === resolveVisitMasterId(input.assignmentId)
    ) {
      await startNativeBackgroundTracking({
        tripId: existing.id,
        tenantId: input.tenantId,
        employeeId: input.employeeId,
      });
      return { trip: existing, resumed: true };
    }
    throw new Error('Es läuft bereits eine andere Fahrt. Bitte diese zuerst im Fahrtenbuch abschließen.');
  }

  await requestLogbookLocationPermission();
  const firstPoint = await getCurrentLogbookPoint();
  if (!bundle.profile.gpsConsent) {
    await saveLogbookProfile({ ...bundle.profile, gpsConsent: true });
  }

  const vehicleId = eligibility.vehicleId;
  const destinationLabel = returnTripDestinationLabel(input.destination);
  const trip = await createLogbookTrip({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    vehicleId,
    routeType: returnTripRouteType(input.destination),
    assignmentId: resolveVisitMasterId(input.assignmentId),
    clientId: input.clientId,
    purpose: `Rückfahrt nach letztem Tageseinsatz bei ${input.clientName}`,
    startAddress: input.startAddress,
  });

  await appendLogbookPoints(trip.id, input.tenantId, input.employeeId, [firstPoint]);
  await startNativeBackgroundTracking({
    tripId: trip.id,
    tenantId: input.tenantId,
    employeeId: input.employeeId,
  });

  return {
    trip: {
      ...trip,
      endAddress: destinationLabel,
    },
    resumed: false,
  };
}

/** Web/PWA has no native background task, so every foreground point is stored immediately. */
export async function startEmployeeReturnTripForegroundTracking(input: {
  tripId: string;
  tenantId: string;
  employeeId: string;
}): Promise<EmployeeGpsWatchHandle | null> {
  if (Platform.OS !== 'web') return null;
  return acquireEmployeeLogbookForegroundTracking(input);
}

export async function finishEmployeeReturnTrip(input: {
  trip: LogbookTrip;
  tenantId: string;
  employeeId: string;
  destination: EmployeeReturnTripDestination;
}): Promise<LogbookTrip> {
  const lastPoint = await getCurrentLogbookPoint();
  await flushLogbookPointQueue();
  await finishLogbookTrip(input.trip.id, {
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    endAddress: returnTripDestinationLabel(input.destination),
    notes: 'Automatisch nach dem letzten Tageseinsatz im Mitarbeiterportal erfasst.',
    points: [lastPoint],
  });
  await stopNativeBackgroundTracking();

  const bundle = await loadEmployeeLogbook(input.tenantId, input.employeeId);
  const completed = bundle.trips.find((trip) => trip.id === input.trip.id);
  if (!completed) throw new Error('Die abgeschlossene Rückfahrt konnte nicht erneut geladen werden.');
  return completed;
}
