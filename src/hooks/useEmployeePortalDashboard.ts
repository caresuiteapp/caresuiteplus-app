import { useMemo } from 'react';
import { Platform } from 'react-native';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { loadDashboardProjectionWithCache } from '@/lib/offline/assignmentCacheService';

export function useEmployeePortalDashboard() {
  const { tenantId, employeeId, roleKey, actorId, isReady } = usePortalActor();

  const live = useMemo(() => tenantId && employeeId ? {
    tenantId,
    subscribe: (tid: string, handler: () => void) => subscribeToEmployeePortalChanges(tid, employeeId, handler),
  } : undefined, [tenantId, employeeId]);
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
      return result;
    },
    [tenantId, employeeId, roleKey, actorId],
    {
      enabled: isReady && Boolean(tenantId && employeeId),
      initialCache:
        Platform.OS !== 'web' && tenantId && employeeId
          ? async () => {
              const cached = await loadDashboardProjectionWithCache(
                tenantId,
                employeeId,
                roleKey,
                actorId ?? '',
                { preferCache: true },
              );
              if (cached.ok && cached.fromCache) {
                return cached;
              }
              return null;
            }
          : undefined,
      live,
      queryKey: JSON.stringify([tenantId, employeeId, roleKey, actorId]),
    },
  );
  const cacheMeta = query.cacheMeta;

  const refresh = query.refresh;

  return {
    dashboard: query.data ?? null,
    loading: query.loading && !query.data,
    error: query.error,
    refreshing: query.refreshing,
    refresh,
    isReady,
    isLiveConnected: query.isLiveConnected,
    fromCache: cacheMeta.fromCache,
    cachedAt: cacheMeta.cachedAt,
  };
}
