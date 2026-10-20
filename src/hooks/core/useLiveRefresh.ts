import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createVisibilityAwareInterval } from '@/lib/polling/useVisibilityAwarePolling';

export const DEFAULT_LIVE_POLL_MS = 30_000;
export const OPERATIONAL_LIVE_POLL_MS = 15_000;
/** Live tracking: 15s polling fallback alongside Realtime (PERF.1: was 10s). */
export const LIVE_TRACKING_POLL_MS = 15_000;

export type LiveRefreshOptions = {
  enabled?: boolean;
  onRefresh: () => void;
  /** Deduped Supabase/demo subscription factory. */
  subscribe?: (handler: () => void) => () => void;
  /** Fallback polling interval (also used in demo when no Supabase). */
  pollMs?: number;
  /** Reload when app/tab becomes visible again. Default true. */
  refreshOnFocus?: boolean;
};

function isDocumentHidden(): boolean {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.visibilityState === 'hidden';
  }
  return AppState.currentState !== 'active';
}

/**
 * Keeps screen data fresh: realtime postgres_changes (when subscribed),
 * visibility-aware periodic polling fallback, and refresh on app/tab focus.
 */
export function useLiveRefresh(options: LiveRefreshOptions): { isLiveConnected: boolean } {
  const {
    enabled = true,
    onRefresh,
    subscribe,
    pollMs = DEFAULT_LIVE_POLL_MS,
    refreshOnFocus = true,
  } = options;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsLiveConnected(false);
      return;
    }

    const trigger = () => {
      if (!isDocumentHidden()) {
        onRefreshRef.current();
      }
    };

    let pollCleanup: (() => void) | null = null;
    const unsubscribeRealtime = subscribe?.(trigger) ?? null;
    setIsLiveConnected(Boolean(subscribe));

    if (pollMs > 0) {
      pollCleanup = createVisibilityAwareInterval(trigger, pollMs);
    }

    return () => {
      unsubscribeRealtime?.();
      pollCleanup?.();
      setIsLiveConnected(false);
    };
  }, [enabled, subscribe, pollMs]);

  useEffect(() => {
    if (!enabled || !refreshOnFocus) return;

    const onFocus = () => {
      onRefreshRef.current();
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibility = () => {
        if (document.visibilityState === 'visible') onFocus();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') onFocus();
    });
    return () => subscription.remove();
  }, [enabled, refreshOnFocus]);

  return { isLiveConnected };
}
