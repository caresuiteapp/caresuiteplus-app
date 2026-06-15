import { useCallback, useState } from 'react';
import type { TripLogListItem } from '@/types/modules/assist';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchTripLogList, PURPOSE_LABELS } from '@/lib/assist';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';
import type { TripPurpose } from '@/types/modules/assist';

export const TRIP_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
];

export const TRIP_PURPOSE_FILTERS: { key: TripPurpose | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle Zwecke' },
  { key: 'einsatz', label: PURPOSE_LABELS.einsatz },
  { key: 'dienstfahrt', label: PURPOSE_LABELS.dienstfahrt },
  { key: 'material', label: PURPOSE_LABELS.material },
  { key: 'sonstiges', label: PURPOSE_LABELS.sonstiges },
];

export const TRIP_SORT_OPTIONS: ListSortOption<'startedAt' | 'employeeName'>[] = [
  {
    key: 'time_desc',
    label: 'Neueste zuerst',
    field: 'startedAt',
    direction: 'desc',
  },
  {
    key: 'time_asc',
    label: 'Älteste zuerst',
    field: 'startedAt',
    direction: 'asc',
  },
  {
    key: 'employee_asc',
    label: 'Fahrer A–Z',
    field: 'employeeName',
    direction: 'asc',
  },
];

const PAGE_SIZE = 8;

export function useTripList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);
  const [purposeFilter, setPurposeFilter] = useState<TripPurpose | 'all'>('all');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTripLogList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const purposeFiltered =
    purposeFilter === 'all'
      ? allItems
      : allItems.filter((item) => item.purpose === purposeFilter);

  const list = useListState<TripLogListItem, 'startedAt' | 'employeeName'>({
    items: purposeFiltered,
    pageSize: PAGE_SIZE,
    searchFields: ['employeeName', 'vehicleLabel', 'routeSummary'],
    statusField: 'status',
    sortOptions: TRIP_SORT_OPTIONS,
    defaultSortKey: 'time_desc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  const resetFilters = useCallback(() => {
    list.resetFilters();
    setPurposeFilter('all');
  }, [list]);

  const hasActiveFilters =
    list.hasActiveFilters || purposeFilter !== 'all';

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
    purposeFilter,
    setPurposeFilter,
    sortKey: list.sortKey,
    setSortKey: list.setSortKey,
    sortOptions: TRIP_SORT_OPTIONS,
    statusFilters: TRIP_STATUS_FILTERS,
    purposeFilters: TRIP_PURPOSE_FILTERS,
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
