import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

export const DEFAULT_LIVE_POLL_MS = 30_000;
export const OPERATIONAL_LIVE_POLL_MS = 15_000;

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

/**
 * Keeps screen data fresh: realtime postgres_changes (when subscribed),
 * periodic polling fallback, and refresh on app/tab focus.
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
      onRefreshRef.current();
    };

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const unsubscribeRealtime = subscribe?.(trigger) ?? null;
    setIsLiveConnected(Boolean(subscribe));

    if (pollMs > 0) {
      pollTimer = setInterval(trigger, pollMs);
    }

    return () => {
      unsubscribeRealtime?.();
      if (pollTimer) clearInterval(pollTimer);
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
