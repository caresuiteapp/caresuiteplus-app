import type * as ExpoLocation from 'expo-location';
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  GPS_TRACKING_PREPARED_MESSAGE,
  isGpsTrackingLiveReady,
} from '@/lib/assist/gpsTrackingConfig';

function loadExpoLocation(): typeof ExpoLocation {
  // Lazy load — vermeidet react-native Pull in Vitest bei reinen Source/List-Tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-location') as typeof ExpoLocation;
}

export type GpsPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type GpsPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestamp: string;
};

export type GpsTrackingSession = {
  sessionId: string;
  tripId: string;
  startedAt: string;
};

function blockGpsPreparedOnly<T>(): ServiceResult<T> | null {
  if (!isGpsTrackingLiveReady()) {
    return { ok: false, error: GPS_TRACKING_PREPARED_MESSAGE };
  }
  return null;
}

function mapPermissionStatus(status: string): GpsPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/** Foreground-Berechtigung anfragen — nur wenn GPS live-ready. */
export async function requestGpsForegroundPermission(): Promise<ServiceResult<GpsPermissionStatus>> {
  const blocked = blockGpsPreparedOnly<GpsPermissionStatus>();
  if (blocked) return blocked;

  const Location = loadExpoLocation();
  const { status } = await Location.requestForegroundPermissionsAsync();
  return { ok: true, data: mapPermissionStatus(status) };
}

/** Aktuellen Gerätestandort lesen — Mandant + Permission + live-ready. */
export async function getCurrentGpsPosition(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<GpsPosition>> {
  const denied = enforcePermission<GpsPosition>(actorRoleKey, 'assist.tracking.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const blocked = blockGpsPreparedOnly<GpsPosition>();
  if (blocked) return blocked;

  const Location = loadExpoLocation();
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    return { ok: false, error: 'Standortberechtigung nicht erteilt.' };
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    ok: true,
    data: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracyMeters: location.coords.accuracy,
      timestamp: new Date(location.timestamp).toISOString(),
    },
  };
}

/** Fahrt-GPS-Session starten — Backend-Sync folgt in späterem Sprint. */
export async function startTripGpsSession(
  tripId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<GpsTrackingSession>> {
  const denied = enforcePermission<GpsTrackingSession>(actorRoleKey, 'assist.trips.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const blocked = blockGpsPreparedOnly<GpsTrackingSession>();
  if (blocked) return blocked;

  const permResult = await requestGpsForegroundPermission();
  if (!permResult.ok) return permResult;
  if (permResult.data !== 'granted') {
    return { ok: false, error: 'Standortberechtigung für Fahrten-Tracking erforderlich.' };
  }

  return {
    ok: true,
    data: {
      sessionId: `gps-${tripId}-${Date.now()}`,
      tripId,
      startedAt: new Date().toISOString(),
    },
  };
}

/** Prüft Berechtigungsstatus ohne Anfrage — immer erlaubt (preparedOnly liefert undetermined). */
export async function getGpsPermissionStatus(): Promise<ServiceResult<GpsPermissionStatus>> {
  if (!isGpsTrackingLiveReady()) {
    return { ok: true, data: 'undetermined' };
  }

  const Location = loadExpoLocation();
  const { status } = await Location.getForegroundPermissionsAsync();
  return { ok: true, data: mapPermissionStatus(status) };
}
