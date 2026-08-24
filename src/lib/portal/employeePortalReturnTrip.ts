import type { LocationSubscription } from 'expo-location';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import {
  appendLogbookPoints,
  createLogbookTrip,
  finishLogbookTrip,
  getCurrentLogbookPoint,
  loadEmployeeLogbook,
  requestLogbookLocationPermission,
  saveLogbookProfile,
  startNativeBackgroundTracking,
  stopNativeBackgroundTracking,
} from '@/lib/employeeLogbook';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import type { LogbookPoint, LogbookTrip } from '@/types/modules/employeeLogbook';
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

  const vehicleId =
    bundle.profile.defaultVehicleId ?? bundle.vehicles.find((vehicle) => vehicle.active)?.id ?? null;
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

function locationToLogbookPoint(location: Location.LocationObject): LogbookPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    altitude: location.coords.altitude,
    speed: location.coords.speed,
    heading: location.coords.heading,
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

/** Web/PWA has no native background task, so every foreground point is stored immediately. */
export async function startEmployeeReturnTripForegroundTracking(input: {
  tripId: string;
  tenantId: string;
  employeeId: string;
}): Promise<LocationSubscription | null> {
  if (Platform.OS !== 'web') return null;
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 20,
      timeInterval: 15_000,
    },
    (location) => {
      void appendLogbookPoints(input.tripId, input.tenantId, input.employeeId, [
        locationToLogbookPoint(location),
      ]).catch((error) => {
        console.warn('[employeeReturnTrip] GPS point could not be persisted', error);
      });
    },
  );
}

export async function finishEmployeeReturnTrip(input: {
  trip: LogbookTrip;
  tenantId: string;
  employeeId: string;
  destination: EmployeeReturnTripDestination;
}): Promise<LogbookTrip> {
  await stopNativeBackgroundTracking();
  const lastPoint = await getCurrentLogbookPoint();
  await finishLogbookTrip(input.trip.id, {
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    endAddress: returnTripDestinationLabel(input.destination),
    notes: 'Automatisch nach dem letzten Tageseinsatz im Mitarbeiterportal erfasst.',
    points: [lastPoint],
  });

  const bundle = await loadEmployeeLogbook(input.tenantId, input.employeeId);
  const completed = bundle.trips.find((trip) => trip.id === input.trip.id);
  if (!completed) throw new Error('Die abgeschlossene Rückfahrt konnte nicht erneut geladen werden.');
  return completed;
}
