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
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

export function usePortalClientAppointmentDetail(appointmentId: string | undefined) {
  const {
    tenantId,
    clientId,
    actorId,
    roleKey,
    isLinkedReady,
    isResolvingClientLink,
  } = usePortalActor();
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
    { enabled: !!appointmentId && isLinkedReady && !!tenantId && !!clientId },
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
    loading: isResolvingClientLink || query.loading,
    error:
      !isResolvingClientLink && !clientId
        ? 'Ihr Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
        : query.error
          ? toPortalUserFacingError(
              query.error,
              'Der Einsatz konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
            )
          : null,
    refresh,
    requestChange,
    changeLoading: changeMutation.loading,
    changeError: changeMutation.error
      ? toPortalUserFacingError(
          changeMutation.error,
          'Ihr Änderungswunsch konnte gerade nicht gesendet werden. Bitte versuchen Sie es erneut.',
        )
      : null,
    successMessage: changeMutation.successMessage,
    notFound:
      isLinkedReady &&
      !query.loading &&
      !query.error &&
      !query.data &&
      !!appointmentId,
  };
}
