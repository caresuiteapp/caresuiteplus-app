import { useCallback } from 'react';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core';
import { getEmployeePortalDashboardProjection } from '@/lib/portal/employeePortalProjectionService';

export function useEmployeePortalDashboard() {
  const { tenantId, employeeId, roleKey, isReady } = usePortalActor();

  const query = useAsyncQuery(
    async (): Promise<EmployeePortalDashboardProjection> => {
      if (!tenantId || !employeeId) {
        throw new Error('Mitarbeiterprofil konnte nicht geladen werden.');
      }
      const result = await getEmployeePortalDashboardProjection(tenantId, employeeId, roleKey);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    },
    [tenantId, employeeId, roleKey],
    { enabled: isReady && Boolean(tenantId && employeeId) },
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
  };
}
