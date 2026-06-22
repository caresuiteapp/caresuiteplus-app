import { useCallback, useMemo, useState } from 'react';
import type { WorkflowStatus } from '@/types';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import type { ListSortOption } from '@/types/list';
import { fetchEmployeeList } from '@/lib/office';
import { subscribeToEmployeeListChanges } from '@/lib/realtime';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const EMPLOYEE_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'gesperrt', label: WORKFLOW_STATUS_LABELS.gesperrt },
];

const PAGE_SIZE = 8;

export const EMPLOYEE_SORT_OPTIONS: ListSortOption<'lastName' | 'jobTitle'>[] = [
  { key: 'name_asc', label: 'Name A–Z', field: 'lastName', direction: 'asc' },
  { key: 'name_desc', label: 'Name Z–A', field: 'lastName', direction: 'desc' },
  { key: 'role_asc', label: 'Rolle A–Z', field: 'jobTitle', direction: 'asc' },
];

export function useEmployeeList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchEmployeeList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    {
      enabled: true,
      live: tenantId
        ? {
            tenantId,
            subscribe: subscribeToEmployeeListChanges,
          }
        : undefined,
    },
  );

  const allItems = query.data ?? [];

  const list = useListState<EmployeeListItem, 'lastName' | 'jobTitle'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['firstName', 'lastName', 'jobTitle', 'email'],
    statusField: 'status',
    sortOptions: EMPLOYEE_SORT_OPTIONS,
    defaultSortKey: 'name_asc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return useMemo(
    () => ({
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
      sortKey: list.sortKey,
      setSortKey: list.setSortKey,
      sortOptions: EMPLOYEE_SORT_OPTIONS,
      statusFilters: EMPLOYEE_STATUS_FILTERS,
      hasMore: list.paginated.hasMore,
      loadMore: list.loadMore,
      resetFilters: list.resetFilters,
      hasActiveFilters: list.hasActiveFilters,
      refresh,
      isEmpty: !query.loading && !query.error && allItems.length === 0,
      isFilterEmpty:
        !query.loading && !query.error && list.filtered.length === 0 && list.hasActiveFilters,
      isLiveConnected: query.isLiveConnected,
    }),
    [allItems, list, query, refresh, showSuccess],
  );
}
