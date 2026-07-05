import { useCallback } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  fetchEmployeePortalClientRecordDetail,
  fetchEmployeePortalClientRecords,
} from '@/lib/portal/employeePortalClientRecordsService';

export function useEmployeePortalClientRecords() {
  const { tenantId, employeeId, isReady } = usePortalActor();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return fetchEmployeePortalClientRecords(tenantId, employeeId);
    },
    [tenantId, employeeId],
    { enabled: isReady && !!tenantId && !!employeeId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    records: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
  };
}

export function useEmployeePortalClientRecordDetail(clientId: string | undefined) {
  const { tenantId, employeeId, isReady } = usePortalActor();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId || !clientId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return fetchEmployeePortalClientRecordDetail(tenantId, employeeId, clientId);
    },
    [tenantId, employeeId, clientId],
    { enabled: isReady && !!tenantId && !!employeeId && !!clientId },
  );

  return {
    record: query.data ?? null,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    notFound: !query.loading && !query.error && !query.data && !!clientId,
  };
}
