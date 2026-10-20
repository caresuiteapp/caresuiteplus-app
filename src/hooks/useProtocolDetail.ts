import { useCallback } from 'react';
import { fetchProtocolDetail } from '@/lib/beratung/moduleExtensionService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useProtocolDetail(protocolId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !protocolId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return fetchProtocolDetail(tenantId, protocolId, profile?.roleKey);
    },
    [tenantId, protocolId, profile?.roleKey],
    { enabled: !!tenantId && !!protocolId },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data && !!protocolId,
  };
}
