import { useCallback } from 'react';
import { fetchCounselingCaseDetail } from '@/lib/beratung';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useCounselingCaseDetail(caseId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!caseId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Fall-ID angegeben.' });
      }
      return fetchCounselingCaseDetail(caseId, tenantId, roleKey);
    },
    [tenantId, caseId, roleKey],
    { enabled: Boolean(caseId) && !!tenantId },
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
