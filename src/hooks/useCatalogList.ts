import { useCallback } from 'react';
import { fetchCatalogList } from '@/lib/catalog';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useCatalogList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCatalogList(tenantId, roleKey);
    },
    [tenantId, roleKey],
  { enabled: !!tenantId },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
    isEmpty: !query.loading && !query.error && (query.data?.length ?? 0) === 0,
  };
}
