import { useCallback } from 'react';
import { fetchHandoverDetail } from '@/lib/stationaer/moduleExtensionService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useHandoverDetail(handoverId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!handoverId) return Promise.resolve({ ok: false as const, error: 'Keine Übergabe-ID angegeben.' });
      return fetchHandoverDetail(handoverId, tenantId, roleKey);
    },
    [tenantId, handoverId, roleKey],
    { enabled: Boolean(handoverId) && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data,
  };
}
