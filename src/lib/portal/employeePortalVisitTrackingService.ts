/**
 * Employee-portal GPS/tracking session store (in-memory + 0156 persistence).
 * Privacy: ONLY this portal may start tracking sessions; Assist/Office is read-only.
 */
import type * as ExpoLocation from 'expo-location';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type {
  EmployeePortalGpsPermissionStatus,
  EmployeePortalGpsSnapshot,
  EmployeePortalLiveTimers,
  EmployeePortalLocationConsent,
  EmployeePortalTrackingSnapshot,
} from '@/types/modules/employeePortalTracking';
import {
  runGeofenceSoftCheck,
  type GeofenceSoftCheckResult,
  type GeoCoordinate,
} from '@/lib/assist/geofenceSoftCheck';
import { isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';
import {
  peekEmployeePortalPauseEvents,
  peekEmployeePortalStatusHistory,
} from './employeePortalExecutionService';

type TrackingEntry = {
  consent: EmployeePortalLocationConsent;
  lastPosition: EmployeePortalGpsSnapshot | null;
  trackingActive: boolean;
  driveStartedAt: string | null;
  serviceStartedAt: string | null;
  geofenceLastCheck: GeofenceSoftCheckResult | null;
  geofenceOverrideReason: string | null;
  targetCoordinates: GeoCoordinate | null;
};

const TRACKING_STORE = new Map<string, TrackingEntry>();

export const EMPLOYEE_PORTAL_CONSENT_PENDING_WARNING =
  'Standort-Einwilligung ausstehend — Tracking startet erst nach Bestätigung.';

function storeKey(tenantId: string, assignmentId: string): string {
  return `${tenantId}:${assignmentId}`;
}

function emptyEntry(): TrackingEntry {
  return {
    consent: { granted: false, grantedAt: null, explainedAt: null },
    lastPosition: null,
    trackingActive: false,
    driveStartedAt: null,
    serviceStartedAt: null,
    geofenceLastCheck: null,
    geofenceOverrideReason: null,
    targetCoordinates: null,
  };
}

function getEntry(tenantId: string, assignmentId: string): TrackingEntry {
  const key = storeKey(tenantId, assignmentId);
  const existing = TRACKING_STORE.get(key);
  if (existing) return existing;
  const entry = emptyEntry();
  TRACKING_STORE.set(key, entry);
  return entry;
}

function loadExpoLocation(): typeof ExpoLocation | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location') as typeof ExpoLocation;
  } catch {
    return null;
  }
}

function mapPermissionStatus(status: string): EmployeePortalGpsPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export function getEmployeePortalLocationConsent(
  tenantId: string,
  assignmentId: string,
): EmployeePortalLocationConsent {
  return { ...getEntry(tenantId, assignmentId).consent };
}

export function grantEmployeePortalLocationConsent(
  tenantId: string,
  assignmentId: string,
): EmployeePortalLocationConsent {
  const entry = getEntry(tenantId, assignmentId);
  const now = new Date().toISOString();
  entry.consent = {
    granted: true,
    grantedAt: now,
    explainedAt: entry.consent.explainedAt ?? now,
  };
  return { ...entry.consent };
}

export function markEmployeePortalConsentExplained(
  tenantId: string,
  assignmentId: string,
): void {
  const entry = getEntry(tenantId, assignmentId);
  if (!entry.consent.explainedAt) {
    entry.consent.explainedAt = new Date().toISOString();
  }
}

export async function getEmployeePortalGpsPermissionStatus(): Promise<EmployeePortalGpsPermissionStatus> {
  const Location = loadExpoLocation();
  if (!Location) return 'unavailable';
  const { status } = await Location.getForegroundPermissionsAsync();
  return mapPermissionStatus(status);
}

export async function requestEmployeePortalForegroundLocationPermission(): Promise<EmployeePortalGpsPermissionStatus> {
  const Location = loadExpoLocation();
  if (!Location) return 'unavailable';
  const { status } = await Location.requestForegroundPermissionsAsync();
  return mapPermissionStatus(status);
}

