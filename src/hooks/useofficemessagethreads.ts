import { useCallback, useEffect } from 'react';
import type { OfficeInboxFilter } from '@/types/office/messaging';
import { fetchOfficeMessageThreads } from '@/lib/office/messagethreadservice';
import { subscribeToOfficeMessageInbox } from '@/lib/office/officemessagerealtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useOfficeMessageThreads(filter: OfficeInboxFilter = 'inbox') {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeMessageThreads(tenantId, profile?.roleKey, filter, profile?.id);
    },
    [tenantId, profile?.roleKey, profile?.id, filter],
    { enabled: !!tenantId },
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
    previewData: query.data !== undefined && query.previewData,
    refresh,
    isEmpty: !query.loading && !query.error && (query.data?.length ?? 0) === 0,
  };
}
