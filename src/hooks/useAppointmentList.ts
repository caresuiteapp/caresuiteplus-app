import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkflowStatus } from '@/types';
import type { AppointmentListItem } from '@/types/modules/appointmentList';
import type { ListSortOption } from '@/types/list';
import { fetchAppointmentList } from '@/lib/office';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const APPOINTMENT_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
];

const SORT_OPTIONS: ListSortOption<'startsAt' | 'title'>[] = [
  { key: 'date_asc', label: 'Datum ↑', field: 'startsAt', direction: 'asc' },
  { key: 'date_desc', label: 'Datum ↓', field: 'startsAt', direction: 'desc' },
  { key: 'title_asc', label: 'Titel A–Z', field: 'title', direction: 'asc' },
];

const PAGE_SIZE = 8;

export function useAppointmentList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const scope = JSON.stringify([tenantId, profile?.id, profile?.roleKey]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (successTimer.current) clearTimeout(successTimer.current); }; }, []);
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAppointmentList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.id, profile?.roleKey],
  { enabled: !!tenantId, queryKey: scope },
  );

  const allItems = useMemo(() => query.data ?? [], [query.data]);

  const list = useListState<AppointmentListItem, 'startsAt' | 'title'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['title', 'clientName', 'employeeName', 'location'],
    statusField: 'status',
    sortOptions: SORT_OPTIONS,
    defaultSortKey: 'date_asc',
  });

  const resetListFilters = list.resetFilters;
  useEffect(() => { if (successTimer.current) clearTimeout(successTimer.current); setShowSuccess(false); resetListFilters(); }, [scope, resetListFilters]);
  const refreshQuery = query.refreshWithResult;
  const refresh = useCallback(async () => {
    if (successTimer.current) clearTimeout(successTimer.current);
    setShowSuccess(false);
    const succeeded = await refreshQuery();
    if (!succeeded || !mounted.current || scopeRef.current !== scope) return;
    setShowSuccess(true);
    successTimer.current = setTimeout(() => setShowSuccess(false), 2000);
  }, [refreshQuery, scope]);

  return useMemo(
    () => ({
      allItems,
      items: list.paginated.items,
      totalCount: allItems.length,
      filteredCount: list.filtered.length,
      loading: query.loading,
      error: query.error,
      refreshError: query.refreshError,
      refreshing: query.refreshing,
      showSuccess,
      search: list.search,
      setSearch: list.setSearch,
      statusFilter: list.statusFilter as WorkflowStatus | 'all',
      setStatusFilter: list.setStatusFilter as (v: WorkflowStatus | 'all') => void,
      sortKey: list.sortKey,
      setSortKey: list.setSortKey,
      sortOptions: SORT_OPTIONS,
      statusFilters: APPOINTMENT_STATUS_FILTERS,
      hasMore: list.paginated.hasMore,
      loadMore: list.loadMore,
      resetFilters: list.resetFilters,
      hasActiveFilters: list.hasActiveFilters,
      refresh,
      isEmpty: !query.loading && !query.error && allItems.length === 0,
      isFilterEmpty:
        !query.loading && !query.error && list.filtered.length === 0 && list.hasActiveFilters,
    }),
    [allItems, list, query, refresh, showSuccess],
  );
}
