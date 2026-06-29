/**
 * PERF.1 — Admin/dev performance diagnostics (console + window hook).
 */
import { getActiveGeolocationWatchCount } from '@/features/liveTracking/useSingleGeolocationWatch';
import { getActiveRealtimeSubscriptionCount } from '@/lib/realtime/channelManager';
import { getDevicePerformanceProfile } from './devicePerformance';

export type PerformanceDiagnosticsSnapshot = {
  timestamp: string;
  profile: string;
  geolocationWatches: number;
  realtimeSubscriptions: number;
  documentHidden: boolean;
  memoryMb?: number;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function collectPerformanceDiagnostics(): PerformanceDiagnosticsSnapshot {
  const profile = getDevicePerformanceProfile();
  let memoryMb: number | undefined;
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    if (mem) memoryMb = Math.round(mem.usedJSHeapSize / 1024 / 1024);
  }

  return {
    timestamp: new Date().toISOString(),
    profile: profile.profile,
    geolocationWatches: getActiveGeolocationWatchCount(),
    realtimeSubscriptions: getActiveRealtimeSubscriptionCount(),
    documentHidden: typeof document !== 'undefined' ? document.hidden : false,
    memoryMb,
  };
}

export function logPerformanceDiagnostics(): PerformanceDiagnosticsSnapshot {
  const snap = collectPerformanceDiagnostics();
  if (__DEV__) {
    console.info('[PERF.1]', snap);
  }
  return snap;
}

export function installPerformanceDiagnostics(globalIntervalMs = 60_000): () => void {
  if (typeof window === 'undefined') return () => undefined;

  (window as Window & { __caresuitePerfDiagnostics?: () => PerformanceDiagnosticsSnapshot }).__caresuitePerfDiagnostics =
    collectPerformanceDiagnostics;

  if (__DEV__ && globalIntervalMs > 0) {
    pollTimer = setInterval(logPerformanceDiagnostics, globalIntervalMs);
  }

  return () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };
}
