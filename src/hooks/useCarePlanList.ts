import { useCallback, useState } from 'react';
import type { CarePlanListItem } from '@/types/modules/pflege';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchCarePlanList } from '@/lib/pflege';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const CARE_PLAN_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'fehlerhaft', label: WORKFLOW_STATUS_LABELS.fehlerhaft },
  { key: 'gesperrt', label: WORKFLOW_STATUS_LABELS.gesperrt },
];

export const CARE_PLAN_SORT_OPTIONS: ListSortOption<'clientName' | 'validFrom'>[] = [
  {
    key: 'client_asc',
    label: 'Klient A–Z',
    field: 'clientName',
    direction: 'asc',
  },
  {
    key: 'client_desc',
    label: 'Klient Z–A',
    field: 'clientName',
    direction: 'desc',
  },
  {
    key: 'valid_desc',
    label: 'Gültig ab (neueste)',
    field: 'validFrom',
    direction: 'desc',
  },
  {
    key: 'valid_asc',
    label: 'Gültig ab (älteste)',
    field: 'validFrom',
    direction: 'asc',
  },
];

const PAGE_SIZE = 8;

export function useCarePlanList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCarePlanList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<CarePlanListItem, 'clientName' | 'validFrom'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['title', 'clientName'],
    statusField: 'status',
    sortOptions: CARE_PLAN_SORT_OPTIONS,
    defaultSortKey: 'client_asc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    allItems,
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
    sortOptions: CARE_PLAN_SORT_OPTIONS,
    statusFilters: CARE_PLAN_STATUS_FILTERS,
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
