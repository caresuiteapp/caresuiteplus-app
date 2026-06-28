import { useMemo } from 'react';
import { DEFAULT_LIVE_POLL_MS, useLiveRefresh } from '@/hooks/core';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';

type EmployeePortalRealtimeOptions = {
  pollMs?: number;
  refreshOnFocus?: boolean;
};

/** Live refresh for Mitarbeiterportal dashboard, Einsätze, KPIs and profile. */
export function useEmployeePortalRealtime(
  tenantId: string | null | undefined,
  employeeId: string | null | undefined,
  onRefresh: () => void,
  options?: EmployeePortalRealtimeOptions,
): { isConnected: boolean } {
  const enabled = Boolean(tenantId && employeeId);

  const subscribeFactory = useMemo(() => {
    if (!enabled || !tenantId || !employeeId) return undefined;
    return (handler: () => void) => subscribeToEmployeePortalChanges(tenantId, employeeId, handler);
  }, [enabled, tenantId, employeeId]);

  return useLiveRefresh({
    enabled,
    onRefresh,
    subscribe: subscribeFactory,
    pollMs: options?.pollMs ?? DEFAULT_LIVE_POLL_MS,
    refreshOnFocus: options?.refreshOnFocus ?? true,
  });
}
