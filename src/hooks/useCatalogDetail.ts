import { useCallback } from 'react';
import { fetchCatalogDetail, fetchCatalogItems } from '@/lib/catalog';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useCatalogDetail(catalogId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const detailQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCatalogDetail(catalogId ?? '', tenantId, roleKey);
    },
    [tenantId, catalogId, roleKey],
    { enabled: !!catalogId && !!tenantId },
  );

  const itemsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCatalogItems(catalogId ?? '', tenantId, roleKey);
    },
    [tenantId, catalogId, roleKey],
    { enabled: !!catalogId && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([detailQuery.refresh(), itemsQuery.refresh()]);
  }, [detailQuery, itemsQuery]);

  return {
    catalog: detailQuery.data,
    items: itemsQuery.data ?? [],
    loading: detailQuery.loading || itemsQuery.loading,
    error: detailQuery.error ?? itemsQuery.error,
    refresh,
    notFound: !detailQuery.loading && !detailQuery.error && !detailQuery.data && !!catalogId,
  };
}
