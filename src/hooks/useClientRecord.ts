import { useCallback, useEffect } from 'react';
import { fetchClientRecord } from '@/lib/clients/clientRecordService';
import { subscribeToClientRecordChanges } from '@/lib/realtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useClientRecord(clientId: string | undefined) {
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return fetchClientRecord(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: Boolean(tenantId && clientId) },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  useEffect(() => {
    if (!tenantId || !clientId) return;
    const unsubscribe = subscribeToClientRecordChanges(tenantId, clientId, () => {
      void refresh();
    });
    return unsubscribe;
  }, [tenantId, clientId, refresh]);

  return {
    record: query.data,
    detail: query.data?.detail ?? null,
    careContexts: query.data?.careContexts ?? [],
    tabs: query.data?.tabs ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
