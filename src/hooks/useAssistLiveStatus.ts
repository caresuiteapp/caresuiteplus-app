import { useCallback, useEffect, useState } from 'react';
import { fetchAssistLiveStatusOverview } from '@/lib/assist/assistLiveTrackingViewService';
import type { AssistLiveStatusOverview } from '@/lib/assist/assistLiveTrackingViewService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { subscribeToAssistLiveTrackingChanges } from '@/lib/realtime';
import { useVisibilityAwarePolling } from '@/lib/polling/useVisibilityAwarePolling';
import { DEFAULT_LIVE_POLL_MS } from '@/hooks/core';
import { useDevicePerformance, livePollIntervalMs } from '@/lib/performance';
import { useAsyncQuery } from './core';

export function useAssistLiveStatus() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const perf = useDevicePerformance();
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useVisibilityAwarePolling({
    enabled: Boolean(tenantId),
    intervalMs: livePollIntervalMs(perf.profile, DEFAULT_LIVE_POLL_MS),
    onPoll: bump,
  });

  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = subscribeToAssistLiveTrackingChanges(tenantId, bump);
    return unsubscribe;
  }, [tenantId, bump]);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      void tick;
      return fetchAssistLiveStatusOverview(tenantId, roleKey);
    },
    [tenantId, roleKey, tick],
    { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    overview: query.data as AssistLiveStatusOverview | undefined,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
