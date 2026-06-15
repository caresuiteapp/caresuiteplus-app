import { useCallback, useMemo, useState } from 'react';
import type { TripLogListItem } from '@/types/modules/assist';
import { fetchTripLogList } from '@/lib/assist';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery, useListState } from './core';

export function useTripLogList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTripLogList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<TripLogListItem, 'startedAt'>({
    items: allItems,
    pageSize: 10,
    searchFields: ['employeeName', 'vehicleLabel', 'routeSummary'],
    statusField: 'status',
    sortOptions: [
      { key: 'start_desc', label: 'Neueste Fahrt', field: 'startedAt', direction: 'desc' },
    ],
    defaultSortKey: 'start_desc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return useMemo(
    () => ({
      items: list.paginated.items,
      totalCount: allItems.length,
      filteredCount: list.filtered.length,
      loading: query.loading,
      error: query.error,
      refreshing: query.refreshing,
      showSuccess,
      search: list.search,
      setSearch: list.setSearch,
      refresh,
      isEmpty: !query.loading && allItems.length === 0,
    }),
    [allItems, list, query, refresh, showSuccess],
  );
}
