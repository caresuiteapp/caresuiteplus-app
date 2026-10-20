import { useCallback } from 'react';
import { fetchFollowUpDetail } from '@/lib/beratung/moduleExtensionService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useFollowUpDetail(followUpId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !followUpId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return fetchFollowUpDetail(tenantId, followUpId, profile?.roleKey);
    },
    [tenantId, followUpId, profile?.roleKey],
    { enabled: !!tenantId && !!followUpId },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data && !!followUpId,
  };
}
