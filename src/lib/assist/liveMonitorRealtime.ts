import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { getServiceMode } from '@/lib/services/mode';
import { listLiveOperationEvents } from './liveOperationEventService';

export type LiveMonitorRealtimeEvent = {
  type: 'live_event' | 'poll_refresh';
  tenantId: string;
  payload?: Record<string, unknown>;
};

type Subscription = {
  tenantId: string;
  handler: (event: LiveMonitorRealtimeEvent) => void;
  timer: ReturnType<typeof setInterval> | null;
  supabaseChannel?: { unsubscribe: () => void };
  lastEventCount: number;
};

const subscriptions = new Map<string, Subscription>();

const POLL_INTERVAL_MS = 15_000;

function emitIfNewEvents(sub: Subscription): void {
  const events = listLiveOperationEvents(sub.tenantId);
  if (events.length > sub.lastEventCount) {
    sub.lastEventCount = events.length;
    sub.handler({
      type: 'live_event',
      tenantId: sub.tenantId,
      payload: { count: events.length, latest: events[events.length - 1] },
    });
  }
}

/**
 * Abonnement für Live-Monitor-Updates.
 * Live-Modus: Supabase Realtime auf live_operation_events, Fallback Polling.
 * Demo-Modus: Polling auf In-Memory-Store — kein Fake-Event-Generator im Production Mode.
 */
export function subscribeToLiveMonitor(
  tenantId: string,
  handler: (event: LiveMonitorRealtimeEvent) => void,
): () => void {
  if (!tenantId?.trim()) {
    return () => {};
  }

  const key = `monitor:${tenantId}`;
  const initialCount = listLiveOperationEvents(tenantId).length;

  if (isDemoMode() || getServiceMode() !== 'supabase') {
    const timer = setInterval(() => {
      const sub = subscriptions.get(key);
      if (sub) emitIfNewEvents(sub);
    }, POLL_INTERVAL_MS);
    subscriptions.set(key, { tenantId, handler, timer, lastEventCount: initialCount });
    return () => unsubscribeFromLiveMonitor(tenantId);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const rtChannel = supabase
      .channel(`tenant:${tenantId}:live_operation_events`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_operation_events',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          handler({
            type: 'live_event',
            tenantId,
            payload: payload.new as Record<string, unknown>,
          });
        },
      )
      .subscribe();

    const fallbackTimer = setInterval(() => {
      const sub = subscriptions.get(key);
      if (sub) {
        sub.handler({ type: 'poll_refresh', tenantId });
      }
    }, POLL_INTERVAL_MS);

    subscriptions.set(key, {
      tenantId,
      handler,
      timer: fallbackTimer,
      supabaseChannel: { unsubscribe: () => supabase.removeChannel(rtChannel) },
      lastEventCount: initialCount,
    });
    return () => unsubscribeFromLiveMonitor(tenantId);
  }

  const timer = setInterval(() => {
    const sub = subscriptions.get(key);
    if (sub) emitIfNewEvents(sub);
  }, POLL_INTERVAL_MS);
  subscriptions.set(key, { tenantId, handler, timer, lastEventCount: initialCount });
  return () => unsubscribeFromLiveMonitor(tenantId);
}

export function unsubscribeFromLiveMonitor(tenantId: string): void {
  const key = `monitor:${tenantId}`;
  const sub = subscriptions.get(key);
  if (sub?.timer) clearInterval(sub.timer);
  sub?.supabaseChannel?.unsubscribe();
  subscriptions.delete(key);
}

export function getLiveMonitorSubscriptionCount(): number {
  return subscriptions.size;
}

export function clearAllLiveMonitorSubscriptions(): void {
  for (const [, sub] of subscriptions) {
    if (sub.timer) clearInterval(sub.timer);
    sub.supabaseChannel?.unsubscribe();
  }
  subscriptions.clear();
}

/** Production Mode: keine synthetischen Demo-Events erzeugen */
export function usesFakeLiveDataGenerator(): boolean {
  return false;
}
