import { listTenantPortalRequests } from '@/lib/portal/assist';
import { useAsyncQuery } from './core';
import { useVisibilityAwarePolling } from '@/lib/polling/useVisibilityAwarePolling';

export function useTenantPortalRequests(tenantId: string | null, enabled = true, clientId?: string) {
  const active = enabled && Boolean(tenantId);
  const query = useAsyncQuery(
    () => listTenantPortalRequests(tenantId!, { clientId }),
    [tenantId, clientId],
    { enabled: active, queryKey: `portal-requests:${tenantId}:${clientId ?? 'all'}`, refreshOnAppFocus: true },
  );
  useVisibilityAwarePolling({ enabled: active, intervalMs: 12_000, onPoll: () => { void query.refresh(); } });
  return { requests: active ? query.data ?? [] : [], loading: active && query.loading,
    error: query.error ?? query.refreshError, refresh: query.refresh };
}
