import { useCallback } from 'react';
import { fetchClientTimeline } from '@/lib/clients';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useClientTimeline(clientId: string | undefined, portalOnly = false) {
  const tenantId = useServiceTenantId();
  const query = useAsyncQuery(
    () => {
      if (!clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientTimeline(tenantId, clientId, { portalOnly });
    },
    [clientId, tenantId, portalOnly],
    { enabled: Boolean(clientId) && !!tenantId },
  );
  return { ...query, refresh: useCallback(() => query.refresh(), [query]) };
}
