import { useCallback } from 'react';
import { fetchLivingAreaDetail } from '@/lib/stationaer/moduleExtensionService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useLivingAreaDetail(areaId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!areaId) return Promise.resolve({ ok: false as const, error: 'Keine Bereichs-ID angegeben.' });
      return fetchLivingAreaDetail(areaId, tenantId, roleKey);
    },
    [tenantId, areaId, roleKey],
    { enabled: Boolean(areaId) && !!tenantId },
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
