import { useCallback, useEffect, useRef, useState } from 'react';
import type { PortalClientAppointmentDetail } from '@/types/portal/client';
import {
  fetchPortalClientAppointmentDetail,
  requestPortalAppointmentChange,
} from '@/lib/portal/appointmentService';
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
  const queryKey = JSON.stringify([tenantId, clientId, actorId, roleKey, appointmentId]);
  const generation = `${queryKey}:${tick}`;
  const current = useRef(generation);
  current.current = generation;
  const [basic, setBasic] = useState<{ key: string; data: PortalClientAppointmentDetail } | null>(null);
  const enabled = !!appointmentId && isLinkedReady && !!tenantId && !!clientId;

  useVisibilityAwarePolling({
    enabled,
    intervalMs: DEFAULT_LIVE_POLL_MS,
    onPoll: () => setTick((t) => t + 1),
  });

  useEffect(() => {
    if (!enabled || !tenantId || !clientId) return;
    const unsubscribe = subscribeToPortalAssistChanges(tenantId, clientId, () => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, [enabled, tenantId, clientId]);

  const query = useAsyncQuery(
    () =>
      fetchPortalClientAppointmentDetail(appointmentId ?? '', profileId, roleKey, {
        tenantId,
        clientId,
      }, (detail) => {
        if (current.current === generation) setBasic({ key: queryKey, data: detail });
      }),
    [appointmentId, profileId, roleKey, tenantId, clientId, tick],
    { enabled, queryKey },
  );

  const changeMutation = useMutation(
    (reason: string) =>
      requestPortalAppointmentChange(appointmentId ?? '', profileId, roleKey, reason, {
        tenantId,
        clientId,
      }),
    { successMessage: 'Änderungsanfrage gesendet.' },
  );

  const refresh = query.refresh;

  const requestChange = useCallback(
    async (reason: string) => {
      const result = await changeMutation.mutate(reason);
      if (result) await query.refresh();
      return result;
    },
    [changeMutation, query],
  );

  return {
    data: query.data ?? (basic?.key === queryKey ? basic.data : null),
    loading: isResolvingClientLink || (query.loading && basic?.key !== queryKey),
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
