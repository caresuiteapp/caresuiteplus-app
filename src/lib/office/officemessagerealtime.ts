import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';

export type OfficeMessageRealtimeEvent = {
  type: 'message_changed' | 'thread_changed';
  threadId?: string;
  tenantId: string;
};

type Subscription = {
  handler: (event: OfficeMessageRealtimeEvent) => void;
  timer: ReturnType<typeof setInterval> | null;
  supabaseChannel?: { unsubscribe: () => void };
};

const subscriptions = new Map<string, Subscription>();

const POLL_INTERVAL_MS = 20_000;

export function subscribeToOfficeMessageThread(
  tenantId: string,
  threadId: string,
  handler: (event: OfficeMessageRealtimeEvent) => void,
): () => void {
  const key = `office-thread:${threadId}`;

  if (isDemoMode()) {
    const timer = setInterval(() => {
      handler({ type: 'message_changed', threadId, tenantId });
    }, POLL_INTERVAL_MS);
    subscriptions.set(key, { handler, timer });
    return () => unsubscribeOfficeMessageThread(threadId);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const rtChannel = supabase
      .channel(`office:thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          handler({ type: 'message_changed', threadId, tenantId });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_threads',
          filter: `id=eq.${threadId}`,
        },
        () => {
          handler({ type: 'thread_changed', threadId, tenantId });
        },
      )
      .subscribe();

    subscriptions.set(key, {
      handler,
      timer: null,
      supabaseChannel: { unsubscribe: () => supabase.removeChannel(rtChannel) },
    });
    return () => unsubscribeOfficeMessageThread(threadId);
  }

  subscriptions.set(key, { handler, timer: null });
  return () => unsubscribeOfficeMessageThread(threadId);
}

export function subscribeToOfficeMessageInbox(
  tenantId: string,
  handler: (event: OfficeMessageRealtimeEvent) => void,
): () => void {
  const key = `office-inbox:${tenantId}`;

  if (isDemoMode()) {
    const timer = setInterval(() => {
      handler({ type: 'thread_changed', tenantId });
    }, POLL_INTERVAL_MS);
    subscriptions.set(key, { handler, timer });
    return () => unsubscribeOfficeMessageInbox(tenantId);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const rtChannel = supabase
      .channel(`office:inbox:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_threads',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string } | null;
          handler({
            type: 'thread_changed',
            tenantId,
            threadId: row?.id,
          });
        },
      )
      .subscribe();

    subscriptions.set(key, {
      handler,
      timer: null,
      supabaseChannel: { unsubscribe: () => supabase.removeChannel(rtChannel) },
    });
    return () => unsubscribeOfficeMessageInbox(tenantId);
  }

  subscriptions.set(key, { handler, timer: null });
  return () => unsubscribeOfficeMessageInbox(tenantId);
}

export function unsubscribeOfficeMessageThread(threadId: string): void {
  const key = `office-thread:${threadId}`;
  const sub = subscriptions.get(key);
  if (sub?.timer) clearInterval(sub.timer);
  sub?.supabaseChannel?.unsubscribe();
  subscriptions.delete(key);
}

export function unsubscribeOfficeMessageInbox(tenantId: string): void {
  const key = `office-inbox:${tenantId}`;
  const sub = subscriptions.get(key);
  if (sub?.timer) clearInterval(sub.timer);
  sub?.supabaseChannel?.unsubscribe();
  subscriptions.delete(key);
}

export function clearAllOfficeMessageRealtimeSubscriptions(): void {
  for (const [, sub] of subscriptions) {
    if (sub.timer) clearInterval(sub.timer);
    sub.supabaseChannel?.unsubscribe();
  }
  subscriptions.clear();
}

export function getOfficeMessageRealtimeSubscriptionCount(): number {
  return subscriptions.size;
}
