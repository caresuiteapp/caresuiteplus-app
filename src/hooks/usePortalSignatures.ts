import { useCallback } from 'react';
import type { PortalSignatureFilterTab } from '@/types/portal/documentSignatures';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchPortalSignatureDocuments } from '@/lib/portal/portalDocumentSignatureService';

export function usePortalSignatures(tab: PortalSignatureFilterTab = 'open') {
  const actor = usePortalActor();
  const tenantId = useServiceTenantId();
  const employeeId = actor.employeeId ?? '';

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mitarbeiterprofil.' });
      }
      return fetchPortalSignatureDocuments(
        tenantId,
        employeeId,
        actor.roleKey,
        tab,
      );
    },
    [tenantId, employeeId, actor.roleKey, tab],
    { enabled: actor.isLinkedReady && !!tenantId && !!employeeId,
      queryKey: JSON.stringify([tenantId, employeeId, actor.roleKey, tab]) },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    items: query.data ?? [],
    loading: actor.isResolvingEmployeeLink || query.loading,
    error: !actor.isResolvingEmployeeLink && !employeeId ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.' : query.error ?? query.refreshError,
    refreshing: query.refreshing,
    refresh,
  };
}
