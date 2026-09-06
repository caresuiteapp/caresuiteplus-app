import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { readClientAppointmentCache, writeClientAppointmentCache } from '@/lib/offline/clientAppointmentCache';
import { offlineCacheEpoch } from '@/lib/offline/idb';
import type { PortalClientAppointmentDetail } from '@/types/portal/client';
import {
  fetchPortalClientAppointmentDetail,
  requestPortalAppointmentChange,
} from '@/lib/portal/appointmentService';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToPortalAssistChanges } from '@/lib/realtime';
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
  const queryKey = JSON.stringify([tenantId, clientId, actorId, roleKey, appointmentId]);
  const current = useRef<string | null>(queryKey);
  current.current = queryKey;
  useEffect(() => { current.current = queryKey; return () => { current.current = null; }; }, [queryKey]);
  const publishBasic = useRef<(detail: PortalClientAppointmentDetail) => void>(() => {});
  const enabled = !!appointmentId && isLinkedReady && !!tenantId && !!clientId;
  const scope = { tenantId: tenantId ?? '', accountId: profileId, clientId: clientId ?? '', roleKey };
  const live = useMemo(() => tenantId && clientId ? {
    tenantId,
    subscribe: (tid: string, handler: () => void) => subscribeToPortalAssistChanges(tid, clientId, handler),
    pollMs: DEFAULT_LIVE_POLL_MS,
  } : undefined, [tenantId, clientId]);
  const query = useAsyncQuery(
    async () => {
      const epoch = offlineCacheEpoch();
      const result = await fetchPortalClientAppointmentDetail(appointmentId ?? '', profileId, roleKey, { tenantId, clientId }, (detail) => {
        if (current.current !== queryKey || offlineCacheEpoch() !== epoch) return;
        publishBasic.current(detail);
        void writeClientAppointmentCache(scope, detail, epoch);
      });
      if (result.ok && current.current === queryKey && offlineCacheEpoch() === epoch) {
        void writeClientAppointmentCache(scope, result.data, epoch);
      }
      return result;
    },
    [appointmentId, profileId, roleKey, tenantId, clientId],
    { enabled, queryKey, live,
      initialCache: Platform.OS !== 'web' && enabled ? () => readClientAppointmentCache(scope, appointmentId!) : undefined,
    },
  );
  publishBasic.current = detail => query.setData(detail, { fromCache: false, cachedAt: null });

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
      if (result) await refresh();
      return result;
    },
    [changeMutation, refresh],
  );

  return {
    data: query.data,
    fromCache: query.cacheMeta.fromCache,
    cachedAt: query.cacheMeta.cachedAt,
    refreshError: query.refreshError,
    loading: isResolvingClientLink || (query.loading && !query.data),
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
