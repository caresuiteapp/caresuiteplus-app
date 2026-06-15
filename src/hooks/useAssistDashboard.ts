import { useCallback, useState } from 'react';
import type { AssignmentListItem } from '@/types/modules/assist';
import { fetchAssistDashboardStats, fetchTodayAssignments } from '@/lib/assist';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useAssistDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const statsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAssistDashboardStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const todayQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTodayAssignments(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([statsQuery.refresh(), todayQuery.refresh()]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [statsQuery, todayQuery]);

  return {
    stats: statsQuery.data,
    todayAssignments: (todayQuery.data ?? []) as AssignmentListItem[],
    loading: statsQuery.loading || todayQuery.loading,
    error: statsQuery.error ?? todayQuery.error,
    refreshing: statsQuery.refreshing || todayQuery.refreshing,
    showSuccess,
    refresh,
  };
}
