import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import {
  buildDefaultMobilitySettings,
  fetchEmployeeMobilitySettings,
} from '@/lib/office/employeeMobilityService';
import type { TravelRouteType } from '@/types/modules/travelCompensation';
import type { LogbookPoint, LogbookTrip } from '@/types/modules/employeeLogbook';
import {
  appendLogbookPoints,
  createLogbookTrip,
  finishLogbookTrip,
  loadEmployeeLogbook,
  saveLogbookProfile,
} from './employeeLogbookRepository.supabase';
import {
  getCurrentLogbookPoint,
  requestLogbookLocationPermission,
  startNativeBackgroundTracking,
  stopNativeBackgroundTracking,
} from './employeeLogbookTracking';

export type EmployeeLogbookEligibility = {
  eligible: boolean;
  hasCarMode: boolean;
  vehicleId: string | null;
  reason: 'eligible' | 'no_car_mode' | 'no_active_vehicle';
};

export type AutomaticLogbookResult = {
  eligible: boolean;
  started: boolean;
  resumed: boolean;
  trip: LogbookTrip | null;
  reason: EmployeeLogbookEligibility['reason'];
};

const foregroundWatchers = new Map<string, Location.LocationSubscription>();

function pointFromLocation(location: Location.LocationObject): LogbookPoint {
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

async function startForegroundPersistence(
  tripId: string,
  tenantId: string,
  employeeId: string,
): Promise<void> {
  if (Platform.OS !== 'web' || foregroundWatchers.has(tripId)) return;
  const watcher = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 15_000 },
    (location) => {
      void appendLogbookPoints(tripId, tenantId, employeeId, [pointFromLocation(location)]).catch(
        (error) => console.warn('[employeeLogbook] GPS point could not be persisted', error),
      );
    },
  );
  foregroundWatchers.set(tripId, watcher);
}

function stopForegroundPersistence(tripId: string): void {
  foregroundWatchers.get(tripId)?.remove();
  foregroundWatchers.delete(tripId);
}

export async function stopAutomaticLogbookTracking(tripId: string): Promise<void> {
  stopForegroundPersistence(tripId);
  await stopNativeBackgroundTracking();
}

export async function resolveEmployeeLogbookEligibility(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeLogbookEligibility> {
  const [bundle, mobilityResult] = await Promise.all([
    loadEmployeeLogbook(tenantId, employeeId),
    fetchEmployeeMobilitySettings(tenantId, employeeId),
  ]);
  const mobility = mobilityResult.ok
    ? mobilityResult.data
    : buildDefaultMobilitySettings(tenantId, employeeId);
  const hasCarMode = mobility.transportModes.includes('car');
  const defaultVehicle = bundle.vehicles.find(
    (vehicle) => vehicle.id === bundle.profile.defaultVehicleId && vehicle.active,
  );
  const vehicleId = defaultVehicle?.id ?? bundle.vehicles.find((vehicle) => vehicle.active)?.id ?? null;
  if (!hasCarMode) return { eligible: false, hasCarMode, vehicleId, reason: 'no_car_mode' };
  if (!vehicleId) return { eligible: false, hasCarMode, vehicleId: null, reason: 'no_active_vehicle' };
  return { eligible: true, hasCarMode, vehicleId, reason: 'eligible' };
}

function resolveApproachRouteType(routeStartType: string): TravelRouteType {
  if (routeStartType === 'office') return 'office_to_client';
  if (routeStartType === 'last_assignment') return 'client_to_client';
  if (routeStartType === 'home') return 'home_to_client';
  return 'other_business';
}

async function startAutomaticTrip(input: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  clientId: string;
  routeType: TravelRouteType;
  purpose: string;
  startAddress?: string | null;
}): Promise<AutomaticLogbookResult> {
  const eligibility = await resolveEmployeeLogbookEligibility(input.tenantId, input.employeeId);
  if (!eligibility.eligible) {
    return { ...eligibility, started: false, resumed: false, trip: null };
  }

  const bundle = await loadEmployeeLogbook(input.tenantId, input.employeeId);
  const assignmentId = resolveVisitMasterId(input.assignmentId);
  const active = bundle.trips.find((trip) => trip.status === 'recording') ?? null;
  if (active) {
    if (active.assignmentId !== assignmentId || active.routeType !== input.routeType) {
      throw new Error('Es läuft bereits eine andere PKW-Fahrt. Bitte diese zuerst abschließen.');
    }
    await startNativeBackgroundTracking({
      tripId: active.id,
      tenantId: input.tenantId,
      employeeId: input.employeeId,
    });
    await startForegroundPersistence(active.id, input.tenantId, input.employeeId);
    return { ...eligibility, started: true, resumed: true, trip: active };
  }

  await requestLogbookLocationPermission();
  const firstPoint = await getCurrentLogbookPoint();
  if (!bundle.profile.gpsConsent) {
    await saveLogbookProfile({ ...bundle.profile, gpsConsent: true });
  }
  const trip = await createLogbookTrip({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    vehicleId: eligibility.vehicleId,
    routeType: input.routeType,
    assignmentId,
    clientId: input.clientId,
    purpose: input.purpose,
    startAddress: input.startAddress ?? null,
  });
  await appendLogbookPoints(trip.id, input.tenantId, input.employeeId, [firstPoint]);
  await startNativeBackgroundTracking({
    tripId: trip.id,
    tenantId: input.tenantId,
    employeeId: input.employeeId,
  });
  await startForegroundPersistence(trip.id, input.tenantId, input.employeeId);
  return { ...eligibility, started: true, resumed: false, trip };
}

