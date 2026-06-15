import { fetchQmCompliance, fetchQmLegalReferences } from '@/lib/qm';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useQmCompliance() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const compliance = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmCompliance(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const legal = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmLegalReferences(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  return {
    compliance: compliance.data ?? [],
    legalReferences: legal.data ?? [],
    loading: compliance.loading || legal.loading,
    error: compliance.error ?? legal.error,
    refresh: async () => {
      await Promise.all([compliance.refresh(), legal.refresh()]);
    },
  };
}
