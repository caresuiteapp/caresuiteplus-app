import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listMessages } from '@/features/communication/communication.service';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useCommunicationMessages(threadId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!threadId) return Promise.resolve({ ok: false as const, error: 'Keine Thread-ID.' });
      return listMessages(tenantId, threadId, profile?.roleKey, profile?.id);
    },
    [tenantId, threadId, profile?.roleKey, profile?.id],
    { enabled: !!tenantId && !!threadId },
  );

  return {
    messages: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh: query.refresh,
    setMessages: query.setData,
  };
}
