import { useCallback } from 'react';
import { fetchInsightDataSources } from '@/lib/insight/insightDashboardService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useInsightDataSources() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInsightDataSources(tenantId, roleKey);
    },
    [tenantId, roleKey],
    { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
