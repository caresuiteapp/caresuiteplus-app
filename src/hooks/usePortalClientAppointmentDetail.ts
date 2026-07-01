import { useCallback, useEffect, useState } from 'react';
import {
  fetchPortalClientAppointmentDetail,
  requestPortalAppointmentChange,
} from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToPortalAssistChanges } from '@/lib/realtime';
import { useVisibilityAwarePolling } from '@/lib/polling/useVisibilityAwarePolling';
import { DEFAULT_LIVE_POLL_MS } from './core';
import { useAsyncQuery, useMutation } from './core';

export function usePortalClientAppointmentDetail(appointmentId: string | undefined) {
  const { tenantId, clientId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';
  const [tick, setTick] = useState(0);

  useVisibilityAwarePolling({
    enabled: Boolean(tenantId && clientId),
    intervalMs: DEFAULT_LIVE_POLL_MS,
    onPoll: () => setTick((t) => t + 1),
  });

  useEffect(() => {
    if (!tenantId || !clientId) return;
    const unsubscribe = subscribeToPortalAssistChanges(tenantId, clientId, () => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, [tenantId, clientId]);

  const query = useAsyncQuery(
    () =>
      fetchPortalClientAppointmentDetail(appointmentId ?? '', profileId, roleKey, {
        tenantId,
        clientId,
      }),
    [appointmentId, profileId, roleKey, tenantId, clientId, tick],
    { enabled: !!appointmentId && isReady },
  );

  const changeMutation = useMutation(
    (reason: string) =>
      requestPortalAppointmentChange(appointmentId ?? '', profileId, roleKey, reason, {
        tenantId,
        clientId,
      }),
    { successMessage: 'Änderungsanfrage gesendet.' },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  const requestChange = useCallback(
    async (reason: string) => {
      const result = await changeMutation.mutate(reason);
      if (result) await query.refresh();
      return result;
    },
    [changeMutation, query],
  );

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    requestChange,
    changeLoading: changeMutation.loading,
    changeError: changeMutation.error,
    successMessage: changeMutation.successMessage,
    notFound: !query.loading && !query.error && !query.data && !!appointmentId,
  };
}
