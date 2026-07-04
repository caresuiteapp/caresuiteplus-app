import { useCallback, useState } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { loadDashboardProjectionWithCache } from '@/lib/offline/assignmentCacheService';
import type { AssignmentCacheMeta } from '@/lib/offline/types';

export function useEmployeePortalDashboard() {
  const { tenantId, employeeId, roleKey, actorId, isReady } = usePortalActor();
  const [cacheMeta, setCacheMeta] = useState<AssignmentCacheMeta>({
    fromCache: false,
    cachedAt: null,
  });

  const query = useAsyncQuery(
    async () => {
      if (!tenantId || !employeeId) {
        return {
          ok: false as const,
          error: 'Mitarbeiterprofil konnte nicht geladen werden.',
          fromCache: false,
          cachedAt: null,
        };
      }
      const result = await loadDashboardProjectionWithCache(
        tenantId,
        employeeId,
        roleKey,
        actorId ?? '',
      );
      setCacheMeta({ fromCache: result.fromCache, cachedAt: result.cachedAt });
      return result;
    },
    [tenantId, employeeId, roleKey, actorId],
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
    fromCache: cacheMeta.fromCache,
    cachedAt: cacheMeta.cachedAt,
  };
}
