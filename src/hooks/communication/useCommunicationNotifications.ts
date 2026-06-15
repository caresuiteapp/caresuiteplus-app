import { useServiceTenantId } from '@/hooks/useTenantId';
import { listUnreadCommunicationNotifications } from '@/features/communication/communication.notifications';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useCommunicationNotifications() {
  const tenantId = useServiceTenantId();
  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listUnreadCommunicationNotifications(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  return {
    notifications: query.data ?? [],
    unreadCount: (query.data ?? []).length,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
  };
}
