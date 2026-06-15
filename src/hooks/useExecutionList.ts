import { useCallback, useState } from 'react';
import type { ActiveExecutionItem, ExecutionPhase } from '@/types/modules/assist';
import type { ListSortOption } from '@/types/list';
import { fetchExecutionList } from '@/lib/assist/executionListService';
import { EXECUTION_PHASE_LABELS } from '@/data/demo/executionListStats';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery, useListState } from './core';

export const EXECUTION_PHASE_FILTERS: { key: ExecutionPhase | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'pending', label: EXECUTION_PHASE_LABELS.pending },
  { key: 'checked_in', label: EXECUTION_PHASE_LABELS.checked_in },
  { key: 'in_progress', label: EXECUTION_PHASE_LABELS.in_progress },
  { key: 'completed', label: EXECUTION_PHASE_LABELS.completed },
];

export const EXECUTION_SORT_OPTIONS: ListSortOption<'scheduledStart' | 'clientName'>[] = [
  {
    key: 'time_asc',
    label: 'Zeit aufsteigend',
    field: 'scheduledStart',
    direction: 'asc',
  },
  {
    key: 'time_desc',
    label: 'Zeit absteigend',
    field: 'scheduledStart',
    direction: 'desc',
  },
  {
    key: 'client_asc',
    label: 'Klient A–Z',
    field: 'clientName',
    direction: 'asc',
  },
];

const PAGE_SIZE = 8;

export function useExecutionList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchExecutionList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<ActiveExecutionItem, 'scheduledStart' | 'clientName'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['title', 'clientName', 'location'],
    statusField: 'phase',
    sortOptions: EXECUTION_SORT_OPTIONS,
    defaultSortKey: 'time_asc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    items: list.paginated.items,
    allItems,
    totalCount: allItems.length,
    filteredCount: list.filtered.length,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    search: list.search,
    setSearch: list.setSearch,
    phaseFilter: list.statusFilter as ExecutionPhase | 'all',
    setPhaseFilter: list.setStatusFilter as (v: ExecutionPhase | 'all') => void,
    sortKey: list.sortKey,
    setSortKey: list.setSortKey,
    sortOptions: EXECUTION_SORT_OPTIONS,
    phaseFilters: EXECUTION_PHASE_FILTERS,
    hasMore: list.paginated.hasMore,
    loadMore: list.loadMore,
    refresh,
    resetFilters: list.resetFilters,
    hasActiveFilters: list.hasActiveFilters,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty:
      !query.loading && !query.error && list.filtered.length === 0 && list.hasActiveFilters,
  };
}
