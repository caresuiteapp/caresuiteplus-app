import { fetchMdAccessLogs, fetchMdAuditPackage } from '@/lib/qm';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useMdAuditPackageDetail(packageId: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const detail = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchMdAuditPackage(tenantId, packageId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey, packageId],
    { enabled: !!tenantId && !!packageId },
  );

  const logs = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchMdAccessLogs(tenantId, packageId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey, packageId],
    { enabled: !!tenantId && !!packageId },
  );

  return {
    pkg: detail.data?.pkg,
    items: detail.data?.items ?? [],
    accessLogs: logs.data ?? [],
    loading: detail.loading || logs.loading,
    error: detail.error ?? logs.error,
    refresh: async () => {
      await Promise.all([detail.refresh(), logs.refresh()]);
    },
  };
}