/** Foreground-Position — keine Fake-Koordinaten; Backend-Streaming separat (isGpsTrackingLiveReady). */
export async function captureEmployeePortalForegroundPosition(
  tenantId: string,
  assignmentId: string,
): Promise<{ ok: true; data: EmployeePortalGpsSnapshot } | { ok: false; error: string }> {
  const entry = getEntry(tenantId, assignmentId);
  if (!entry.consent.granted) {
    return { ok: false, error: 'Standort-Einwilligung fehlt — bitte zuerst bestätigen.' };
  }

  const Location = loadExpoLocation();
  if (!Location) {
    return { ok: false, error: 'Standortdienst auf diesem Gerät nicht verfügbar.' };
  }

  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    return { ok: false, error: 'Standortberechtigung nicht erteilt — bitte in den Geräteeinstellungen freigeben.' };
  }

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const snapshot: EmployeePortalGpsSnapshot = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy,
      capturedAt: new Date(location.timestamp).toISOString(),
    };
    entry.lastPosition = snapshot;
    return { ok: true, data: snapshot };
  } catch {
    return { ok: false, error: 'GPS-Signal nicht verfügbar — bitte erneut versuchen oder ohne Ort fortfahren.' };
  }
}

export function setEmployeePortalGeofenceTarget(
  tenantId: string,
  assignmentId: string,
  target: GeoCoordinate | null,
): void {
  getEntry(tenantId, assignmentId).targetCoordinates = target;
}

export function setEmployeePortalGeofenceOverrideReason(
  tenantId: string,
  assignmentId: string,
  reason: string | null,
): GeofenceSoftCheckResult | null {
  const entry = getEntry(tenantId, assignmentId);
  entry.geofenceOverrideReason = reason?.trim() ?? null;
  if (entry.lastPosition && entry.targetCoordinates) {
    entry.geofenceLastCheck = runGeofenceSoftCheck({
      current: entry.lastPosition,
      target: entry.targetCoordinates,
      overrideReason: entry.geofenceOverrideReason,
    });
  }
  return entry.geofenceLastCheck ? { ...entry.geofenceLastCheck } : null;
}

function diffSeconds(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
}

function findStatusTimestamp(
  tenantId: string,
  assignmentId: string,
  status: AssignmentStatus,
): string | null {
  const history = peekEmployeePortalStatusHistory(tenantId, assignmentId);
  const match = [...history].reverse().find((h) => h.toStatus === status);
  return match?.createdAt ?? null;
}

export function computeEmployeePortalLiveTimers(
  tenantId: string,
  assignmentId: string,
  currentStatus: AssignmentStatus,
  now: Date = new Date(),
): EmployeePortalLiveTimers {
  const entry = getEntry(tenantId, assignmentId);
  const nowIso = now.toISOString();
  const pauses = peekEmployeePortalPauseEvents(tenantId, assignmentId);

  let pauseSeconds = 0;
  let pauseStartedAt: string | null = null;
  for (const pause of pauses) {
    if (pause.resumedAt) {
      pauseSeconds += diffSeconds(pause.pausedAt, pause.resumedAt);
    } else {
      pauseStartedAt = pause.pausedAt;
      pauseSeconds += diffSeconds(pause.pausedAt, nowIso);
    }
  }

  const driveStart =
    entry.driveStartedAt ?? findStatusTimestamp(tenantId, assignmentId, 'unterwegs');
  const arrivedAt = findStatusTimestamp(tenantId, assignmentId, 'angekommen');
  const serviceStart =
    entry.serviceStartedAt ?? findStatusTimestamp(tenantId, assignmentId, 'gestartet');
  const endedAt = findStatusTimestamp(tenantId, assignmentId, 'beendet');

  let driveSeconds: number | null = null;
  if (driveStart) {
    const driveEnd =
      arrivedAt ??
      (currentStatus === 'unterwegs' ? nowIso : null);
    if (driveEnd) driveSeconds = diffSeconds(driveStart, driveEnd);
  }

  let serviceSeconds: number | null = null;
  if (serviceStart) {
    const serviceEnd =
      endedAt ??
      (currentStatus === 'gestartet' ? nowIso : null);
    if (serviceEnd) {
      serviceSeconds = Math.max(0, diffSeconds(serviceStart, serviceEnd) - pauseSeconds);
    }
  }

  let activeTimer: EmployeePortalLiveTimers['activeTimer'] = null;
  if (currentStatus === 'unterwegs') activeTimer = 'drive';
  else if (currentStatus === 'pausiert') activeTimer = 'pause';
  else if (currentStatus === 'gestartet') activeTimer = 'service';

  return {
    driveSeconds,
    serviceSeconds,
    pauseSeconds: pauseSeconds > 0 ? pauseSeconds : null,
    activeTimer,
    driveStartedAt: driveStart,
    serviceStartedAt: serviceStart,
    pauseStartedAt,
  };
}

