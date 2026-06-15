import { useCallback, useMemo, useState } from 'react';
import type { ClientListItem } from '@/types/modules/office';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchClientList } from '@/lib/office';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  CLIENT_CARE_LEVEL_FILTERS,
  filterClientsByCareLevel,
  type ClientCareLevelFilterKey,
} from '@/data/demo/clientListStats';
import { useAsyncQuery, useListState } from './core';

export const CLIENT_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'archiviert', label: WORKFLOW_STATUS_LABELS.archiviert },
  { key: 'fehlerhaft', label: WORKFLOW_STATUS_LABELS.fehlerhaft },
  { key: 'gesperrt', label: WORKFLOW_STATUS_LABELS.gesperrt },
];

export const CLIENT_SORT_OPTIONS: ListSortOption<'lastName' | 'city'>[] = [
  { key: 'name_asc', label: 'Name A–Z', field: 'lastName', direction: 'asc' },
  { key: 'name_desc', label: 'Name Z–A', field: 'lastName', direction: 'desc' },
  { key: 'city_asc', label: 'Ort A–Z', field: 'city', direction: 'asc' },
];

const PAGE_SIZE = 8;

export function useClientList() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [careLevelFilter, setCareLevelFilter] = useState<ClientCareLevelFilterKey>('all');
  const { profile } = useAuth();

  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const itemsForList = useMemo(
    () => filterClientsByCareLevel(allItems, careLevelFilter),
    [allItems, careLevelFilter],
  );

  const list = useListState<ClientListItem, 'lastName' | 'city'>({
    items: itemsForList,
    pageSize: PAGE_SIZE,
    searchFields: ['firstName', 'lastName', 'city', 'zip'],
    statusField: 'status',
    sortOptions: CLIENT_SORT_OPTIONS,
    defaultSortKey: 'name_asc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  const resetFilters = useCallback(() => {
    list.resetFilters();
    setCareLevelFilter('all');
  }, [list]);

  const hasActiveFilters =
    list.hasActiveFilters || careLevelFilter !== 'all';

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
    statusFilter: list.statusFilter as WorkflowStatus | 'all',
    setStatusFilter: list.setStatusFilter as (v: WorkflowStatus | 'all') => void,
    careLevelFilter,
    setCareLevelFilter,
    sortKey: list.sortKey,
    setSortKey: list.setSortKey,
    sortOptions: CLIENT_SORT_OPTIONS,
    statusFilters: CLIENT_STATUS_FILTERS,
    careLevelFilters: CLIENT_CARE_LEVEL_FILTERS.map((f) => ({
      key: f.key,
      label: f.label,
    })),
    hasMore: list.paginated.hasMore,
    loadMore: list.loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty:
      !query.loading && !query.error && list.filtered.length === 0 && hasActiveFilters,
  };
}
