import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { createVisibilityAwareInterval } from '@/lib/polling/useVisibilityAwarePolling';
import { COMMUNICATION_REALTIME_CHANNELS } from './communication.constants';

export type RealtimeEventType =
  | 'message_created'
  | 'message_updated'
  | 'message_deleted'
  | 'thread_updated'
  | 'participant_read'
  | 'typing_started'
  | 'typing_stopped'
  | 'reaction_added'
  | 'attachment_uploaded';

export type RealtimeEvent = {
  type: RealtimeEventType;
  threadId?: string;
  payload?: Record<string, unknown>;
};

type Subscription = {
  channel: string;
  handler: (event: RealtimeEvent) => void;
  pollCleanup: (() => void) | null;
  supabaseChannel?: { unsubscribe: () => void };
};

const subscriptions = new Map<string, Subscription>();

export function subscribeToThread(
  tenantId: string,
  threadId: string,
  handler: (event: RealtimeEvent) => void,
): () => void {
  const channel = COMMUNICATION_REALTIME_CHANNELS.messages(threadId);
  const key = `thread:${threadId}`;

  if (isDemoMode()) {
    const sub: Subscription = { channel, handler, pollCleanup: null };
    sub.pollCleanup = createVisibilityAwareInterval(
      () => handler({ type: 'thread_updated', threadId, payload: { demo: true } }),
      30_000,
    );
    subscriptions.set(key, sub);
    return () => unsubscribeFromThread(threadId);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const rtChannel = supabase
      .channel(`thread:${threadId}:messages`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communication_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          handler({ type: 'message_created', threadId, payload: { tenantId } });
        },
      )
      .subscribe();

    subscriptions.set(key, {
      channel,
      handler,
      pollCleanup: null,
      supabaseChannel: { unsubscribe: () => supabase.removeChannel(rtChannel) },
    });
    return () => unsubscribeFromThread(threadId);
  }

  subscriptions.set(key, { channel, handler, pollCleanup: null });
  return () => unsubscribeFromThread(threadId);
}

export function subscribeToThreadList(
  tenantId: string,
  handler: (event: RealtimeEvent) => void,
): () => void {
  const channel = COMMUNICATION_REALTIME_CHANNELS.threads(tenantId);
  const key = `list:${tenantId}`;

  if (isDemoMode()) {
    const sub: Subscription = { channel, handler, pollCleanup: null };
    sub.pollCleanup = createVisibilityAwareInterval(
      () => handler({ type: 'thread_updated', payload: { demo: true } }),
      45_000,
    );
    subscriptions.set(key, sub);
    return () => {
      const current = subscriptions.get(key);
      current?.pollCleanup?.();
      subscriptions.delete(key);
    };
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const rtChannel = supabase
      .channel(`tenant:${tenantId}:communication_threads`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communication_threads',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          handler({ type: 'thread_updated', payload: { tenantId } });
        },
      )
      .subscribe();

    subscriptions.set(key, {
      channel,
      handler,
      pollCleanup: null,
      supabaseChannel: { unsubscribe: () => supabase.removeChannel(rtChannel) },
    });
    return () => {
      const sub = subscriptions.get(key);
      sub?.supabaseChannel?.unsubscribe();
      subscriptions.delete(key);
    };
  }

  subscriptions.set(key, { channel, handler, pollCleanup: null });
  return () => {
    subscriptions.delete(key);
  };
}

export function unsubscribeFromThread(threadId: string): void {
  const key = `thread:${threadId}`;
  const sub = subscriptions.get(key);
  sub?.pollCleanup?.();
  sub?.supabaseChannel?.unsubscribe();
  subscriptions.delete(key);
}

export function publishTypingStartedPrepared(threadId: string): void {
  const key = `thread:${threadId}`;
  subscriptions.get(key)?.handler({ type: 'typing_started', threadId });
}

export function publishTypingStoppedPrepared(threadId: string): void {
  const key = `thread:${threadId}`;
  subscriptions.get(key)?.handler({ type: 'typing_stopped', threadId });
}

export function getActiveSubscriptionCount(): number {
  return subscriptions.size;
}

export function clearAllRealtimeSubscriptions(): void {
  for (const [, sub] of subscriptions) {
    sub.pollCleanup?.();
    sub.supabaseChannel?.unsubscribe();
  }
  subscriptions.clear();
}
