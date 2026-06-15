import { useCallback } from 'react';
import { fetchInsightSnapshotDetail } from '@/lib/insight';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useInsightSnapshotDetail(snapshotId: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInsightSnapshotDetail(tenantId, snapshotId, profile?.roleKey);
    },
    [tenantId, snapshotId, profile?.roleKey],
    { enabled: !!tenantId && !!snapshotId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    snapshot: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
