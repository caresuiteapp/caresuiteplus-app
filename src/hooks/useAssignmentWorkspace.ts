import { AppState, Platform } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { ListSortOption } from '@/types/list';
import { fetchAssignmentList } from '@/lib/assist';
import { subscribeToAssistOperationsChanges } from '@/lib/realtime';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery } from './core';
import {
  ASSIGNMENT_DATE_RANGE_OPTIONS, ASSIGNMENT_WORKSPACE_STATUS_FILTERS,
  assignmentBusinessDate, assignmentDateRangeError, buildAssignmentEmployeeOptions,
  filterAssignmentWorkspace, resolveAssignmentWorkspaceStatus, sortAssignmentWorkspace, summarizeAssignmentWorkspace,
  type AssignmentWorkspaceDateRange, type AssignmentWorkspaceFilters, type AssignmentWorkspaceSort,
  type AssignmentWorkspaceStatusFilter,
} from '@/lib/assist/assignmentWorkspaceModel';

export const ASSIGNMENT_STATUS_FILTERS = ASSIGNMENT_WORKSPACE_STATUS_FILTERS;
export const ASSIGNMENT_SORT_OPTIONS: ListSortOption<'scheduledStart' | 'clientName'>[] = [
  { key: 'time_asc', label: 'Früheste zuerst', field: 'scheduledStart', direction: 'asc' },
  { key: 'time_desc', label: 'Neueste zuerst', field: 'scheduledStart', direction: 'desc' },
  { key: 'client_asc', label: 'Klient:innen A–Z', field: 'clientName', direction: 'asc' },
];
const PAGE_SIZE = 12;
type Preferences = AssignmentWorkspaceFilters & { scope: string; sortKey: AssignmentWorkspaceSort; page: number };
const initialPreferences = (scope: string): Preferences => ({ scope, search: '', statusFilter: 'all', dateRange: 'today', dateFrom: '', dateTo: '', employeeFilter: 'all', serviceFilter: 'all', sortKey: 'time_asc', page: 1 });

