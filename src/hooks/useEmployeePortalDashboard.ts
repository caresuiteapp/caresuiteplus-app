import { useCallback } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { getEmployeePortalDashboardProjection } from '@/lib/portal/employeePortalProjectionService';

export function useEmployeePortalDashboard() {
  const { tenantId, employeeId, roleKey, isReady } = usePortalActor();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({
          ok: false as const,
          error: 'Mitarbeiterprofil konnte nicht geladen werden.',
        });
      }
      return getEmployeePortalDashboardProjection(tenantId, employeeId, roleKey);
    },
    [tenantId, employeeId, roleKey],
    {
      enabled: isReady && Boolean(tenantId && employeeId),
      live:
        tenantId && employeeId
          ? {
              tenantId,
              subscribe: (tid, handler) => subscribeToEmployeePortalChanges(tid, employeeId, handler),
            }
          : undefined,
    },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    dashboard: query.data ?? null,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh,
    isReady,
    isLiveConnected: query.isLiveConnected,
  };
}
