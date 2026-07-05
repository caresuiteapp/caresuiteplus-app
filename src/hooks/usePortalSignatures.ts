import { useCallback } from 'react';
import type { PortalSignatureFilterTab } from '@/types/portal/documentSignatures';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchPortalSignatureDocuments } from '@/lib/portal/portalDocumentSignatureService';

export function usePortalSignatures(tab: PortalSignatureFilterTab = 'open') {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const employeeId = profile?.employeeId ?? profile?.id ?? '';

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mitarbeiterprofil.' });
      }
      return fetchPortalSignatureDocuments(
        tenantId,
        employeeId,
        profile?.roleKey ?? null,
        tab,
      );
    },
    [tenantId, employeeId, profile?.roleKey, tab],
    { enabled: !!tenantId && !!employeeId },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh,
  };
}
