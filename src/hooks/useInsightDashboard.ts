import { useCallback, useState } from 'react';
import type { InsightSnapshotItem } from '@/types/modules/insight';
import { fetchInsightDashboardStats, fetchInsightSnapshots } from '@/lib/insight';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useInsightDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const statsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInsightDashboardStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const snapshotsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInsightSnapshots(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([statsQuery.refresh(), snapshotsQuery.refresh()]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [statsQuery, snapshotsQuery]);

  return {
    stats: statsQuery.data,
    snapshots: (snapshotsQuery.data ?? []) as InsightSnapshotItem[],
    loading: statsQuery.loading || snapshotsQuery.loading,
    error: statsQuery.error ?? snapshotsQuery.error,
    showSuccess,
    refresh,
  };
}
