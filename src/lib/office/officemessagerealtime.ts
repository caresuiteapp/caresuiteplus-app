import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { createVisibilityAwareInterval } from '@/lib/polling/useVisibilityAwarePolling';

export type OfficeMessageRealtimeEvent = {
  type: 'message_changed' | 'thread_changed';
  threadId?: string;
  tenantId: string;
};

type Subscription = {
  handlers: Set<(event: OfficeMessageRealtimeEvent) => void>;
  pollCleanup: (() => void) | null;
  supabaseChannel?: RealtimeChannel;
};

const subscriptions = new Map<string, Subscription>();

const POLL_INTERVAL_MS = 20_000;

function dispatch(sub: Subscription, event: OfficeMessageRealtimeEvent): void {
  for (const handler of sub.handlers) {
    handler(event);
  }
}

function removeSupabaseChannel(supabase: SupabaseClient, channelName: string): void {
  const topic = `realtime:${channelName}`;
  const stale = supabase.getChannels().find((channel) => channel.topic === topic);
  if (stale) {
    void supabase.removeChannel(stale);
  }
}

function createSupabaseChannel(
  supabase: SupabaseClient,
  channelName: string,
  registerListeners: (channel: RealtimeChannel) => RealtimeChannel,
): RealtimeChannel {
  removeSupabaseChannel(supabase, channelName);
  const channel = supabase.channel(channelName);
  const configured = registerListeners(channel);
  configured.subscribe();
  return configured;
}

function detachHandler(key: string, handler: (event: OfficeMessageRealtimeEvent) => void): void {
  const sub = subscriptions.get(key);
  if (!sub) return;

  sub.handlers.delete(handler);
  if (sub.handlers.size === 0) {
    if (key.startsWith('office-thread:')) {
      unsubscribeOfficeMessageThread(key.slice('office-thread:'.length));
    } else if (key.startsWith('office-inbox:')) {
      unsubscribeOfficeMessageInbox(key.slice('office-inbox:'.length));
    }
  }
}

function attachHandler(key: string, handler: (event: OfficeMessageRealtimeEvent) => void): () => void {
  const sub = subscriptions.get(key);
  if (!sub) return () => undefined;

  sub.handlers.add(handler);
  return () => detachHandler(key, handler);
}

export function subscribeToOfficeMessageThread(
  tenantId: string,
  threadId: string,
  handler: (event: OfficeMessageRealtimeEvent) => void,
): () => void {
  const key = `office-thread:${threadId}`;
  const existing = subscriptions.get(key);
  if (existing) {
    return attachHandler(key, handler);
  }

  if (isDemoMode()) {
    const sub: Subscription = { handlers: new Set([handler]), pollCleanup: null };
    sub.pollCleanup = createVisibilityAwareInterval(
      () => dispatch(sub, { type: 'message_changed', threadId, tenantId }),
      POLL_INTERVAL_MS,
    );
    subscriptions.set(key, sub);
    return () => detachHandler(key, handler);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const channelName = `office:thread:${threadId}`;
    const rtChannel = createSupabaseChannel(supabase, channelName, (channel) =>
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${threadId}`,
          },
          () => {
            const sub = subscriptions.get(key);
            if (sub) dispatch(sub, { type: 'message_changed', threadId, tenantId });
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
            const sub = subscriptions.get(key);
            if (sub) dispatch(sub, { type: 'thread_changed', threadId, tenantId });
          },
        ),
    );

    subscriptions.set(key, {
      handlers: new Set([handler]),
      pollCleanup: null,
      supabaseChannel: rtChannel,
    });
    return () => detachHandler(key, handler);
  }

  subscriptions.set(key, { handlers: new Set([handler]), pollCleanup: null });
  return () => detachHandler(key, handler);
}

export function subscribeToOfficeMessageInbox(
  tenantId: string,
  handler: (event: OfficeMessageRealtimeEvent) => void,
): () => void {
  const key = `office-inbox:${tenantId}`;
  const existing = subscriptions.get(key);
  if (existing) {
    return attachHandler(key, handler);
  }

  if (isDemoMode()) {
    const sub: Subscription = { handlers: new Set([handler]), pollCleanup: null };
    sub.pollCleanup = createVisibilityAwareInterval(
      () => dispatch(sub, { type: 'thread_changed', tenantId }),
      POLL_INTERVAL_MS,
    );
    subscriptions.set(key, sub);
    return () => detachHandler(key, handler);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const channelName = `office:inbox:${tenantId}`;
    const rtChannel = createSupabaseChannel(supabase, channelName, (channel) =>
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_threads',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string } | null;
          const sub = subscriptions.get(key);
          if (sub) {
            dispatch(sub, {
              type: 'thread_changed',
              tenantId,
              threadId: row?.id,
            });
          }
        },
      ),
    );

    subscriptions.set(key, {
      handlers: new Set([handler]),
      pollCleanup: null,
      supabaseChannel: rtChannel,
    });
    return () => detachHandler(key, handler);
  }

  subscriptions.set(key, { handlers: new Set([handler]), pollCleanup: null });
  return () => detachHandler(key, handler);
}

export function unsubscribeOfficeMessageThread(threadId: string): void {
  const key = `office-thread:${threadId}`;
  const sub = subscriptions.get(key);
  if (!sub) return;

  sub?.pollCleanup?.();
  if (sub.supabaseChannel) {
    const supabase = getSupabaseClient();
    if (supabase) void supabase.removeChannel(sub.supabaseChannel);
  }
  subscriptions.delete(key);
}

export function unsubscribeOfficeMessageInbox(tenantId: string): void {
  const key = `office-inbox:${tenantId}`;
  const sub = subscriptions.get(key);
  if (!sub) return;

  sub?.pollCleanup?.();
  if (sub.supabaseChannel) {
    const supabase = getSupabaseClient();
    if (supabase) void supabase.removeChannel(sub.supabaseChannel);
  }
  subscriptions.delete(key);
}

export function clearAllOfficeMessageRealtimeSubscriptions(): void {
  for (const [, sub] of subscriptions) {
    sub?.pollCleanup?.();
    if (sub.supabaseChannel) {
      const supabase = getSupabaseClient();
      if (supabase) void supabase.removeChannel(sub.supabaseChannel);
    }
  }
  subscriptions.clear();
}

export function getOfficeMessageRealtimeSubscriptionCount(): number {
  return subscriptions.size;
}
