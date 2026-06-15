import { useCallback } from 'react';
import { fetchReportDetail } from '@/lib/reporting';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core/useAsyncQuery';

/** WP508 — Hooks Berichtsdetail */
export function useReportDetail(reportId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!reportId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Berichts-ID angegeben.' });
      }
      if (!tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return fetchReportDetail(tenantId, reportId, profile?.roleKey);
    },
    [reportId, tenantId, profile?.roleKey],
    { enabled: Boolean(reportId) && Boolean(tenantId) },
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
