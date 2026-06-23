import { useCallback, useEffect, useState } from 'react';
import { fetchAssistLiveStatusOverview } from '@/lib/assist/assistLiveTrackingViewService';
import type { AssistLiveStatusOverview } from '@/lib/assist/assistLiveTrackingViewService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { subscribeToAssistLiveTrackingChanges } from '@/lib/realtime';
import { useAsyncQuery } from './core';

export function useAssistLiveStatus() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = subscribeToAssistLiveTrackingChanges(tenantId, () => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, [tenantId]);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      void tick;
      return fetchAssistLiveStatusOverview(tenantId, roleKey);
    },
    [tenantId, roleKey, tick],
    { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    overview: query.data as AssistLiveStatusOverview | undefined,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
