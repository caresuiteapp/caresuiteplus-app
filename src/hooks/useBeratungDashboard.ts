import { useCallback, useState } from 'react';
import type { CounselingListItem } from '@/types/modules/beratung';
import { fetchBeratungDashboardStats, fetchRecentCounselingCases } from '@/lib/beratung';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useBeratungDashboard(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const statsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchBeratungDashboardStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: enabled && !!tenantId },
  );

  const recentQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchRecentCounselingCases(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: enabled && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([statsQuery.refresh(), recentQuery.refresh()]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [statsQuery, recentQuery]);

  return {
    stats: statsQuery.data,
    recentCases: (recentQuery.data ?? []) as CounselingListItem[],
    loading: statsQuery.loading || recentQuery.loading,
    error: statsQuery.error ?? recentQuery.error,
    isPreviewData: statsQuery.previewData || recentQuery.previewData,
    refreshing: statsQuery.refreshing || recentQuery.refreshing,
    showSuccess,
    refresh,
  };
}
