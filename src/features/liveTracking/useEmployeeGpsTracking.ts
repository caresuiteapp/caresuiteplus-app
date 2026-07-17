/**
 * LT.GMAPS.2 + PERF.1 — Foreground GPS watch with throttled DB writes (singleton watch).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appendLocationPoint,
} from '@/lib/assist/assistTrackingPersistenceService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  getDevicePerformanceProfile,
  gpsMinMoveMeters,
  gpsMinWriteIntervalMs,
} from '@/lib/performance/devicePerformance';
import {
  acquireGeolocationWatch,
  captureGeolocationOnce,
  type GeolocationSnapshot,
} from './useSingleGeolocationWatch';
import {
  createLiveTrackingError,
  logLiveTrackingError,
  type LiveTrackingErrorCode,
} from './liveTrackingErrors';
import type { EmployeeGpsSnapshot } from './startEmployeeLiveTracking';

export type UseEmployeeGpsTrackingOptions = {
  tenantId: string | null;
  assistVisitId: string | null;
  sessionId: string | null;
  enabled: boolean;
  /** DB session active — keeps UI "Aktiv" even before first watch callback. */
  dbSessionActive?: boolean;
};

export type EmployeeGpsTrackingState = {
  watching: boolean;
  dbSessionActive: boolean;
  trackingActive: boolean;
  lastSnapshot: EmployeeGpsSnapshot | null;
  lastWriteAt: string | null;
  writeCount: number;
  errorCode: LiveTrackingErrorCode | null;
  errorMessage: string | null;
};

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function updateSessionLastLocation(
  tenantId: string,
  sessionId: string,
  capturedAt: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  await fromUnknownTable(supabase, 'assist_tracking_sessions')
    .update({
      last_location_at: capturedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', sessionId);
}

function mapGeolocationError(code: number): LiveTrackingErrorCode {
  if (code === 1) return 'LIVE_GPS_PERMISSION_DENIED';
  if (code === 2) return 'LIVE_GPS_POSITION_UNAVAILABLE';
  if (code === 3) return 'LIVE_GPS_TIMEOUT';
  return 'LIVE_GPS_POSITION_UNAVAILABLE';
}

function snapshotFromGeolocation(snapshot: GeolocationSnapshot): EmployeeGpsSnapshot {
  return {
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    accuracyMeters: snapshot.accuracyMeters,
    capturedAt: snapshot.capturedAt,
  };
}

export function useEmployeeGpsTracking(options: UseEmployeeGpsTrackingOptions): {
  state: EmployeeGpsTrackingState;
  startWatching: () => Promise<boolean>;
  stopWatching: () => void;
  captureOnce: () => Promise<EmployeeGpsSnapshot | null>;
} {
  const releaseWatchRef = useRef<(() => void) | null>(null);
  const startingWatchRef = useRef(false);
  const lastWriteRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);

  const [state, setState] = useState<EmployeeGpsTrackingState>({
    watching: false,
    dbSessionActive: Boolean(options.dbSessionActive),
    trackingActive: Boolean(options.dbSessionActive),
    lastSnapshot: null,
    lastWriteAt: null,
    writeCount: 0,
    errorCode: null,
    errorMessage: null,
  });

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      dbSessionActive: Boolean(options.dbSessionActive),
      trackingActive: prev.watching || Boolean(options.dbSessionActive),
    }));
  }, [options.dbSessionActive]);

  const persistSnapshot = useCallback(
    async (snapshot: EmployeeGpsSnapshot, force = false): Promise<boolean> => {
      if (!options.tenantId || !options.assistVisitId || !options.sessionId) return false;

      const profile = getDevicePerformanceProfile();
      const minWriteInterval = gpsMinWriteIntervalMs(profile.profile);
      const minMove = gpsMinMoveMeters(profile.profile);

      const now = Date.now();
      const last = lastCoordsRef.current;
      const moved =
        !last ||
        haversineMeters(last.lat, last.lon, snapshot.latitude, snapshot.longitude) >= minMove;
      const elapsed = now - lastWriteRef.current;

      if (!force && elapsed < minWriteInterval && !moved) {
        return true;
      }

      const result = await appendLocationPoint(options.tenantId, {
        sessionId: options.sessionId,
        visitId: options.assistVisitId,
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        accuracyMeters: snapshot.accuracyMeters,
        recordedAt: snapshot.capturedAt,
        source: 'device',
      });

      if (!result.ok) {
        const err = createLiveTrackingError('LIVE_LOCATION_INSERT_FAILED', {
          tenantId: options.tenantId,
          assistVisitId: options.assistVisitId,
          operation: 'useEmployeeGpsTracking.persist',
          supabaseMessage: result.error,
        });
        logLiveTrackingError(err);
        setState((prev) => ({
          ...prev,
          errorCode: err.code,
          errorMessage: err.userMessage,
        }));
        return false;
      }

      await updateSessionLastLocation(options.tenantId, options.sessionId, snapshot.capturedAt);
      lastWriteRef.current = now;
      lastCoordsRef.current = { lat: snapshot.latitude, lon: snapshot.longitude };

      setState((prev) => ({
        ...prev,
        lastSnapshot: snapshot,
        lastWriteAt: snapshot.capturedAt,
        writeCount: prev.writeCount + 1,
        trackingActive: true,
        errorCode: null,
        errorMessage: null,
      }));

      return true;
    },
    [options.tenantId, options.assistVisitId, options.sessionId],
  );

  const captureOnce = useCallback(async (): Promise<EmployeeGpsSnapshot | null> => {
    const snap = await captureGeolocationOnce();
    if (!snap) {
      setState((prev) => ({
        ...prev,
        errorCode: 'LIVE_GPS_POSITION_UNAVAILABLE',
        errorMessage: 'Standortdienst nicht verfügbar.',
      }));
      return null;
    }
    const snapshot = snapshotFromGeolocation(snap);
    setState((prev) => ({
      ...prev,
      lastSnapshot: snapshot,
      errorCode: null,
      errorMessage: null,
    }));
    return snapshot;
  }, []);

  const stopWatching = useCallback(() => {
    releaseWatchRef.current?.();
    releaseWatchRef.current = null;
    setState((prev) => ({
      ...prev,
      watching: false,
      trackingActive: prev.dbSessionActive,
    }));
  }, []);

  const startWatching = useCallback(async (): Promise<boolean> => {
    if (!options.enabled || !options.sessionId) return false;
    if (startingWatchRef.current) return true;

    startingWatchRef.current = true;
    stopWatching();

    const first = await captureOnce();
    if (first) {
      await persistSnapshot(first, true);
    }

    const sessionKey = `${options.tenantId ?? 't'}:${options.sessionId}`;

    releaseWatchRef.current = acquireGeolocationWatch({
      sessionKey,
      enabled: true,
      onSnapshot: (snap) => {
        void persistSnapshot(snapshotFromGeolocation(snap));
      },
      onError: (code) => {
        const mapped = mapGeolocationError(code);
        const err = createLiveTrackingError(mapped, {
          operation: 'useEmployeeGpsTracking.watchPosition',
        });
        logLiveTrackingError(err);
        setState((prev) => ({
          ...prev,
          errorCode: mapped,
          errorMessage: err.userMessage,
        }));
      },
    });

    setState((prev) => ({
      ...prev,
      watching: true,
      trackingActive: true,
    }));

    startingWatchRef.current = false;
    return true;
  }, [options.enabled, options.sessionId, options.tenantId, captureOnce, persistSnapshot, stopWatching]);

  useEffect(() => {
    if (options.enabled && options.sessionId) {
      if (!releaseWatchRef.current) void startWatching();
      return;
    }
    stopWatching();
  }, [options.enabled, options.sessionId, startWatching, stopWatching]);

  useEffect(() => {
    return () => stopWatching();
  }, [stopWatching]);

  return { state, startWatching, stopWatching, captureOnce };
}

/** Non-hook helper for tests — persist with throttle logic. */
export async function persistEmployeeGpsSnapshotThrottled(
  tenantId: string,
  assistVisitId: string,
  sessionId: string,
  snapshot: EmployeeGpsSnapshot,
): Promise<{ ok: boolean; error?: string }> {
  const result = await appendLocationPoint(tenantId, {
    sessionId,
    visitId: assistVisitId,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    accuracyMeters: snapshot.accuracyMeters,
    recordedAt: snapshot.capturedAt,
    source: 'device',
  });
  if (!result.ok) return { ok: false, error: result.error };
  await updateSessionLastLocation(tenantId, sessionId, snapshot.capturedAt);
  return { ok: true };
}
