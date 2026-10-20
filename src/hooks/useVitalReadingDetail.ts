import { useCallback } from 'react';
import { fetchVitalReadingDetail } from '@/lib/pflege/vitalDetailService';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useVitalReadingDetail(readingId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!readingId) {
        return Promise.resolve({
          ok: false as const,
          error: 'Keine Messungs-ID angegeben.',
        });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchVitalReadingDetail(readingId, tenantId, roleKey);
    },
    [readingId, tenantId, roleKey],
    { enabled: Boolean(readingId) && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data,
  };
}
