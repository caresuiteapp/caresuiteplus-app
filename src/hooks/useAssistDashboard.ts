import { useCallback, useState } from 'react';
import type { AssignmentListItem } from '@/types/modules/assist';
import {
  EMPTY_ASSIST_DASHBOARD_STATS,
  fetchAssistDashboardBundle,
} from '@/lib/assist/assistDashboardService';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { subscribeToAssistOperationsChanges } from '@/lib/realtime';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery } from './core';

const assistOpsLive = (tenantId: string | null | undefined) =>
  tenantId
    ? {
        tenantId,
        subscribe: subscribeToAssistOperationsChanges,
        pollMs: OPERATIONAL_LIVE_POLL_MS,
      }
    : undefined;

export function useAssistDashboard(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const { profile, authReady } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);
  const queryEnabled = enabled && authReady && !!tenantId;

  const bundleQuery = useAsyncQuery(
    () => {
      if (!tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return withServiceQueryTimeout(
        fetchAssistDashboardBundle(tenantId, profile?.roleKey),
        'Assist-Dashboard',
      );
    },
    [tenantId, profile?.roleKey],
    { enabled: queryEnabled, live: assistOpsLive(tenantId) },
  );

  const refresh = useCallback(async () => {
    await bundleQuery.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [bundleQuery]);

  const stats = bundleQuery.data?.stats ?? null;
  const todayAssignments = (bundleQuery.data?.todayAssignments ?? []) as AssignmentListItem[];
  const authPending = !authReady;
  const tenantMissing = authReady && !tenantId;

  return {
    stats,
    todayAssignments,
    loading: authPending || (queryEnabled && bundleQuery.loading && !bundleQuery.data),
    error: tenantMissing
      ? 'Kein Mandant am Profil hinterlegt. Bitte Administrator kontaktieren.'
      : bundleQuery.error,
    isPreviewData: bundleQuery.previewData,
    refreshing: bundleQuery.refreshing,
    showSuccess,
    refresh,
    isLiveConnected: bundleQuery.isLiveConnected,
    emptyStats: stats ?? EMPTY_ASSIST_DASHBOARD_STATS,
  };
}
