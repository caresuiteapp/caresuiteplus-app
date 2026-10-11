/**
 * LT.GMAPS.2 + PERF.1 — Foreground GPS watch with throttled DB writes (singleton watch).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useConnectivity } from '@/hooks/useConnectivity';
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
  EMPLOYEE_LIVE_LOCATION_INTERVAL_MS,
  EMPLOYEE_ROUTE_LOCATION_INTERVAL_MS,
  type GeolocationSnapshot,
} from './useSingleGeolocationWatch';
import {
  createLiveTrackingError,
  logLiveTrackingError,
  type LiveTrackingErrorCode,
} from './liveTrackingErrors';
import type { EmployeeGpsSnapshot } from './startEmployeeLiveTracking';
import {
  enqueueAssistLocationPoint,
  flushAssistLocationPointQueue,
  getQueuedAssistLocationPointCount,
} from './assistLocationPointQueue';

export type UseEmployeeGpsTrackingOptions = {
  tenantId: string | null;
  employeeId?: string | null;
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
  queuedPointCount: number;
  lastProviderFixAt: string | null;
  errorCode: LiveTrackingErrorCode | null;
  errorMessage: string | null;
};

export function buildLiveLocationHeartbeatSnapshot(
  snapshot: EmployeeGpsSnapshot,
  _capturedAt = new Date().toISOString(),
): EmployeeGpsSnapshot {
  // A connection heartbeat is not a new GPS measurement. Keeping the provider
  // timestamp prevents stale coordinates from appearing live in Assist.
  return snapshot;
}

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

async function touchTrackingSessionHeartbeat(
  tenantId: string,
  sessionId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await fromUnknownTable(supabase, 'assist_tracking_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', sessionId)
    .eq('is_active', true);
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
  const { isOffline, isInternetReachable } = useConnectivity();
  const canSyncQueue = !isOffline && isInternetReachable !== false;
  const releaseWatchRef = useRef<(() => void) | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeSamplingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingWatchRef = useRef(false);
  const writeInFlightRef = useRef(false);
  const lastWriteRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const latestSnapshotRef = useRef<EmployeeGpsSnapshot | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const mountedRef = useRef(true);
  const watchRunRef = useRef(0);
  const scopeKey = JSON.stringify([options.tenantId, options.employeeId, options.assistVisitId, options.sessionId]);
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  const enabledRef = useRef(options.enabled);
  enabledRef.current = options.enabled;
  const lastAssistScopeRef = useRef<{ tenantId: string; employeeId: string; assistSessionId: string; assistVisitId: string } | null>(null);

  const [state, setState] = useState<EmployeeGpsTrackingState>({
    watching: false,
    dbSessionActive: Boolean(options.dbSessionActive),
    trackingActive: Boolean(options.dbSessionActive),
    lastSnapshot: null,
    lastWriteAt: null,
    writeCount: 0,
    queuedPointCount: 0,
    lastProviderFixAt: null,
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
      if (!mountedRef.current || activeScopeRef.current !== scopeKey) return false;
      if (!options.tenantId || !options.assistVisitId || !options.sessionId) return false;
      latestSnapshotRef.current = snapshot;

      setState((prev) => ({
        ...prev,
        lastSnapshot: snapshot,
        lastProviderFixAt: snapshot.capturedAt,
        errorCode: null,
        errorMessage: null,
      }));

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

      const point = {
        sessionId: options.sessionId,
        visitId: options.assistVisitId,
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        accuracyMeters: snapshot.accuracyMeters,
        recordedAt: snapshot.capturedAt,
        source: 'device' as const,
      };
      const result = await appendLocationPoint(options.tenantId, point).catch((error: unknown) => ({
        ok: false as const, error: error instanceof Error ? error.message : String(error),
      }));

      if (!result.ok) {
        const queuedPointCount = await enqueueAssistLocationPoint(options.tenantId, point);
        if (!mountedRef.current || activeScopeRef.current !== scopeKey) return true;
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
          errorMessage: `${err.userMessage} GPS-Punkt lokal gesichert (${queuedPointCount} ausstehend).`,
          queuedPointCount,
        }));
        return true;
      }

      await updateSessionLastLocation(options.tenantId, options.sessionId, snapshot.capturedAt);
      if (!mountedRef.current || activeScopeRef.current !== scopeKey) return true;
      lastWriteRef.current = now;
      lastCoordsRef.current = { lat: snapshot.latitude, lon: snapshot.longitude };

      setState((prev) => ({
        ...prev,
        lastSnapshot: snapshot,
        lastWriteAt: snapshot.capturedAt,
        writeCount: prev.writeCount + 1,
        queuedPointCount: prev.queuedPointCount,
        trackingActive: true,
        errorCode: null,
        errorMessage: null,
      }));

      return true;
    },
    [options.tenantId, options.assistVisitId, options.sessionId, scopeKey],
  );

  const captureOnce = useCallback(async (): Promise<EmployeeGpsSnapshot | null> => {
    const snap = await captureGeolocationOnce();
    if (!mountedRef.current || activeScopeRef.current !== scopeKey) return null;
    if (!snap) {
      setState((prev) => ({
        ...prev,
        errorCode: 'LIVE_GPS_POSITION_UNAVAILABLE',
        errorMessage: 'Standortdienst nicht verfügbar.',
      }));
      return null;
    }
    const snapshot = snapshotFromGeolocation(snap);
    latestSnapshotRef.current = snapshot;
    setState((prev) => ({
      ...prev,
      lastSnapshot: snapshot,
      errorCode: null,
      errorMessage: null,
    }));
    return snapshot;
  }, [scopeKey]);

  const stopWatching = useCallback(() => {
    watchRunRef.current += 1;
    startingWatchRef.current = false;
    writeInFlightRef.current = false;
    releaseWatchRef.current?.();
    releaseWatchRef.current = null;
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (routeSamplingTimerRef.current) {
      clearInterval(routeSamplingTimerRef.current);
      routeSamplingTimerRef.current = null;
    }
    if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => undefined);
      wakeLockRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      watching: false,
      trackingActive: prev.dbSessionActive,
    }));
  }, []);

  const stopAssistBackgroundTracking = useCallback(() => {
    if (Platform.OS === 'web' || !options.tenantId || !options.employeeId) return;
    const previous = lastAssistScopeRef.current;
    const scope = options.sessionId && options.assistVisitId
      ? { tenantId: options.tenantId, employeeId: options.employeeId,
          assistSessionId: options.sessionId, assistVisitId: options.assistVisitId }
      : previous?.tenantId === options.tenantId && previous.employeeId === options.employeeId
        && (!options.assistVisitId || previous.assistVisitId === options.assistVisitId) ? previous : null;
    if (!scope) return;
    void import('@/lib/employeeLogbook/employeeLogbookTracking')
      .then(({ stopNativeAssistBackgroundTracking }) => stopNativeAssistBackgroundTracking(scope))
      .catch(() => {
        if (!mountedRef.current || activeScopeRef.current !== scopeKey) return;
        setState((prev) => ({ ...prev, errorCode: 'LIVE_SESSION_UPDATE_FAILED',
          errorMessage: 'Die Hintergrundaufzeichnung konnte noch nicht beendet werden. Bitte erneut prüfen.' }));
      });
  }, [options.tenantId, options.employeeId, options.sessionId, options.assistVisitId, scopeKey]);

  const reportPersistFailure = useCallback((error: unknown, operation: string) => {
    if (!mountedRef.current || activeScopeRef.current !== scopeKey || !enabledRef.current) return;
    const failure = createLiveTrackingError('LIVE_LOCATION_INSERT_FAILED', {
      tenantId: options.tenantId, employeeId: options.employeeId, assistVisitId: options.assistVisitId,
      operation, supabaseMessage: error instanceof Error ? error.message : String(error),
    });
    logLiveTrackingError(failure);
    setState((prev) => ({ ...prev, errorCode: failure.code,
      errorMessage: 'Die GPS-Übertragung konnte nicht bestätigt werden. Bereits gesicherte Punkte bleiben erhalten; die Übertragung wird erneut versucht.' }));
  }, [scopeKey, options.tenantId, options.employeeId, options.assistVisitId]);

  const startWatching = useCallback(async (): Promise<boolean> => {
    if (!mountedRef.current || activeScopeRef.current !== scopeKey) return false;
    if (!options.enabled || !options.sessionId) return false;
    if (startingWatchRef.current) return true;

    stopWatching();
    const run = watchRunRef.current;
    const isCurrent = () => mountedRef.current && activeScopeRef.current === scopeKey &&
      watchRunRef.current === run && enabledRef.current;
    startingWatchRef.current = true;
    try {
      const first = await captureOnce();
      if (!isCurrent()) return false;
      if (first) {
        await persistSnapshot(first, true);
        if (!isCurrent()) return false;
      }

      if (options.tenantId && options.employeeId && options.assistVisitId) {
        const [{ linkActiveLogbookToAssistSession }, { resumeActiveEmployeeLogbookTracking }] = await Promise.all([
          import('@/lib/employeeLogbook/employeeLogbookTracking'),
          import('@/lib/employeeLogbook/employeeLogbookAutomation'),
        ]);
        if (!isCurrent()) return false;
        const assistScope = {
          tenantId: options.tenantId,
          employeeId: options.employeeId,
          assistSessionId: options.sessionId,
          assistVisitId: options.assistVisitId,
        };
        lastAssistScopeRef.current = assistScope;
        const linked = await linkActiveLogbookToAssistSession(assistScope, { shouldContinue: isCurrent });
        if (!isCurrent()) return false;
        if (!linked) {
          setState((prev) => ({ ...prev, watching: false, trackingActive: prev.dbSessionActive,
            errorCode: 'LIVE_SESSION_CREATE_FAILED', errorMessage: 'Die GPS-Aufzeichnung im Hintergrund konnte nicht gestartet werden. Bitte die Standortfreigabe prüfen und erneut versuchen.' }));
          return false;
        }
        await resumeActiveEmployeeLogbookTracking(options.tenantId, options.employeeId).catch(() => null);
        if (!isCurrent()) return false;
      }

      const sessionKey = `${options.tenantId ?? 't'}:employee:${options.employeeId ?? options.sessionId}`;

      releaseWatchRef.current = acquireGeolocationWatch({
        sessionKey,
        enabled: true,
        onSnapshot: (snap) => {
          if (!isCurrent()) return;
          void persistSnapshot(snapshotFromGeolocation(snap)).catch((error) => {
            if (isCurrent()) reportPersistFailure(error, 'useEmployeeGpsTracking.watch.persist');
          });
        },
        onError: (code) => {
          if (!isCurrent()) return;
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

      // Some mobile browsers deliver watchPosition updates too sparsely even
      // while the route is moving. A foreground sample every 15 seconds keeps
      // the recorded path detailed; persistence throttling still suppresses
      // unchanged or cached coordinates.
      if (Platform.OS === 'web') {
        routeSamplingTimerRef.current = setInterval(() => {
          if (!isCurrent()) return;
          if (writeInFlightRef.current) return;
          writeInFlightRef.current = true;
          void captureOnce()
            .then((snapshot) => snapshot ? persistSnapshot(snapshot) : false)
            .catch((error) => { if (isCurrent()) reportPersistFailure(error, 'useEmployeeGpsTracking.routeSampling'); })
            .finally(() => {
              if (watchRunRef.current === run) writeInFlightRef.current = false;
            });
        }, EMPLOYEE_ROUTE_LOCATION_INTERVAL_MS);
      }

      // The heartbeat proves that the producer is connected. It never creates
      // a new location row from an old coordinate.
      heartbeatTimerRef.current = setInterval(() => {
        if (!isCurrent()) return;
        if (writeInFlightRef.current) return;
        writeInFlightRef.current = true;
        void (async () => {
          if (options.tenantId && options.sessionId) {
            await touchTrackingSessionHeartbeat(options.tenantId, options.sessionId);
          }
          if (!isCurrent()) return;
          const flush = await flushAssistLocationPointQueue();
          if (!isCurrent()) return;
          setState((prev) => ({ ...prev, queuedPointCount: flush.remaining }));
          const lastFixMs = latestSnapshotRef.current
            ? new Date(latestSnapshotRef.current.capturedAt).getTime()
            : 0;
          const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
          if (visible && Date.now() - lastFixMs > 30_000) {
            const fresh = await captureOnce();
            if (fresh) await persistSnapshot(fresh, true);
          }
        })().catch((error) => {
          if (isCurrent()) reportPersistFailure(error, 'useEmployeeGpsTracking.heartbeat');
        }).finally(() => {
          if (watchRunRef.current === run) writeInFlightRef.current = false;
        });
      }, EMPLOYEE_LIVE_LOCATION_INTERVAL_MS);

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        const wakeLockNavigator = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        const wakeLock = await wakeLockNavigator.wakeLock?.request('screen').catch(() => null) ?? null;
        if (!isCurrent()) {
          await wakeLock?.release().catch(() => undefined);
          return false;
        }
        wakeLockRef.current = wakeLock;
      }

      const queuedPointCount = await getQueuedAssistLocationPointCount();
      if (!isCurrent()) return false;

      setState((prev) => ({
        ...prev,
        watching: true,
        trackingActive: true,
        queuedPointCount,
      }));

      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      stopWatching();
      const err = createLiveTrackingError('LIVE_GPS_POSITION_UNAVAILABLE', {
        operation: 'useEmployeeGpsTracking.startWatching',
        supabaseMessage: error instanceof Error ? error.message : String(error),
      });
      logLiveTrackingError(err);
      setState((prev) => ({
        ...prev,
        watching: false,
        trackingActive: prev.dbSessionActive,
        errorCode: err.code,
        errorMessage: err.userMessage,
      }));
      return false;
    } finally {
      if (watchRunRef.current === run) startingWatchRef.current = false;
    }
  }, [options.enabled, options.sessionId, options.tenantId, options.employeeId, options.assistVisitId, scopeKey, captureOnce, persistSnapshot, stopWatching, reportPersistFailure]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (options.enabled && options.sessionId) {
      if (!releaseWatchRef.current) void startWatching();
      return () => stopWatching();
    }
    stopWatching();
    stopAssistBackgroundTracking();
  }, [
    options.enabled,
    options.sessionId,
    startWatching,
    stopWatching,
    stopAssistBackgroundTracking,
  ]);

  useEffect(() => {
    // Leaving the execution screen must not stop a still-active assignment.
    // The disabled-state effect above removes the native Assist context only
    // after the workflow has actually ended.
    return () => stopWatching();
  }, [stopWatching]);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof document === 'undefined' ||
      typeof document.addEventListener !== 'function' ||
      typeof document.removeEventListener !== 'function'
    ) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !options.enabled || !options.sessionId) return;
      const run = watchRunRef.current;
      // Browsers throttle hidden tabs. On resume, immediately obtain a fresh
      // point and make sure the singleton watch is still attached.
      if (!releaseWatchRef.current) void startWatching();
      void captureOnce().then((snapshot) => snapshot ? persistSnapshot(snapshot, true) : false)
        .catch((error) => { if (watchRunRef.current === run) reportPersistFailure(error, 'useEmployeeGpsTracking.visibilityResume'); });
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        const wakeLockNavigator = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        void wakeLockNavigator.wakeLock?.request('screen')
          .then((lock) => { wakeLockRef.current = lock; })
          .catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [options.enabled, options.sessionId, captureOnce, persistSnapshot, startWatching, reportPersistFailure]);

  useEffect(() => {
    // React Native defines `window`, but not browser online/offline listeners.
    // The shared hook uses NetInfo on native and browser events only on web.
    // Retry retained points on mount/resume and when internet access returns.
    if (!canSyncQueue) return;
    let active = true;
    void flushAssistLocationPointQueue()
      .then((flush) => {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          queuedPointCount: flush.remaining,
          ...(flush.remaining === 0 && prev.errorCode === 'LIVE_LOCATION_INSERT_FAILED'
            ? { errorCode: null, errorMessage: null }
            : {}),
        }));
      })
      .catch(() => {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          errorCode: 'LIVE_LOCATION_INSERT_FAILED',
          errorMessage: 'GPS-Punkte konnten noch nicht synchronisiert werden. Die Übertragung wird erneut versucht.',
        }));
      });
    return () => {
      active = false;
    };
  }, [canSyncQueue]);

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
