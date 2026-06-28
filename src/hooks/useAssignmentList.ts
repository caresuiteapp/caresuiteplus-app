import { useCallback, useMemo, useState } from 'react';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchAssignmentList } from '@/lib/assist';
import { subscribeToAssistOperationsChanges } from '@/lib/realtime';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  matchesDateRangeFilter,
  type AssignmentDateRangeFilter,
} from '@/lib/assist/assignmentListFilters';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery, useListState } from './core';

export const ASSIGNMENT_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'fehlerhaft', label: WORKFLOW_STATUS_LABELS.fehlerhaft },
  { key: 'gesperrt', label: WORKFLOW_STATUS_LABELS.gesperrt },
];

export const ASSIGNMENT_SORT_OPTIONS: ListSortOption<'scheduledStart' | 'clientName'>[] = [
  {
    key: 'time_asc',
    label: 'Zeit aufsteigend',
    field: 'scheduledStart',
    direction: 'asc',
  },
  {
    key: 'time_desc',
    label: 'Zeit absteigend',
    field: 'scheduledStart',
    direction: 'desc',
  },
  {
    key: 'client_asc',
    label: 'Klient A–Z',
    field: 'clientName',
    direction: 'asc',
  },
];

const PAGE_SIZE = 8;

export function useAssignmentList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [showSuccess, setShowSuccess] = useState(false);
  const [dateRange, setDateRange] = useState<AssignmentDateRangeFilter>('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAssignmentList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    {
      enabled: !!tenantId,
      live: tenantId
        ? {
            tenantId,
            subscribe: subscribeToAssistOperationsChanges,
            pollMs: OPERATIONAL_LIVE_POLL_MS,
          }
        : undefined,
    },
  );

  const allItems = query.data ?? [];

  const list = useListState<AssignmentListItem, 'scheduledStart' | 'clientName'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['title', 'clientName', 'employeeName', 'location', 'id', 'serviceName'],
    statusField: 'status',
    sortOptions: ASSIGNMENT_SORT_OPTIONS,
    defaultSortKey: 'time_asc',
  });

  const filteredItems = useMemo(() => {
    let result = list.filtered;
    if (dateRange !== 'all') {
      result = result.filter((item) => matchesDateRangeFilter(item.scheduledStart, dateRange));
    }
    if (employeeFilter !== 'all') {
      result = result.filter((item) => item.employeeName === employeeFilter);
    }
    if (serviceFilter !== 'all') {
      result = result.filter(
        (item) => (item.serviceName ?? item.title) === serviceFilter,
      );
    }
    return result;
  }, [list.filtered, dateRange, employeeFilter, serviceFilter]);

  const paginatedItems = useMemo(() => {
    const end = list.page * PAGE_SIZE;
    return {
      items: filteredItems.slice(0, end),
      total: filteredItems.length,
      page: list.page,
      pageSize: PAGE_SIZE,
      hasMore: end < filteredItems.length,
    };
  }, [filteredItems, list.page]);

  const employeeOptions = useMemo(() => {
    const names = [...new Set(allItems.map((item) => item.employeeName).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'de'),
    );
    return [{ key: 'all', label: 'Alle' }, ...names.map((name) => ({ key: name, label: name }))];
  }, [allItems]);

  const serviceOptions = useMemo(() => {
    const names = [
      ...new Set(allItems.map((item) => item.serviceName ?? item.title).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, 'de'));
    return [{ key: 'all', label: 'Alle' }, ...names.map((name) => ({ key: name, label: name }))];
  }, [allItems]);

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  const resetFilters = useCallback(() => {
    list.resetFilters();
    setDateRange('all');
    setEmployeeFilter('all');
    setServiceFilter('all');
  }, [list]);

  const hasExtendedFilters =
    dateRange !== 'all' || employeeFilter !== 'all' || serviceFilter !== 'all';

  return {
    items: paginatedItems.items,
    allItems,
    totalCount: allItems.length,
    filteredCount: filteredItems.length,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    search: list.search,
    setSearch: list.setSearch,
    statusFilter: list.statusFilter as WorkflowStatus | 'all',
    setStatusFilter: list.setStatusFilter as (v: WorkflowStatus | 'all') => void,
    dateRange,
    setDateRange,
    employeeFilter,
    setEmployeeFilter,
    employeeOptions,
    serviceFilter,
    setServiceFilter,
    serviceOptions,
    sortKey: list.sortKey,
    setSortKey: list.setSortKey,
    sortOptions: ASSIGNMENT_SORT_OPTIONS,
    statusFilters: ASSIGNMENT_STATUS_FILTERS,
    hasMore: paginatedItems.hasMore,
    loadMore: list.loadMore,
    refresh,
    resetFilters,
    hasActiveFilters: list.hasActiveFilters || hasExtendedFilters,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty:
      !query.loading &&
      !query.error &&
      filteredItems.length === 0 &&
      (list.hasActiveFilters || hasExtendedFilters),
    isLiveConnected: query.isLiveConnected,
  };
}