export function applyEmployeePortalTrackingForStatus(
  tenantId: string,
  assignmentId: string,
  fromStatus: AssignmentStatus,
  toStatus: AssignmentStatus,
): void {
  const entry = getEntry(tenantId, assignmentId);
  const now = new Date().toISOString();

  if (toStatus === 'unterwegs') {
    entry.driveStartedAt = now;
    entry.trackingActive = entry.consent.granted;
  }

  if (toStatus === 'angekommen' && entry.lastPosition) {
    entry.geofenceLastCheck = runGeofenceSoftCheck({
      current: entry.lastPosition,
      target: entry.targetCoordinates,
      overrideReason: entry.geofenceOverrideReason,
    });
    entry.trackingActive = false;
  }

  if (toStatus === 'gestartet') {
    entry.serviceStartedAt = now;
    entry.trackingActive = false;
  }

  if (toStatus === 'pausiert') {
    entry.trackingActive = false;
  }

  if (toStatus === 'beendet' || toStatus === 'abgeschlossen' || toStatus === 'storniert') {
    entry.trackingActive = false;
    entry.driveStartedAt = null;
    entry.serviceStartedAt = null;
  }

  void fromStatus;
}

export function buildEmployeePortalTrackingSnapshot(
  tenantId: string,
  assignmentId: string,
  status: AssignmentStatus,
  gpsPermission: EmployeePortalGpsPermissionStatus,
): EmployeePortalTrackingSnapshot {
  const entry = getEntry(tenantId, assignmentId);
  const timers = computeEmployeePortalLiveTimers(tenantId, assignmentId, status);
  const warnings: string[] = [];

  if (!entry.consent.granted) {
    warnings.push(EMPLOYEE_PORTAL_CONSENT_PENDING_WARNING);
  } else if (gpsPermission === 'denied') {
    warnings.push('Standortberechtigung verweigert — keine Live-Position, Timer laufen weiter.');
  } else if (gpsPermission === 'unavailable') {
    warnings.push('Standortdienst nicht verfügbar (z. B. Vitest/Web ohne GPS).');
  }

  if (entry.geofenceLastCheck?.warning) {
    warnings.push(entry.geofenceLastCheck.warning);
  }

  if (!isGpsTrackingLiveReady()) {
    warnings.push(
      'Echtzeit-Backend-Streaming (assist_tracking_points) noch nicht live — Foreground-GPS nur sessionbasiert.',
    );
  }

  const assistVisible =
    entry.trackingActive &&
    (status === 'unterwegs' || status === 'angekommen') &&
    Boolean(entry.lastPosition);

  return {
    assignmentId,
    tenantId,
    status,
    consent: { ...entry.consent },
    gpsPermission,
    trackingActive: entry.trackingActive,
    lastPosition: entry.lastPosition ? { ...entry.lastPosition } : null,
    timers,
    geofence: entry.geofenceLastCheck ? { ...entry.geofenceLastCheck } : null,
    warnings,
    assistVisible,
    clientPortalVisible: false,
  };
}

export function listEmployeePortalTrackingSnapshots(
  tenantId: string,
  assignmentIds: string[],
  statusByAssignment: Map<string, AssignmentStatus>,
  gpsPermission: EmployeePortalGpsPermissionStatus,
): EmployeePortalTrackingSnapshot[] {
  return assignmentIds.map((assignmentId) =>
    buildEmployeePortalTrackingSnapshot(
      tenantId,
      assignmentId,
      statusByAssignment.get(assignmentId) ?? 'geplant',
      gpsPermission,
    ),
  );
}

/** Rebuild consent/GPS warnings after DB enrichment (Assist live monitor read path). */
export function rebuildEmployeePortalTrackingWarnings(
  consent: EmployeePortalLocationConsent,
  gpsPermission: EmployeePortalGpsPermissionStatus,
  existingWarnings: string[],
): string[] {
  const withoutConsentWarning = existingWarnings.filter(
    (w) => w !== EMPLOYEE_PORTAL_CONSENT_PENDING_WARNING,
  );

  if (consent.granted) {
    return withoutConsentWarning;
  }

  return [EMPLOYEE_PORTAL_CONSENT_PENDING_WARNING, ...withoutConsentWarning];
}

export function resetEmployeePortalVisitTrackingStore(): void {
  TRACKING_STORE.clear();
}

export function peekEmployeePortalTrackingEntry(
  tenantId: string,
  assignmentId: string,
): TrackingEntry {
  return getEntry(tenantId, assignmentId);
}
