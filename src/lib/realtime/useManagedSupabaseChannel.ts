import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  attachRealtimeHandler,
  createRealtimeChannel,
  registerRealtimeSubscription,
  unsubscribeRealtime,
  type RealtimeHandler,
} from '@/lib/realtime/channelManager';
import { createVisibilityAwareInterval } from '@/lib/polling/useVisibilityAwarePolling';

export type ManagedChannelOptions = {
  channelName: string;
  enabled?: boolean;
  /** Fallback poll when Realtime unavailable (demo mode). 0 = disabled. */
  pollMs?: number;
  registerListeners: (channel: RealtimeChannel) => RealtimeChannel;
};

/**
 * PERF.1 — Deduped Supabase channel with visibility-aware fallback polling.
 */
export function useManagedSupabaseChannel(
  options: ManagedChannelOptions,
  onEvent: RealtimeHandler,
): { isConnected: boolean } {
  const { channelName, enabled = true, pollMs = 0, registerListeners } = options;
  const [isConnected, setIsConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const registerRef = useRef(registerListeners);
  registerRef.current = registerListeners;

  useEffect(() => {
    if (!enabled || !channelName) {
      setIsConnected(false);
      return;
    }

    const supabase = getSupabaseClient();
    let pollCleanup: (() => void) | null = null;

    if (supabase) {
      const channel = createRealtimeChannel(supabase, channelName, (ch) => registerRef.current(ch));

      registerRealtimeSubscription(channelName, {
        handlers: new Set([() => onEventRef.current()]),
        timer: null,
        supabaseChannel: channel,
      });

      const detach = attachRealtimeHandler(channelName, () => onEventRef.current());
      setIsConnected(true);

      return () => {
        detach();
        unsubscribeRealtime(channelName);
        setIsConnected(false);
      };
    }

    if (pollMs > 0) {
      pollCleanup = createVisibilityAwareInterval(() => onEventRef.current(), pollMs);
      setIsConnected(false);
    }

    return () => {
      pollCleanup?.();
      setIsConnected(false);
    };
  }, [enabled, channelName, pollMs]);

  return { isConnected };
}

/** Imperative helper for non-React modules. */
export function subscribeManagedChannel(
  supabase: SupabaseClient | null,
  key: string,
  registerListeners: (channel: RealtimeChannel) => RealtimeChannel,
  handler: RealtimeHandler,
  pollMs = 0,
): () => void {
  if (supabase) {
    const channel = createRealtimeChannel(supabase, key, registerListeners);
    registerRealtimeSubscription(key, {
      handlers: new Set([handler]),
      timer: null,
      supabaseChannel: channel,
    });
    return attachRealtimeHandler(key, handler);
  }

  if (pollMs > 0) {
    return createVisibilityAwareInterval(handler, pollMs);
  }

  return () => undefined;
}
