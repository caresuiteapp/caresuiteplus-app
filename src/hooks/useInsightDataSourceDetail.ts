import { useCallback } from 'react';
import { fetchInsightDataSourceDetail } from '@/lib/insight/insightDashboardService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useInsightDataSourceDetail(sourceId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!sourceId) return Promise.resolve({ ok: false as const, error: 'Keine Datenquellen-ID angegeben.' });
      return fetchInsightDataSourceDetail(tenantId, sourceId, roleKey);
    },
    [tenantId, sourceId, roleKey],
    { enabled: Boolean(sourceId) && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    source: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
