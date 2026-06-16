import { useCallback } from 'react';
import { fetchInventoryDashboard } from '@/lib/inventory';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useInventoryDashboard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => (tenantId ? fetchInventoryDashboard(tenantId, roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' })),
    [tenantId, roleKey],
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
