import { useCallback, useMemo, useState } from 'react';
import type { WorkflowStatus } from '@/types';
import type { CareRecordListItem } from '@/types/modules/assist';
import { fetchCareRecordList } from '@/lib/assist';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery, useListState } from './core';

const PAGE_SIZE = 8;

const SORT_OPTIONS = [
  { key: 'date_desc', label: 'Neueste zuerst', field: 'recordedAt' as const, direction: 'desc' as const },
  { key: 'date_asc', label: 'Älteste zuerst', field: 'recordedAt' as const, direction: 'asc' as const },
];

export function useCareRecordList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCareRecordList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<CareRecordListItem, 'recordedAt'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['content', 'assignmentTitle', 'clientName', 'employeeName'],
    statusField: 'status',
    sortOptions: SORT_OPTIONS,
    defaultSortKey: 'date_desc',
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
      statusFilter: list.statusFilter as WorkflowStatus | 'all',
      setStatusFilter: list.setStatusFilter as (v: WorkflowStatus | 'all') => void,
      sortKey: list.sortKey,
      setSortKey: list.setSortKey,
      sortOptions: SORT_OPTIONS,
      hasMore: list.paginated.hasMore,
      loadMore: list.loadMore,
      refresh,
      isEmpty: !query.loading && allItems.length === 0,
    }),
    [allItems, list, query, refresh, showSuccess],
  );
}
