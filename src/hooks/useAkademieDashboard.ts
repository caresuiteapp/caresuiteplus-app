import { useCallback, useState } from 'react';
import type { CourseListItem } from '@/types/modules/akademie';
import { fetchAkademieDashboardStats, fetchUpcomingCourses } from '@/lib/akademie';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useAkademieDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const statsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAkademieDashboardStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const upcomingQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchUpcomingCourses(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([statsQuery.refresh(), upcomingQuery.refresh()]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [statsQuery, upcomingQuery]);

  return {
    stats: statsQuery.data,
    upcomingCourses: (upcomingQuery.data ?? []) as CourseListItem[],
    loading: statsQuery.loading || upcomingQuery.loading,
    error: statsQuery.error ?? upcomingQuery.error,
    isPreviewData: statsQuery.previewData || upcomingQuery.previewData,
    tableMissing: statsQuery.tableMissing || upcomingQuery.tableMissing,
    refreshing: statsQuery.refreshing || upcomingQuery.refreshing,
    showSuccess,
    refresh,
  };
}
