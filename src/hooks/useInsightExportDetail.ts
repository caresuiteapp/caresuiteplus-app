import { useCallback } from 'react';
import { fetchInsightExportDetail } from '@/lib/insight';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useInsightExportDetail(exportId: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInsightExportDetail(tenantId, exportId, profile?.roleKey);
    },
    [tenantId, exportId, profile?.roleKey],
    { enabled: !!tenantId && !!exportId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    exportItem: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
