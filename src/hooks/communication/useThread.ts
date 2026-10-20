import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getThread } from '@/features/communication/communication.service';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useThread(threadId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!threadId) return Promise.resolve({ ok: false as const, error: 'Keine Thread-ID.' });
      return getThread(tenantId, threadId, profile?.roleKey, profile?.id);
    },
    [tenantId, threadId, profile?.roleKey, profile?.id],
    { enabled: !!tenantId && !!threadId },
  );

  return {
    thread: query.data,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh: query.refresh,
    notFound: !query.loading && !query.error && !query.data,
  };
}