/** Shared planning filters, status calculation and scoped refresh for Web and native. */
export function useAssignmentList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const scope = JSON.stringify([tenantId, profile?.id, profile?.employeeId, profile?.roleKey]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const mounted = useRef(true);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [successScope, setSuccessScope] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(() => initialPreferences(scope));
  const [deleted, setDeleted] = useState<{ scope: string; ids: Set<string> }>(() => ({ scope, ids: new Set() }));
  const [now, setNow] = useState(() => new Date());
  const current = preferences.scope === scope ? preferences : initialPreferences(scope);
  useEffect(() => {
    mounted.current = true;
    const clock = setInterval(() => setNow(new Date()), 60_000);
    const focus = () => setNow(new Date());
    const appState = Platform.OS !== 'web' ? AppState.addEventListener('change', value => { if (value === 'active') focus(); }) : null;
    if (Platform.OS === 'web' && typeof window?.addEventListener === 'function') window.addEventListener('focus', focus);
    return () => {
      mounted.current = false; clearInterval(clock);
      appState?.remove();
      if (Platform.OS === 'web' && typeof window?.removeEventListener === 'function') window.removeEventListener('focus', focus);
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);
  useEffect(() => {
    if (successTimer.current) clearTimeout(successTimer.current);
    setSuccessScope(null);
    setPreferences(initialPreferences(scope));
    setDeleted({ scope, ids: new Set() });
  }, [scope]);

  const query = useAsyncQuery(
    () => tenantId ? fetchAssignmentList(tenantId, profile?.roleKey, profile) : Promise.resolve({ ok: false as const, error: 'Kein Unternehmen ausgewählt.' }),
    [tenantId, profile?.id, profile?.employeeId, profile?.roleKey],
    { queryKey: scope, enabled: !!tenantId, live: tenantId ? { tenantId, subscribe: subscribeToAssistOperationsChanges, pollMs: OPERATIONAL_LIVE_POLL_MS } : undefined },
  );
  const allItems = useMemo(() => (query.data ?? []).filter(item => item.tenantId === tenantId && !(deleted.scope === scope && deleted.ids.has(item.id))), [query.data, tenantId, deleted, scope]);
  const setFilter = useCallback(<K extends keyof AssignmentWorkspaceFilters | 'sortKey'>(key: K, value: Preferences[K]) => {
    if (!mounted.current || scopeRef.current !== scope) return;
    setPreferences(previous => ({ ...(previous.scope === scope ? previous : initialPreferences(scope)), [key]: value, page: 1 }));
  }, [scope]);
  const setSearch = useCallback((value: string) => setFilter('search', value), [setFilter]);
  const setStatusFilter = useCallback((value: AssignmentWorkspaceStatusFilter) => setFilter('statusFilter', value), [setFilter]);
  const setDateRange = useCallback((value: AssignmentWorkspaceDateRange) => setFilter('dateRange', value), [setFilter]);
  const setDateFrom = useCallback((value: string) => setFilter('dateFrom', value), [setFilter]);
  const setDateTo = useCallback((value: string) => setFilter('dateTo', value), [setFilter]);
  const setEmployeeFilter = useCallback((value: string) => setFilter('employeeFilter', value), [setFilter]);
  const setServiceFilter = useCallback((value: string) => setFilter('serviceFilter', value), [setFilter]);
  const setSortKey = useCallback((value: string) => {
    if (ASSIGNMENT_SORT_OPTIONS.some(option => option.key === value)) setFilter('sortKey', value as AssignmentWorkspaceSort);
  }, [setFilter]);
  const day = assignmentBusinessDate(now);
  const beforeStatusFilter = useMemo(() => filterAssignmentWorkspace(allItems, { ...current, statusFilter: 'all' }, now),
    // Day boundaries are relevant; the minute clock need not resort unchanged rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, current.search, current.dateRange, current.dateFrom, current.dateTo, current.employeeFilter, current.serviceFilter, day]);
  const filteredItems = useMemo(() => sortAssignmentWorkspace(beforeStatusFilter.filter(item => current.statusFilter === 'all' || resolveAssignmentWorkspaceStatus(item) === current.statusFilter), current.sortKey), [beforeStatusFilter, current.statusFilter, current.sortKey]);
  const workspaceStats = useMemo(() => summarizeAssignmentWorkspace(beforeStatusFilter, now), [beforeStatusFilter, now]);
  const allStats = useMemo(() => summarizeAssignmentWorkspace(allItems, now), [allItems, now]);
  const employeeOptions = useMemo(() => buildAssignmentEmployeeOptions(allItems), [allItems]);
  const serviceOptions = useMemo(() => [{ key: 'all', label: 'Alle Leistungen' }, ...[...new Set(allItems.map(item => item.serviceName || item.title).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de')).map(name => ({ key: name, label: name }))], [allItems]);
  const hasMore = current.page * PAGE_SIZE < filteredItems.length;
  const loadMore = useCallback(() => {
    if (!mounted.current || scopeRef.current !== scope || !hasMore) return;
    setPreferences(previous => previous.scope === scope ? { ...previous, page: previous.page + 1 } : previous);
  }, [scope, hasMore]);
  const refreshQuery = query.refreshWithResult;
  const refresh = useCallback(async () => {
    if (!mounted.current || scopeRef.current !== scope) return;
    if (successTimer.current) clearTimeout(successTimer.current);
    setSuccessScope(null);
    const succeeded = await refreshQuery();
    if (!mounted.current || scopeRef.current !== scope || !succeeded) return;
    setSuccessScope(scope);
    successTimer.current = setTimeout(() => { if (mounted.current && scopeRef.current === scope) setSuccessScope(null); }, 2000);
  }, [refreshQuery, scope]);
  const setQueryData = query.setData;
  const dismissDeletedAssignment = useCallback((assignmentId: string) => {
    if (!mounted.current || scopeRef.current !== scope) return;
    setDeleted(previous => ({ scope, ids: new Set([...(previous.scope === scope ? previous.ids : []), assignmentId]) }));
    setQueryData(previous => previous?.filter(item => item.id !== assignmentId) ?? previous);
  }, [scope, setQueryData]);
  const resetFilters = useCallback(() => {
    if (mounted.current && scopeRef.current === scope) setPreferences(initialPreferences(scope));
  }, [scope]);
  const hasActiveFilters = current.search.trim().length > 0 || current.statusFilter !== 'all' || current.dateRange !== 'today' || current.employeeFilter !== 'all' || current.serviceFilter !== 'all';
  const error = tenantId ? query.error : 'Kein Unternehmen ausgewählt.';
  return {
    items: filteredItems.slice(0, current.page * PAGE_SIZE), allItems, filteredItems,
    totalCount: allItems.length, filteredCount: filteredItems.length, workspaceStats, allStats,
    loading: !!tenantId && query.loading, error, refreshError: query.refreshError, refreshing: query.refreshing,
    showSuccess: successScope === scope, search: current.search, setSearch, statusFilter: current.statusFilter, setStatusFilter,
    dateRange: current.dateRange, setDateRange, dateRangeOptions: ASSIGNMENT_DATE_RANGE_OPTIONS,
    dateFrom: current.dateFrom, setDateFrom, dateTo: current.dateTo, setDateTo,
    dateRangeError: assignmentDateRangeError(current.dateRange, current.dateFrom, current.dateTo),
    employeeFilter: current.employeeFilter, setEmployeeFilter, employeeOptions, serviceFilter: current.serviceFilter, setServiceFilter, serviceOptions,
    sortKey: current.sortKey, setSortKey, sortOptions: ASSIGNMENT_SORT_OPTIONS, statusFilters: ASSIGNMENT_STATUS_FILTERS,
    hasMore, loadMore, refresh, dismissDeletedAssignment, resetFilters, hasActiveFilters,
    isEmpty: !query.loading && !error && allItems.length === 0,
    isFilterEmpty: !query.loading && !error && allItems.length > 0 && filteredItems.length === 0,
    isLiveConnected: query.isLiveConnected,
  };
}
