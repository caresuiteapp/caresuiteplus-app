import { useCallback, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  getAssistLiveMonitoring,
  type AssistLiveMonitoringOverview,
} from '@/features/assistLive/getAssistLiveMonitoring';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useVisibilityAwarePolling } from '@/lib/polling/useVisibilityAwarePolling';
import { useManagedSupabaseChannel } from '@/lib/realtime/useManagedSupabaseChannel';
import { DEFAULT_LIVE_POLL_MS } from '@/hooks/core';
import { useDevicePerformance, livePollIntervalMs } from '@/lib/performance';
import { getServiceMode } from '@/lib/services/mode';
import { useAsyncQuery } from '@/hooks/core';

function registerAssistLiveChannel(channel: RealtimeChannel, tenantId: string): RealtimeChannel {
  const filter = `tenant_id=eq.${tenantId}`;
  return channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assist_visits', filter }, () => undefined)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assist_tracking_sessions', filter }, () => undefined)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assist_location_points', filter }, () => undefined)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assist_time_events', filter }, () => undefined);
}

export type UseAssistLiveMonitoringOptions = {
  enabled?: boolean;
};

export function useAssistLiveMonitoring(options?: UseAssistLiveMonitoringOptions) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const perf = useDevicePerformance();
  const enabled = options?.enabled ?? true;
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const pollMs = livePollIntervalMs(perf.profile, DEFAULT_LIVE_POLL_MS);

  useVisibilityAwarePolling({
    enabled: enabled && Boolean(tenantId),
    intervalMs: pollMs,
    onPoll: bump,
  });

  useManagedSupabaseChannel(
    {
      channelName: tenantId ? `assist:live-monitoring:${tenantId}` : '',
      enabled: enabled && Boolean(tenantId) && getServiceMode() === 'supabase',
      pollMs,
      registerListeners: (channel) => registerAssistLiveChannel(channel, tenantId!),
    },
    bump,
  );

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      void tick;
      return getAssistLiveMonitoring(tenantId, roleKey);
    },
    [tenantId, roleKey, tick],
    { enabled: enabled && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  const overview = query.data as AssistLiveMonitoringOverview | undefined;

  return {
    overview,
    counters: overview
      ? {
          todayCount: overview.todayCount,
          runningCount: overview.runningCount,
          activeTrackingCount: overview.activeTrackingCount,
          consentPendingCount: overview.consentPendingCount,
          gpsDeniedCount: overview.gpsDeniedCount,
        }
      : null,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
