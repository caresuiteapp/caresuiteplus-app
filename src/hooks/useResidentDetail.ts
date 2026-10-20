import { useCallback } from 'react';
import { fetchResidentDetail } from '@/lib/stationaer';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useResidentDetail(residentId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!residentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Bewohner-ID angegeben.' });
      }
      return fetchResidentDetail(residentId, tenantId, roleKey);
    },
    [tenantId, residentId, roleKey],
    { enabled: Boolean(residentId) && !!tenantId },
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
