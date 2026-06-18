import { useCallback, useEffect } from 'react';
import type { PortalOfficeInboxFilter } from '@/lib/office/portalofficemessageservice';
import {
  fetchPortalOfficeThreads,
  resolvePortalActor,
} from '@/lib/office/portalofficemessageservice';
import { subscribeToOfficeMessageInbox } from '@/lib/office/officemessagerealtime';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function usePortalOfficeMessages(filter: PortalOfficeInboxFilter = 'open') {
  const { profile, portalSession } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      const actorResult = resolvePortalActor(
        profile?.roleKey ?? portalSession?.roleKey ?? null,
        portalSession,
        profile?.id ?? portalSession?.accountId,
        profile?.displayName,
      );
      if (!actorResult.ok) return Promise.resolve(actorResult);
      return fetchPortalOfficeThreads(tenantId, actorResult.data, filter);
    },
    [tenantId, profile?.roleKey, profile?.id, profile?.displayName, portalSession, filter],
    { enabled: !!tenantId && !!(profile?.roleKey || portalSession?.roleKey) },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = subscribeToOfficeMessageInbox(tenantId, () => {
      void query.refresh();
    });
    return unsubscribe;
  }, [tenantId, query]);

  return {
    threads: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh,
    isEmpty: !query.loading && !query.error && (query.data?.length ?? 0) === 0,
  };
}
