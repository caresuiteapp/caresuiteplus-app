import { useCallback, useMemo, useState } from 'react';
import type { VitalReadingListItem } from '@/types/modules/pflege';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchVitalReadings } from '@/lib/pflege';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { VITAL_TYPE_LABELS } from '@/data/demo/vitalReadings';
import { useAsyncQuery, useListState } from './core';

export const VITAL_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'fehlerhaft', label: WORKFLOW_STATUS_LABELS.fehlerhaft },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
];

export const VITAL_TYPE_FILTERS: { key: VitalReadingListItem['type'] | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle Typen' },
  ...Object.entries(VITAL_TYPE_LABELS).map(([key, label]) => ({
    key: key as VitalReadingListItem['type'],
    label,
  })),
];

export const VITAL_SORT_OPTIONS: ListSortOption<'measuredAt' | 'clientName'>[] = [
  {
    key: 'measured_desc',
    label: 'Neueste Messung',
    field: 'measuredAt',
    direction: 'desc',
  },
  {
    key: 'measured_asc',
    label: 'Älteste Messung',
    field: 'measuredAt',
    direction: 'asc',
  },
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
];

const PAGE_SIZE = 8;

export function useVitalReadingList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);
  const [typeFilter, setTypeFilter] = useState<VitalReadingListItem['type'] | 'all'>('all');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchVitalReadings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<VitalReadingListItem, 'measuredAt' | 'clientName'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['clientName', 'typeLabel', 'value'],
    statusField: 'status',
    sortOptions: VITAL_SORT_OPTIONS,
    defaultSortKey: 'measured_desc',
  });

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return list.filtered;
    return list.filtered.filter((item) => item.type === typeFilter);
  }, [list.filtered, typeFilter]);

  const paginatedItems = useMemo(() => {
    const end = list.page * PAGE_SIZE;
    return {
      items: filtered.slice(0, end),
      hasMore: end < filtered.length,
    };
  }, [filtered, list.page]);

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  const resetFilters = useCallback(() => {
    list.resetFilters();
    setTypeFilter('all');
  }, [list]);

  const hasActiveFilters =
    list.hasActiveFilters || typeFilter !== 'all';

  return {
    allItems,
    items: paginatedItems.items,
    totalCount: allItems.length,
    filteredCount: filtered.length,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    search: list.search,
    setSearch: list.setSearch,
    statusFilter: list.statusFilter as WorkflowStatus | 'all',
    setStatusFilter: list.setStatusFilter as (v: WorkflowStatus | 'all') => void,
    typeFilter,
    setTypeFilter,
    sortKey: list.sortKey,
    setSortKey: list.setSortKey,
    sortOptions: VITAL_SORT_OPTIONS,
    statusFilters: VITAL_STATUS_FILTERS,
    typeFilters: VITAL_TYPE_FILTERS,
    hasMore: paginatedItems.hasMore,
    loadMore: list.loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty:
      !query.loading && !query.error && filtered.length === 0 && hasActiveFilters,
  };
}
