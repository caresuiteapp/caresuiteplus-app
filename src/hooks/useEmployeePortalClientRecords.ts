import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import {
  fetchEmployeePortalClientInsuranceNumber,
  fetchEmployeePortalClientRecordDetail,
  fetchEmployeePortalClientRecords,
} from '@/lib/portal/employeePortalClientRecordsService';

export function useEmployeePortalClientRecords() {
  const { tenantId, employeeId, actorId, roleKey, isReady, isResolvingEmployeeLink } = usePortalActor();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return fetchEmployeePortalClientRecords(tenantId, employeeId, { includeRecordFacts: true });
    },
    [tenantId, employeeId],
    { enabled: isReady && !!tenantId && !!employeeId && !isResolvingEmployeeLink,
      queryKey: JSON.stringify([tenantId, employeeId, actorId, roleKey]) },
  );

  return {
    records: query.data ?? [],
    loading: !isReady || Boolean(isResolvingEmployeeLink) || query.loading,
    error: isReady && !isResolvingEmployeeLink && !employeeId
      ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.' : query.error,
    refreshError: query.refreshError,
    refresh: query.refresh,
  };
}

export function useEmployeePortalClientInsuranceNumber(clientId: string) {
  const { tenantId, employeeId, actorId, roleKey, isReady, isResolvingEmployeeLink, employeeLinkReadOnly } = usePortalActor();
  const waitingForActor = !isReady || isResolvingEmployeeLink;
  const enabled = !waitingForActor && !employeeLinkReadOnly && Boolean(tenantId && employeeId);
  const query = useAsyncQuery(
    () => tenantId && employeeId
      ? fetchEmployeePortalClientInsuranceNumber(tenantId, employeeId, clientId)
      : Promise.resolve({ ok: false as const, error: 'Die Versichertennummer konnte nicht geladen werden.' }),
    [tenantId, employeeId, clientId],
    { enabled, queryKey: JSON.stringify([tenantId, employeeId, actorId, roleKey, clientId, enabled]), retryCount: 0 },
  );

  return {
    number: enabled ? query.data : null,
    loading: waitingForActor || (enabled && query.loading),
    error: !waitingForActor && (!enabled || Boolean(query.error || query.refreshError)),
    retry: query.refresh,
  };
}

export function useEmployeePortalClientRecordDetail(clientId: string | undefined) {
  const { tenantId, employeeId, actorId, roleKey, isReady, isResolvingEmployeeLink } = usePortalActor();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId || !clientId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return fetchEmployeePortalClientRecordDetail(tenantId, employeeId, clientId);
    },
    [tenantId, employeeId, clientId],
    { enabled: isReady && !!tenantId && !!employeeId && !!clientId && !isResolvingEmployeeLink,
      queryKey: JSON.stringify([tenantId, employeeId, actorId, roleKey, clientId]) },
  );

  return {
    record: query.data ?? null,
    loading: !isReady || Boolean(isResolvingEmployeeLink) || query.loading,
    error: isReady && !isResolvingEmployeeLink && !employeeId
      ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.' : query.error,
    refreshError: query.refreshError,
    refresh: query.refresh,
    notFound: !query.loading && !query.error && !query.data && !!clientId,
  };
}
