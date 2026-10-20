import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchKIMMessageDetail } from '@/lib/ti';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useKIMMessageDetail(messageId: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const displayName = profile?.displayName ?? 'System';

  return useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchKIMMessageDetail(tenantId, messageId, profile?.roleKey, displayName);
    },
    [tenantId, messageId, profile?.roleKey, displayName],
    { enabled: Boolean(messageId) && !!tenantId },
  );
}
