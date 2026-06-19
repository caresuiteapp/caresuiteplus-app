import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';

export type RealtimeHandler = () => void;

type Subscription = {
  handlers: Set<RealtimeHandler>;
  timer: ReturnType<typeof setInterval> | null;
  supabaseChannel?: RealtimeChannel;
};

const subscriptions = new Map<string, Subscription>();

const DEFAULT_DEMO_POLL_MS = 30_000;

export function dispatchRealtimeHandlers(sub: Subscription): void {
  for (const handler of sub.handlers) {
    handler();
  }
}

function removeSupabaseChannel(supabase: SupabaseClient, channelName: string): void {
  const topic = `realtime:${channelName}`;
  const stale = supabase.getChannels().find((channel) => channel.topic === topic);
  if (stale) {
    void supabase.removeChannel(stale);
  }
}

/** Register postgres_changes listeners before subscribe() — avoids Supabase race bugs. */
export function createRealtimeChannel(
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

export function getRealtimeSubscription(key: string): Subscription | undefined {
  return subscriptions.get(key);
}

export function registerRealtimeSubscription(key: string, sub: Subscription): void {
  subscriptions.set(key, sub);
}

export function attachRealtimeHandler(key: string, handler: RealtimeHandler): () => void {
  const sub = subscriptions.get(key);
  if (!sub) return () => undefined;

  sub.handlers.add(handler);
  return () => detachRealtimeHandler(key, handler);
}

export function detachRealtimeHandler(key: string, handler: RealtimeHandler): void {
  const sub = subscriptions.get(key);
  if (!sub) return;

  sub.handlers.delete(handler);
  if (sub.handlers.size === 0) {
    unsubscribeRealtime(key);
  }
}

export function unsubscribeRealtime(key: string): void {
  const sub = subscriptions.get(key);
  if (!sub) return;

  if (sub.timer) clearInterval(sub.timer);
  if (sub.supabaseChannel) {
    const supabase = getSupabaseClient();
    if (supabase) void supabase.removeChannel(sub.supabaseChannel);
  }
  subscriptions.delete(key);
}

export function clearAllRealtimeSubscriptions(): void {
  for (const key of [...subscriptions.keys()]) {
    unsubscribeRealtime(key);
  }
}

export function getActiveRealtimeSubscriptionCount(): number {
  return subscriptions.size;
}

export function createDemoPollSubscription(
  key: string,
  handler: RealtimeHandler,
  intervalMs = DEFAULT_DEMO_POLL_MS,
): () => void {
  const existing = subscriptions.get(key);
  if (existing) {
    return attachRealtimeHandler(key, handler);
  }

  const sub: Subscription = { handlers: new Set([handler]), timer: null };
  sub.timer = setInterval(() => dispatchRealtimeHandlers(sub), intervalMs);
  registerRealtimeSubscription(key, sub);
  return () => detachRealtimeHandler(key, handler);
}
