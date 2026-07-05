import { useCallback } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { listEmployeePortalUploads } from '@/lib/portal/employeePortalUploadService';

export function useEmployeePortalUploads() {
  const { tenantId, employeeId, isReady } = usePortalActor();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return listEmployeePortalUploads(tenantId, employeeId);
    },
    [tenantId, employeeId],
    { enabled: isReady && !!tenantId && !!employeeId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    uploads: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
