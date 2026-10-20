import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { checkTIProviderConnection, fetchTIProviders } from '@/lib/ti';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useTIProviders() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTIProviders(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const runConnectionCheck = useCallback(
    async (providerId: string) => {
      if (!tenantId) return;
      setCheckingId(providerId);
      setCheckMessage(null);
      const result = await checkTIProviderConnection(
        tenantId,
        providerId,
        profile?.roleKey,
        profile?.displayName ?? 'System',
      );
      setCheckingId(null);
      if (result.ok) {
        setCheckMessage(result.data.message);
        await query.refresh();
      } else {
        setCheckMessage(result.error);
      }
    },
    [tenantId, profile?.roleKey, profile?.displayName, query],
  );

  return {
    providers: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    checkingId,
    checkMessage,
    runConnectionCheck,
  };
}
