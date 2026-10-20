import { useCallback, useState } from 'react';
import type { CounselingListItem } from '@/types/modules/beratung';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchCounselingCaseList } from '@/lib/beratung';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const CASE_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'fehlerhaft', label: WORKFLOW_STATUS_LABELS.fehlerhaft },
];

export const CASE_SORT_OPTIONS: ListSortOption<'openedAt' | 'clientName'>[] = [
  { key: 'opened_desc', label: 'Neueste zuerst', field: 'openedAt', direction: 'desc' },
  { key: 'opened_asc', label: 'Älteste zuerst', field: 'openedAt', direction: 'asc' },
  { key: 'client_asc', label: 'Klient A–Z', field: 'clientName', direction: 'asc' },
];

const PAGE_SIZE = 8;

export function useCounselingCaseList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCounselingCaseList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<CounselingListItem, 'openedAt' | 'clientName'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['subject', 'category', 'clientName', 'counselorName'],
    statusField: 'status',
    sortOptions: CASE_SORT_OPTIONS,
    defaultSortKey: 'opened_desc',
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
    sortOptions: CASE_SORT_OPTIONS,
    statusFilters: CASE_STATUS_FILTERS,
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