export async function startVisitApproachLogbook(input: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  clientId: string;
  clientName: string;
  startAddress?: string | null;
}): Promise<AutomaticLogbookResult> {
  const mobilityResult = await fetchEmployeeMobilitySettings(input.tenantId, input.employeeId);
  const mobility = mobilityResult.ok
    ? mobilityResult.data
    : buildDefaultMobilitySettings(input.tenantId, input.employeeId);
  return startAutomaticTrip({
    ...input,
    routeType: resolveApproachRouteType(mobility.routeStartType),
    purpose: `Automatische Anfahrt zum Einsatz bei ${input.clientName}`,
  });
}

export async function startVisitServiceLogbookTrip(input: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  clientId: string;
  clientName: string;
  kind: 'with_client' | 'client_errand' | 'next_client';
  purpose: string;
  startAddress?: string | null;
}): Promise<AutomaticLogbookResult> {
  const routeType: TravelRouteType =
    input.kind === 'with_client'
      ? 'with_client'
      : input.kind === 'next_client'
        ? 'client_to_client'
        : 'other_business';
  return startAutomaticTrip({
    ...input,
    routeType,
    purpose: input.purpose.trim() || `Dienstfahrt für ${input.clientName}`,
  });
}

export async function finishActiveVisitLogbookTrip(input: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  endAddress?: string | null;
  notes?: string | null;
  allowedRouteTypes?: TravelRouteType[];
}): Promise<LogbookTrip | null> {
  const assignmentId = resolveVisitMasterId(input.assignmentId);
  const bundle = await loadEmployeeLogbook(input.tenantId, input.employeeId);
  const active = bundle.trips.find(
    (trip) =>
      trip.status === 'recording' &&
      trip.assignmentId === assignmentId &&
      (!input.allowedRouteTypes || input.allowedRouteTypes.includes(trip.routeType)),
  );
  if (!active) return null;

  const lastPoint = await getCurrentLogbookPoint();
  await finishLogbookTrip(active.id, {
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    endAddress: input.endAddress?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    points: [lastPoint],
  });
  await stopAutomaticLogbookTracking(active.id);
  const refreshed = await loadEmployeeLogbook(input.tenantId, input.employeeId);
  return refreshed.trips.find((trip) => trip.id === active.id) ?? null;
}

export async function finishVisitApproachLogbook(input: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  endAddress?: string | null;
}): Promise<LogbookTrip | null> {
  return finishActiveVisitLogbookTrip({
    ...input,
    notes: 'Automatisch durch „Angekommen“ im Einsatzworkflow abgeschlossen.',
    allowedRouteTypes: ['home_to_client', 'office_to_client', 'client_to_client', 'other_business'],
  });
}
