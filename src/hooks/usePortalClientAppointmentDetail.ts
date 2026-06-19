import { useCallback } from 'react';
import {
  fetchPortalClientAppointmentDetail,
  requestPortalAppointmentChange,
} from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery, useMutation } from './core';

export function usePortalClientAppointmentDetail(appointmentId: string | undefined) {
  const { tenantId, clientId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';

  const query = useAsyncQuery(
    () =>
      fetchPortalClientAppointmentDetail(appointmentId ?? '', profileId, roleKey, {
        tenantId,
        clientId,
      }),
    [appointmentId, profileId, roleKey, tenantId, clientId],
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
