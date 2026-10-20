import { useMemo } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { fetchEmployeePersonnelFile } from '@/lib/office/employeePersonnelFileService';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function useEmployeePersonnelFile(employeeId: string | undefined) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      }
      return fetchEmployeePersonnelFile(tenantId, employeeId, profile?.roleKey, {
        userId: profile?.id,
      });
    },
    [tenantId, employeeId, profile?.roleKey, profile?.id],
    { enabled: !!tenantId && !!employeeId },
  );

  return useMemo(
    () => ({
      file: query.data ?? null,
      loading: query.loading,
      error: query.error,
      refresh: query.refresh,
    }),
    [query.data, query.loading, query.error, query.refresh],
  );
}
