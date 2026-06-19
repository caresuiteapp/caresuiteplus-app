import { useCallback, useEffect, useRef } from 'react';
import { subscribeToPortalAssistChanges } from '@/lib/realtime';

/** Live refresh for Assist portal dashboard, sidebar KPIs and modals. */
export function usePortalAssistRealtime(
  tenantId: string | null | undefined,
  clientId: string | null | undefined,
  onRefresh: () => void,
): { isConnected: boolean } {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const stableRefresh = useCallback(() => {
    onRefreshRef.current();
  }, []);

  useEffect(() => {
    if (!tenantId || !clientId) return;
    const unsubscribe = subscribeToPortalAssistChanges(tenantId, clientId, stableRefresh);
    return unsubscribe;
  }, [tenantId, clientId, stableRefresh]);

  return { isConnected: Boolean(tenantId && clientId) };
}
