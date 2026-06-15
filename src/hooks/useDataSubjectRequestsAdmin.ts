import { useCallback, useMemo, useState } from 'react';
import {
  exportDataSubjectRequestsForAdmin,
  fetchDataSubjectRequestsForAdmin,
  updateDataSubjectRequestStatusForAdmin,
} from '@/lib/privacy/dataSubjectRequestAdminService';
import { countOverdueDataSubjectRequests } from '@/lib/privacy/dataSubjectRequestSla';
import { isDataSubjectRequestBackendReady } from '@/lib/privacy/dataRequestConfig';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { isDemoMode } from '@/lib/supabase/config';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import type { DataSubjectRequest, DataSubjectRequestStatus } from '@/lib/privacy/dataSubjectRequest.types';

export type DataSubjectRequestAdminKpi = {
  id: string;
  label: string;
  value: number;
  icon: string;
  accentColor: string;
};

export function buildDataSubjectRequestAdminKpis(
  items: DataSubjectRequest[],
): DataSubjectRequestAdminKpi[] {
  const openStatuses: DataSubjectRequestStatus[] = ['queued', 'running'];
  const openCount = items.filter((item) => openStatuses.includes(item.status)).length;
  const completedCount = items.filter((item) => item.status === 'completed').length;
  const overdueCount = countOverdueDataSubjectRequests(items);
  const deletionCount = items.filter((item) => item.requestType === 'deletion').length;

  return [
    {
      id: 'kpi-dsr-open',
      label: 'Offen',
      value: openCount,
      icon: '📋',
      accentColor: '#FF9500',
    },
    {
      id: 'kpi-dsr-overdue',
      label: 'Überfällig',
      value: overdueCount,
      icon: '⏰',
      accentColor: '#EF4444',
    },
    {
      id: 'kpi-dsr-completed',
      label: 'Abgeschlossen',
      value: completedCount,
      icon: '✅',
      accentColor: '#22C55E',
    },
    {
      id: 'kpi-dsr-deletion',
      label: 'Löschanfragen',
      value: deletionCount,
      icon: '🗑️',
      accentColor: '#EF4444',
    },
  ];
}

export function useDataSubjectRequestsAdmin() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId ?? (isDemoMode() ? DEMO_TENANT_ID : '');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const exportLiveReady = isDataSubjectRequestBackendReady();

  const query = useAsyncQuery(
    () =>
      tenantId
        ? fetchDataSubjectRequestsForAdmin(tenantId, profile?.roleKey)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant zugewiesen.' }),
    [tenantId, profile?.roleKey],
  );

  const items = query.data ?? [];
  const kpis = useMemo(() => buildDataSubjectRequestAdminKpis(items), [items]);

  const updateStatus = useCallback(
    async (requestId: string, status: DataSubjectRequestStatus) => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant zugewiesen.' };
      setUpdatingId(requestId);
      setUpdateError(null);
      const result = await updateDataSubjectRequestStatusForAdmin(
        tenantId,
        requestId,
        status,
        profile?.roleKey,
      );
      setUpdatingId(null);
      if (!result.ok) {
        setUpdateError(result.error);
        return result;
      }
      await query.refresh();
      return result;
    },
    [tenantId, profile?.roleKey, query],
  );

  const exportList = useCallback(async () => {
    if (!tenantId || !exportLiveReady) return { ok: false as const, error: 'Export nicht verfügbar.' };
    setExporting(true);
    setExportResult(null);
    const result = await exportDataSubjectRequestsForAdmin(tenantId, profile?.roleKey);
    setExporting(false);
    if (result.ok) {
      setExportResult(`${result.data.rowCount} Anfragen als CSV exportiert`);
    } else {
      setExportResult(result.error);
    }
    return result;
  }, [tenantId, profile?.roleKey, exportLiveReady]);

  return {
    items,
    kpis,
    totalCount: items.length,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh: query.refresh,
    isEmpty: !query.loading && !query.error && items.length === 0,
    updateStatus,
    updatingId,
    updateError,
    exportList,
    exporting,
    exportResult,
    exportLiveReady,
  };
}
