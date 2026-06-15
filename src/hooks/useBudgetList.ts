import { useCallback, useMemo, useState } from 'react';
import type { WorkflowStatus } from '@/types';
import type { BudgetListItem } from '@/types/modules/billing';
import type { ListSortOption } from '@/types/list';
import { fetchBudgetList } from '@/lib/office';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const BUDGET_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
];

const SORT_OPTIONS: ListSortOption<'label' | 'usagePercent'>[] = [
  { key: 'label_asc', label: 'Bezeichnung A–Z', field: 'label', direction: 'asc' },
  { key: 'usage_desc', label: 'Auslastung ↓', field: 'usagePercent', direction: 'desc' },
];

const PAGE_SIZE = 8;

export function useBudgetList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchBudgetList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<BudgetListItem, 'label' | 'usagePercent'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['label', 'clientName'],
    statusField: 'status',
    sortOptions: SORT_OPTIONS,
    defaultSortKey: 'label_asc',
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
      statusFilters: BUDGET_STATUS_FILTERS,
      hasMore: list.paginated.hasMore,
      loadMore: list.loadMore,
      resetFilters: list.resetFilters,
      hasActiveFilters: list.hasActiveFilters,
      refresh,
      isEmpty: !query.loading && !query.error && allItems.length === 0,
      isFilterEmpty:
        !query.loading && !query.error && list.filtered.length === 0 && list.hasActiveFilters,
    }),
    [allItems, list, query, refresh, showSuccess],
  );
}
