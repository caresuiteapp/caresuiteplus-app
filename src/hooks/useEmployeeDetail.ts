import { useCallback } from 'react';
import { fetchEmployeeDetail } from '@/lib/office';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useEmployeeDetail(employeeId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!employeeId) {
        return Promise.resolve({
          ok: false as const,
          error: 'Keine Mitarbeitenden-ID angegeben.',
        });
      }
      return fetchEmployeeDetail(employeeId, tenantId, roleKey);
    },
    [tenantId, employeeId, roleKey],
    { enabled: Boolean(employeeId) && !!tenantId },
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
