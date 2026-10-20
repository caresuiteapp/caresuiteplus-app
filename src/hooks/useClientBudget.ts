import { useCallback } from 'react';
import { fetchClientBudgets } from '@/lib/clients';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useClientBudget(clientId: string | undefined) {
  const tenantId = useServiceTenantId();
  const query = useAsyncQuery(
    () => {
      if (!clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientBudgets(tenantId, clientId);
    },
    [clientId, tenantId],
    { enabled: Boolean(clientId) && !!tenantId },
  );
  return { ...query, refresh: useCallback(() => query.refresh(), [query]) };
}
