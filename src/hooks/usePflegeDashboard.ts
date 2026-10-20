import { useCallback, useState } from 'react';
import type { CarePlanListItem } from '@/types/modules/pflege';
import { fetchActiveCarePlans, fetchPflegeDashboardStats } from '@/lib/pflege';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function usePflegeDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const statsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchPflegeDashboardStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const activeQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchActiveCarePlans(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([statsQuery.refresh(), activeQuery.refresh()]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [statsQuery, activeQuery]);

  return {
    stats: statsQuery.data,
    activePlans: (activeQuery.data ?? []) as CarePlanListItem[],
    loading: statsQuery.loading || activeQuery.loading,
    error: statsQuery.error ?? activeQuery.error,
    isPreviewData: statsQuery.previewData || activeQuery.previewData,
    refreshing: statsQuery.refreshing || activeQuery.refreshing,
    showSuccess,
    refresh,
  };
}
