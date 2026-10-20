import { useCallback, useState } from 'react';
import type { CourseListItem } from '@/types/modules/akademie';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchCourseList } from '@/lib/akademie';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const COURSE_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
];

export const COURSE_SORT_OPTIONS: ListSortOption<'title' | 'startsAt'>[] = [
  { key: 'title_asc', label: 'Titel A–Z', field: 'title', direction: 'asc' },
  { key: 'start_asc', label: 'Starttermin aufsteigend', field: 'startsAt', direction: 'asc' },
  { key: 'start_desc', label: 'Starttermin absteigend', field: 'startsAt', direction: 'desc' },
];

const PAGE_SIZE = 8;

export function useCourseList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCourseList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<CourseListItem, 'title' | 'startsAt'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['title', 'category'],
    statusField: 'status',
    sortOptions: COURSE_SORT_OPTIONS,
    defaultSortKey: 'title_asc',
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
    sortOptions: COURSE_SORT_OPTIONS,
    statusFilters: COURSE_STATUS_FILTERS,
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
