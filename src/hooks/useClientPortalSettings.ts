import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePortalActor } from '@/hooks/usePortalActor';
import { fetchClientPortalSettingsResolved } from '@/lib/client/clientPortalSettingsService';

/** Office release flags, scoped to the current client even during account changes. */
export function useClientPortalSettings(enabled = true) {
  const { tenantId, clientId, isLinkedReady, isResolvingClientLink } = usePortalActor();
  const queryKey = `client-portal-settings:${tenantId ?? ''}:${clientId ?? ''}`;
  const query = useAsyncQuery(
    () => fetchClientPortalSettingsResolved(tenantId!, clientId!),
    [tenantId, clientId],
    { enabled: enabled && isLinkedReady && !!tenantId && !!clientId, queryKey },
  );
  return {
    settings: query.error || query.refreshError ? null : query.data,
    loading: enabled && (isResolvingClientLink || query.loading),
    error: query.error ?? query.refreshError,
    refresh: query.refresh,
  };
}
