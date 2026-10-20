import { useServiceTenantId } from '@/hooks/useTenantId';
import { listAttachments } from '@/features/communication/communication.attachments';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useAttachments(threadId: string | undefined) {
  const tenantId = useServiceTenantId();
  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!threadId) return Promise.resolve({ ok: false as const, error: 'Keine Thread-ID.' });
      return listAttachments(tenantId, threadId);
    },
    [tenantId, threadId],
    { enabled: !!tenantId && !!threadId },
  );

  return {
    attachments: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
  };
}
