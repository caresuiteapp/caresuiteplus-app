import { sharedPortalRead } from '@/lib/portal/sharedPortalRead';
import { useEffect } from 'react';
import type { PortalOfficeInboxFilter } from '@/lib/office/portalofficemessageservice';
import {
  fetchPortalOfficeThreads,
  resolvePortalActor,
} from '@/lib/office/portalofficemessageservice';
import { subscribeToOfficeMessageInbox } from '@/lib/office/officemessagerealtime';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from './core';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

export function usePortalOfficeMessages(
  filter: PortalOfficeInboxFilter = 'open',
  enabled = true,
) {
  const { portalSession } = useAuth();
  const {
    tenantId,
    clientId,
    employeeId,
    actorId,
    roleKey,
    displayName,
    isLinkedReady,
  } = usePortalActor();
  const portalAccountId = portalSession?.accountId ?? null;
  const portalClientId = portalSession?.clientId ?? null;
  const portalEmployeeId = portalSession?.employeeId ?? null;
  const portalRoleKey = portalSession?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      const actorResult = resolvePortalActor(
        roleKey,
        portalSession,
        actorId,
        displayName,
        { clientId, employeeId },
      );
      if (!actorResult.ok) return Promise.resolve(actorResult);
      return sharedPortalRead(JSON.stringify(['inbox', tenantId, portalAccountId, actorId, roleKey, clientId, employeeId, filter]),
        () => fetchPortalOfficeThreads(tenantId, actorResult.data, filter));
    },
    [
      tenantId,
      portalAccountId,
      portalClientId,
      portalEmployeeId,
      portalRoleKey,
      filter,
      roleKey,
      actorId,
      displayName,
      clientId,
      employeeId,
    ],
    { enabled: enabled && !!tenantId && isLinkedReady, queryKey: JSON.stringify([tenantId, portalAccountId, roleKey, clientId, employeeId, filter]) },
  );

  const refresh = query.refresh;

  useEffect(() => {
    if (!enabled || !tenantId) return;
    const unsubscribe = subscribeToOfficeMessageInbox(tenantId, () => {
      void refresh();
    });
    return unsubscribe;
  }, [enabled, tenantId, refresh]);

  return {
    threads: query.data ?? [],
    loading: query.loading,
    error: query.error
      ? toPortalUserFacingError(
          query.error,
          'Ihre Nachrichten konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
        )
      : null,
    refreshing: query.refreshing,
    refresh,
    isEmpty: !query.loading && !query.error && (query.data?.length ?? 0) === 0,
  };
}
