import { useCallback, useState } from 'react';
import { loadPortalAppointmentDetailWithCache } from '@/lib/offline/assignmentCacheService';
import type { AssignmentCacheMeta } from '@/lib/offline/types';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery } from './core';

export function usePortalAppointmentDetail(appointmentId: string | undefined) {
  const { tenantId, employeeId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';
  const [cacheMeta, setCacheMeta] = useState<AssignmentCacheMeta>({
    fromCache: false,
    cachedAt: null,
  });

  const query = useAsyncQuery(
    async () => {
      const result = await loadPortalAppointmentDetailWithCache(
        appointmentId ?? '',
        profileId,
        roleKey,
        tenantId,
        employeeId,
      );
      setCacheMeta({ fromCache: result.fromCache, cachedAt: result.cachedAt });
      return result;
    },
    [appointmentId, profileId, roleKey, tenantId, employeeId],
    {
      enabled: !!appointmentId && isReady && !!profileId && !!roleKey,
      live:
        tenantId && employeeId
          ? {
              tenantId,
              subscribe: (tid, handler) => subscribeToEmployeePortalChanges(tid, employeeId, handler),
              pollMs: OPERATIONAL_LIVE_POLL_MS,
            }
          : undefined,
    },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data && !!appointmentId,
    isLiveConnected: query.isLiveConnected,
    fromCache: cacheMeta.fromCache,
    cachedAt: cacheMeta.cachedAt,
  };
}
