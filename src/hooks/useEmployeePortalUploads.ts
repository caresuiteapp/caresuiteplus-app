import { useCallback } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { listEmployeePortalUploads } from '@/lib/portal/employeePortalUploadService';

export function useEmployeePortalUploads() {
  const { tenantId, employeeId, isLinkedReady, isResolvingEmployeeLink } = usePortalActor();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return listEmployeePortalUploads(tenantId, employeeId);
    },
    [tenantId, employeeId],
    { enabled: isLinkedReady && !!tenantId && !!employeeId, queryKey: JSON.stringify([tenantId, employeeId]) },
  );

  const refresh = useCallback(async () => {
    return query.refreshWithResult();
  }, [query]);

  return {
    uploads: query.data ?? [],
    loading: isResolvingEmployeeLink || query.loading,
    error: !isResolvingEmployeeLink && !employeeId ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden.' : query.error ?? query.refreshError,
    refresh,
  };
}
