import { useMemo, useState } from 'react';
import type { RoleKey, ServiceResult } from '@/types';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

export type ServiceListSearchKey<T> = keyof T | ((item: T) => string);

export function useServiceListQuery<T>(
  queryFn: (tenantId: string, roleKey?: RoleKey | null) => Promise<ServiceResult<T[]>>,
  searchKeys: ServiceListSearchKey<T>[],
) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [search, setSearch] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return queryFn(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) =>
      searchKeys.some((key) => {
        const value = typeof key === 'function' ? key(item) : String(item[key as keyof T] ?? '');
        return value.toLowerCase().includes(q);
      }),
    );
  }, [allItems, search, searchKeys]);

  return {
    allItems,
    items,
    search,
    setSearch,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh: query.refresh,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty: !query.loading && !query.error && items.length === 0 && search.trim().length > 0,
  };
}
