import { useCallback, useState } from 'react';
import type { ResidentListItem } from '@/types/modules/stationaer';
import { fetchActiveResidents, fetchStationaerDashboardStats } from '@/lib/stationaer';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useStationaerDashboard(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const statsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchStationaerDashboardStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: enabled && !!tenantId },
  );

  const activeQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchActiveResidents(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: enabled && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([statsQuery.refresh(), activeQuery.refresh()]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [statsQuery, activeQuery]);

  return {
    stats: statsQuery.data,
    activeResidents: (activeQuery.data ?? []) as ResidentListItem[],
    loading: statsQuery.loading || activeQuery.loading,
    error: statsQuery.error ?? activeQuery.error,
    isPreviewData: statsQuery.previewData || activeQuery.previewData,
    tableMissing: statsQuery.tableMissing || activeQuery.tableMissing,
    refreshing: statsQuery.refreshing || activeQuery.refreshing,
    showSuccess,
    refresh,
  };
}
