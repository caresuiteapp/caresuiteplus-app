import { useCallback, useState } from 'react';
import type { ResidentListItem } from '@/types/modules/stationaer';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchResidentList } from '@/lib/stationaer';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const RESIDENT_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
];

export const RESIDENT_SORT_OPTIONS: ListSortOption<'lastName' | 'admissionDate'>[] = [
  { key: 'name_asc', label: 'Name A–Z', field: 'lastName', direction: 'asc' },
  { key: 'admission_desc', label: 'Neueste Aufnahme', field: 'admissionDate', direction: 'desc' },
  { key: 'admission_asc', label: 'Älteste Aufnahme', field: 'admissionDate', direction: 'asc' },
];

const PAGE_SIZE = 8;

export function useResidentList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchResidentList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<ResidentListItem, 'lastName' | 'admissionDate'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['firstName', 'lastName', 'roomName', 'wing', 'careLevel'],
    statusField: 'status',
    sortOptions: RESIDENT_SORT_OPTIONS,
    defaultSortKey: 'name_asc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
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
    sortOptions: RESIDENT_SORT_OPTIONS,
    statusFilters: RESIDENT_STATUS_FILTERS,
    hasMore: list.paginated.hasMore,
    loadMore: list.loadMore,
    refresh,
    resetFilters: list.resetFilters,
    hasActiveFilters: list.hasActiveFilters,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty:
      !query.loading && !query.error && list.filtered.length === 0 && list.hasActiveFilters,
    allItems,
  };
}
