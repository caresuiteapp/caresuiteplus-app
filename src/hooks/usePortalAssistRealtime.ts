import { useMemo } from 'react';
import { DEFAULT_LIVE_POLL_MS, useLiveRefresh } from '@/hooks/core';
import { livePollIntervalMs, useDevicePerformance } from '@/lib/performance';
import { subscribeToPortalAssistChanges } from '@/lib/realtime';

type PortalAssistRealtimeOptions = {
  pollMs?: number;
  refreshOnFocus?: boolean;
};

/** Live refresh for Assist portal dashboard, sidebar KPIs and modals. */
export function usePortalAssistRealtime(
  tenantId: string | null | undefined,
  clientId: string | null | undefined,
  onRefresh: () => void,
  options?: PortalAssistRealtimeOptions,
): { isConnected: boolean } {
  const enabled = Boolean(tenantId && clientId);
  const perf = useDevicePerformance();
  const pollMs =
    options?.pollMs ?? livePollIntervalMs(perf.profile, DEFAULT_LIVE_POLL_MS);

  const subscribeFactory = useMemo(() => {
    if (!enabled || !tenantId || !clientId) return undefined;
    return (handler: () => void) => subscribeToPortalAssistChanges(tenantId, clientId, handler);
  }, [enabled, tenantId, clientId]);

  return useLiveRefresh({
    enabled,
    onRefresh,
    subscribe: subscribeFactory,
    pollMs,
    refreshOnFocus: options?.refreshOnFocus ?? true,
  });
}
