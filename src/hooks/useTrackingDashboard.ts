import { useCallback } from 'react';
import { fetchTrackingDashboard } from '@/lib/assist';
import { subscribeToAssistOperationsChanges } from '@/lib/realtime';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery } from './core';

export function useTrackingDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTrackingDashboard(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    {
      enabled: !!tenantId,
      live: tenantId
        ? {
            tenantId,
            subscribe: subscribeToAssistOperationsChanges,
            pollMs: OPERATIONAL_LIVE_POLL_MS,
          }
        : undefined,
    },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh,
    isLiveConnected: query.isLiveConnected,
  };
}
