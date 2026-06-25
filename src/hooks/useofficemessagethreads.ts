import { useCallback, useEffect } from 'react';
import type {
  OfficeChatAgeFilter,
  OfficeMessageAudience,
} from '@/types/office/messaging';
import { fetchOfficeMessageThreadsBySegment } from '@/lib/office/messagethreadservice';
import { subscribeToOfficeMessageInbox } from '@/lib/office/officemessagerealtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useOfficeMessageThreads(
  audience: OfficeMessageAudience = 'employees',
  chatAge: OfficeChatAgeFilter = 'new',
) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeMessageThreadsBySegment(tenantId, profile?.roleKey, { audience, chatAge });
    },
    [tenantId, profile?.roleKey, profile?.id, audience, chatAge],
    { enabled: true },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = subscribeToOfficeMessageInbox(tenantId, () => {
      void refresh();
    });
    return unsubscribe;
  }, [tenantId, refresh]);

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
