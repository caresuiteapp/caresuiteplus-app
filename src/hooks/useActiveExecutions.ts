import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchActiveExecutions } from '@/lib/assist';
import { subscribeToAssistOperationsChanges } from '@/lib/realtime';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery } from './core';

export function useActiveExecutions() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchActiveExecutions(tenantId, profile?.roleKey);
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
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    refresh,
    isLiveConnected: query.isLiveConnected,
    isEmpty: !query.loading && !query.error && (query.data?.length ?? 0) === 0,
  };
}
