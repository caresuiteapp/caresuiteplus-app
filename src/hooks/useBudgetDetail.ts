import { useCallback } from 'react';
import { fetchBudgetDetail } from '@/lib/office';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useBudgetDetail(budgetId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!budgetId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Budget-ID angegeben.' });
      }
      return fetchBudgetDetail(budgetId, tenantId, roleKey);
    },
    [tenantId, budgetId, roleKey],
    { enabled: Boolean(budgetId) && !!tenantId },
  );

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    notFound: !query.loading && !query.error && !query.data,
  };
}
