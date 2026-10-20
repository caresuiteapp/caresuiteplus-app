import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReportListItem, ReportCategory } from '@/types/reporting';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchReportList } from '@/lib/reporting';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const REPORT_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
];

export const REPORT_CATEGORY_FILTERS: { key: ReportCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle Kategorien' },
  { key: 'pdl', label: 'PDL' },
  { key: 'quality', label: 'Qualität' },
  { key: 'finance', label: 'Finanzen' },
  { key: 'operations', label: 'Betrieb' },
];

export const REPORT_SORT_OPTIONS: ListSortOption<'title' | 'updatedAt'>[] = [
  { key: 'title_asc', label: 'Titel A–Z', field: 'title', direction: 'asc' },
  { key: 'updated_desc', label: 'Zuletzt aktualisiert', field: 'updatedAt', direction: 'desc' },
  { key: 'updated_asc', label: 'Älteste zuerst', field: 'updatedAt', direction: 'asc' },
];

const PAGE_SIZE = 8;

export function useReportList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | 'all'>('all');
  const [page, setPage] = useState(1);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchReportList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<ReportListItem, 'title' | 'updatedAt'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['title', 'period'],
    statusField: 'status',
    sortOptions: REPORT_SORT_OPTIONS,
    defaultSortKey: 'updated_desc',
  });

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return list.filtered;
    return list.filtered.filter((item) => item.category === categoryFilter);
  }, [list.filtered, categoryFilter]);

  const paginatedItems = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  const hasMore = paginatedItems.length < filtered.length;

  useEffect(() => {
    setPage(1);
  }, [list.search, list.statusFilter, list.sortKey, categoryFilter]);

  const loadMore = useCallback(() => {
    if (hasMore) setPage((p) => p + 1);
  }, [hasMore]);

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  const resetFilters = useCallback(() => {
    list.resetFilters();
    setCategoryFilter('all');
    setPage(1);
  }, [list]);

  const hasActiveFilters =
    list.hasActiveFilters || categoryFilter !== 'all';

  return {
    items: paginatedItems,
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
    categoryFilter,
    setCategoryFilter,
    sortKey: list.sortKey,
    setSortKey: list.setSortKey,
    sortOptions: REPORT_SORT_OPTIONS,
    statusFilters: REPORT_STATUS_FILTERS,
    categoryFilters: REPORT_CATEGORY_FILTERS,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty:
      !query.loading && !query.error && filtered.length === 0 && hasActiveFilters,
    allItems,
  };
}
