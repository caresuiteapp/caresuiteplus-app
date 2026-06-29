/**
 * PERF.1 — Singleton geolocation watch per session key.
 * Prevents multiple watchPosition calls across components/hooks.
 */
import { Platform } from 'react-native';
import {
  getDevicePerformanceProfile,
  gpsWatchMaxAgeMs,
  setActiveTrackingPerformanceMode,
} from '@/lib/performance/devicePerformance';

export type GeolocationSnapshot = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

export type SingleGeolocationWatchOptions = {
  sessionKey: string;
  enabled: boolean;
  onSnapshot: (snapshot: GeolocationSnapshot) => void;
  onError?: (code: number, message: string) => void;
  enableHighAccuracy?: boolean;
};

type WatchEntry = {
  watchId: number | null;
  sessionKey: string;
  refCount: number;
  lastCallbackAt: number;
  lastCoords: { lat: number; lon: number } | null;
  subscribers: Set<(snapshot: GeolocationSnapshot) => void>;
  errorHandlers: Set<(code: number, message: string) => void>;
};

const watches = new Map<string, WatchEntry>();

const MIN_CALLBACK_INTERVAL_MS = 5_000;
const MIN_MOVE_METERS = 5;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function snapshotFromPosition(position: GeolocationPosition): GeolocationSnapshot {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy ?? null,
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

function dispatchSnapshot(entry: WatchEntry, snapshot: GeolocationSnapshot): void {
  const now = Date.now();
  const last = entry.lastCoords;
  const moved =
    !last ||
    haversineMeters(last.lat, last.lon, snapshot.latitude, snapshot.longitude) >= MIN_MOVE_METERS;
  const elapsed = now - entry.lastCallbackAt;

  if (elapsed < MIN_CALLBACK_INTERVAL_MS && !moved) return;

  entry.lastCallbackAt = now;
  entry.lastCoords = { lat: snapshot.latitude, lon: snapshot.longitude };
  for (const handler of entry.subscribers) {
    handler(snapshot);
  }
}

function startWatch(entry: WatchEntry, enableHighAccuracy: boolean): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  if (entry.watchId != null) return;

  const profile = getDevicePerformanceProfile();
  const maxAge = gpsWatchMaxAgeMs(profile.profile);

  entry.watchId = navigator.geolocation.watchPosition(
    (position) => dispatchSnapshot(entry, snapshotFromPosition(position)),
    (geoError) => {
      for (const handler of entry.errorHandlers) {
        handler(geoError.code, geoError.message);
      }
    },
    {
      enableHighAccuracy: enableHighAccuracy ?? profile.profile !== 'mobileBatterySaver',
      timeout: 15_000,
      maximumAge: Platform.OS === 'ios' ? maxAge : Math.max(maxAge, 10_000),
    },
  );
}

function stopWatch(sessionKey: string): void {
  const entry = watches.get(sessionKey);
  if (!entry) return;

  if (entry.watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(entry.watchId);
  }
  watches.delete(sessionKey);

  if (watches.size === 0) {
    setActiveTrackingPerformanceMode(false);
  }
}

export function acquireGeolocationWatch(options: SingleGeolocationWatchOptions): () => void {
  const { sessionKey, enabled, onSnapshot, onError, enableHighAccuracy = true } = options;

  if (!enabled || !sessionKey) {
    return () => undefined;
  }

  let entry = watches.get(sessionKey);
  if (!entry) {
    entry = {
      watchId: null,
      sessionKey,
      refCount: 0,
      lastCallbackAt: 0,
      lastCoords: null,
      subscribers: new Set(),
      errorHandlers: new Set(),
    };
    watches.set(sessionKey, entry);
    setActiveTrackingPerformanceMode(true);
  }

  entry.refCount += 1;
  entry.subscribers.add(onSnapshot);
  if (onError) entry.errorHandlers.add(onError);
  startWatch(entry, enableHighAccuracy);

  return () => {
    const current = watches.get(sessionKey);
    if (!current) return;

    current.subscribers.delete(onSnapshot);
    if (onError) current.errorHandlers.delete(onError);
    current.refCount -= 1;

    if (current.refCount <= 0 || current.subscribers.size === 0) {
      stopWatch(sessionKey);
    }
  };
}

export function captureGeolocationOnce(): Promise<GeolocationSnapshot | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  const profile = getDevicePerformanceProfile();

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(snapshotFromPosition(position)),
      () => resolve(null),
      {
        enableHighAccuracy: profile.profile !== 'mobileBatterySaver',
        timeout: 15_000,
        maximumAge: gpsWatchMaxAgeMs(profile.profile),
      },
    );
  });
}

/** Test helper — reset singleton state. */
export function resetGeolocationWatchesForTests(): void {
  for (const key of [...watches.keys()]) {
    stopWatch(key);
  }
}

export function getActiveGeolocationWatchCount(): number {
  return watches.size;
}

/** React hook wrapper. */
import { useEffect, useRef } from 'react';

export function useSingleGeolocationWatch(options: SingleGeolocationWatchOptions): void {
  const onSnapshotRef = useRef(options.onSnapshot);
  const onErrorRef = useRef(options.onError);
  onSnapshotRef.current = options.onSnapshot;
  onErrorRef.current = options.onError;

  useEffect(() => {
    if (!options.enabled || !options.sessionKey) return;

    return acquireGeolocationWatch({
      sessionKey: options.sessionKey,
      enabled: true,
      enableHighAccuracy: options.enableHighAccuracy,
      onSnapshot: (snap) => onSnapshotRef.current(snap),
      onError: (code, msg) => onErrorRef.current?.(code, msg),
    });
  }, [options.sessionKey, options.enabled, options.enableHighAccuracy]);
}
