import { useCallback } from 'react';
import { fetchPortalAppointmentDetail } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery } from './core';

export function usePortalAppointmentDetail(appointmentId: string | undefined) {
  const { tenantId, employeeId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';

  const query = useAsyncQuery(
    () =>
      fetchPortalAppointmentDetail(appointmentId ?? '', profileId, roleKey, {
        tenantId,
        employeeId,
      }),
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
  };
}
