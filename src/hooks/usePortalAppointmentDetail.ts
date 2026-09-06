import { useMemo } from 'react';
import { Platform } from 'react-native';
import { loadPortalAppointmentDetailWithCache } from '@/lib/offline/assignmentCacheService';
import { useConnectivity } from '@/hooks/useConnectivity';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery } from './core';

export function usePortalAppointmentDetail(appointmentId: string | undefined) {
  const { tenantId, employeeId, actorId, roleKey, isReady } = usePortalActor();
  const { isOffline } = useConnectivity();
  const profileId = actorId ?? '';

  const live = useMemo(() => tenantId && employeeId ? {
    tenantId, subscribe: (tid: string, handler: () => void) => subscribeToEmployeePortalChanges(tid, employeeId, handler),
    pollMs: OPERATIONAL_LIVE_POLL_MS,
  } : undefined, [tenantId, employeeId]);
  const query = useAsyncQuery(
    async () => {
      const result = await loadPortalAppointmentDetailWithCache(
        appointmentId ?? '',
        profileId,
        roleKey,
        tenantId,
        employeeId,
        { preferCache: isOffline },
      );
      return result;
    },
    [appointmentId, profileId, roleKey, tenantId, employeeId, isOffline],
    {
      enabled: !!appointmentId && isReady && !!profileId && !!roleKey,
      queryKey: JSON.stringify([tenantId, employeeId, roleKey, profileId, appointmentId]),
      initialCache:
        Platform.OS !== 'web' && appointmentId && tenantId && employeeId
          ? async () => {
              const cached = await loadPortalAppointmentDetailWithCache(
                appointmentId,
                profileId,
                roleKey,
                tenantId,
                employeeId,
                { preferCache: true },
              );
              if (cached.ok && cached.fromCache) {
                return cached;
              }
              return null;
            }
          : undefined,
      live,
    },
  );
  const cacheMeta = query.cacheMeta;

  const refresh = query.refresh;

  return {
    data: query.data,
    loading: query.loading && !query.data,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data && !!appointmentId,
    isLiveConnected: query.isLiveConnected,
    fromCache: cacheMeta.fromCache,
    cachedAt: cacheMeta.cachedAt,
    partialDetail: cacheMeta.partialDetail ?? false,
    cacheSource: cacheMeta.cacheSource ?? 'live',
  };
}
