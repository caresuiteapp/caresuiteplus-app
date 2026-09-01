import { Platform } from 'react-native';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import {
  buildDefaultMobilitySettings,
  fetchEmployeeMobilitySettings,
} from '@/lib/office/employeeMobilityService';
import type { TravelRouteType } from '@/types/modules/travelCompensation';
import type { EmployeeTransportMode } from '@/types/modules/employeeMobility';
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
import {
  acquireGeolocationWatch,
  type GeolocationSnapshot,
} from '@/features/liveTracking/useSingleGeolocationWatch';
import {
  flushLogbookPointQueue,
  persistLogbookPointDurably,
} from './employeeLogbookPointQueue';
import { berlinDateKey, berlinToday } from './employeeLogbookDate';

export type EmployeeLogbookEligibility = {
  eligible: boolean;
  hasCarMode: boolean;
  vehicleId: string | null;
  reason: 'eligible' | 'no_car_mode' | 'no_active_vehicle';
};

export type AutomaticLogbookResult = {
  eligible: boolean;
  hasCarMode: boolean;
  vehicleId: string | null;
  started: boolean;
  resumed: boolean;
  trip: LogbookTrip | null;
  reason: EmployeeLogbookEligibility['reason'] | 'non_car_selected';
};

export type EmployeeGpsWatchHandle = { remove: () => void };

const foregroundWatchers = new Map<string, EmployeeGpsWatchHandle>();

function pointFromSnapshot(location: GeolocationSnapshot): LogbookPoint {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracyMeters,
    altitude: null,
    speed: null,
    heading: null,
    recordedAt: location.capturedAt,
  };
}

export function acquireEmployeeLogbookForegroundTracking(input: {
  tripId: string;
  tenantId: string;
  employeeId: string;
  onPoint?: (point: LogbookPoint) => void;
}): EmployeeGpsWatchHandle {
  void flushLogbookPointQueue();
  const release = acquireGeolocationWatch({
    sessionKey: `${input.tenantId}:employee:${input.employeeId}`,
    enabled: true,
    enableHighAccuracy: true,
    onSnapshot: (snapshot) => {
      const point = pointFromSnapshot(snapshot);
      input.onPoint?.(point);
      void persistLogbookPointDurably({ ...input, point });
    },
  });
  return { remove: release };
}

async function startForegroundPersistence(
  tripId: string,
  tenantId: string,
  employeeId: string,
): Promise<void> {
  if (Platform.OS !== 'web' || foregroundWatchers.has(tripId)) return;
  const watcher = acquireEmployeeLogbookForegroundTracking({ tripId, tenantId, employeeId });
  foregroundWatchers.set(tripId, watcher);
}

/** Restores an interrupted/reloaded portal without requiring the logbook page. */
export async function resumeActiveEmployeeLogbookTracking(
  tenantId: string,
  employeeId: string,
): Promise<LogbookTrip | null> {
  const bundle = await loadEmployeeLogbook(tenantId, employeeId);
  const active = bundle.trips.find((trip) => trip.status === 'recording') ?? null;
  if (!active) return null;
  // Never revive an orphaned recording from an earlier Berlin calendar day.
  // The Office repair keeps its raw points and moves it to review_required;
  // the portal must meanwhile stop presenting or feeding it as a live trip.
  if (berlinDateKey(active.startedAt) < berlinToday()) {
    stopForegroundPersistence(active.id);
    await stopNativeBackgroundTracking();
    return null;
  }
  await startNativeBackgroundTracking({ tripId: active.id, tenantId, employeeId });
  await startForegroundPersistence(active.id, tenantId, employeeId);
  return active;
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
  selectedTransportMode?: EmployeeTransportMode | null,
): Promise<EmployeeLogbookEligibility> {
  const [bundle, mobilityResult] = await Promise.all([
    loadEmployeeLogbook(tenantId, employeeId),
    fetchEmployeeMobilitySettings(tenantId, employeeId),
  ]);
  const mobility = mobilityResult.ok
    ? mobilityResult.data
    : buildDefaultMobilitySettings(tenantId, employeeId);
  const hasCarMode = selectedTransportMode
    ? selectedTransportMode === 'car'
    : mobility.transportModes.includes('car');
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
  transportMode?: EmployeeTransportMode | null;
}): Promise<AutomaticLogbookResult> {
  if (input.transportMode && input.transportMode !== 'car') {
    return {
      eligible: false,
      hasCarMode: false,
      vehicleId: null,
      started: false,
      resumed: false,
      trip: null,
      reason: 'non_car_selected',
    };
  }
  const eligibility = await resolveEmployeeLogbookEligibility(
    input.tenantId,
    input.employeeId,
    input.transportMode,
  );
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
  transportMode?: EmployeeTransportMode | null;
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
  transportMode?: EmployeeTransportMode | null;
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

  // Freeze the trip producer before flushing so no late background callback
  // can arrive between distance calculation and the completed status write.
  stopForegroundPersistence(active.id);
  await stopNativeBackgroundTracking();
  try {
    await flushLogbookPointQueue();
    const lastPoint = await getCurrentLogbookPoint();
    await finishLogbookTrip(active.id, {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      endAddress: input.endAddress?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      points: [lastPoint],
    });
  } catch (error) {
    await startNativeBackgroundTracking({
      tripId: active.id,
      tenantId: input.tenantId,
      employeeId: input.employeeId,
    }).catch(() => undefined);
    await startForegroundPersistence(active.id, input.tenantId, input.employeeId);
    throw error;
  }
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
