import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import {
  attachRealtimeHandler,
  createDemoPollSubscription,
  createRealtimeChannel,
  detachRealtimeHandler,
  dispatchRealtimeHandlers,
  getRealtimeSubscription,
  registerRealtimeSubscription,
  type RealtimeHandler,
} from './channelManager';

export type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type TenantTableSpec = {
  table: string;
  event?: PostgresChangeEvent;
  filter?: string;
};

export type SubscribeToTenantTablesOptions = {
  subscriptionKey: string;
  channelName: string;
  specs: TenantTableSpec[];
  demoPollMs?: number;
};

function registerPostgresListeners(
  channel: RealtimeChannel,
  subscriptionKey: string,
  specs: TenantTableSpec[],
): RealtimeChannel {
  let configured = channel;
  for (const spec of specs) {
    configured = configured.on(
      'postgres_changes',
      {
        event: spec.event ?? '*',
        schema: 'public',
        table: spec.table,
        ...(spec.filter ? { filter: spec.filter } : {}),
      },
      () => {
        const sub = getRealtimeSubscription(subscriptionKey);
        if (sub) dispatchRealtimeHandlers(sub);
      },
    );
  }
  return configured;
}

/** Deduped tenant-scoped postgres_changes subscription — listeners registered before subscribe(). */
export function subscribeToTenantTables(
  options: SubscribeToTenantTablesOptions,
  handler: RealtimeHandler,
): () => void {
  const { subscriptionKey, channelName, specs, demoPollMs } = options;
  const existing = getRealtimeSubscription(subscriptionKey);
  if (existing) {
    return attachRealtimeHandler(subscriptionKey, handler);
  }

  if (isDemoMode()) {
    return createDemoPollSubscription(subscriptionKey, handler, demoPollMs);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    registerRealtimeSubscription(subscriptionKey, { handlers: new Set([handler]), timer: null });
    return () => detachRealtimeHandler(subscriptionKey, handler);
  }

  const rtChannel = createRealtimeChannel(supabase, channelName, (channel) =>
    registerPostgresListeners(channel, subscriptionKey, specs),
  );

  registerRealtimeSubscription(subscriptionKey, {
    handlers: new Set([handler]),
    timer: null,
    supabaseChannel: rtChannel,
  });

  return () => detachRealtimeHandler(subscriptionKey, handler);
}
