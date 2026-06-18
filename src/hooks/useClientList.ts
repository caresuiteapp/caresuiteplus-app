import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClientListItem } from '@/types/modules/office';
import type { ListSortOption } from '@/types/list';
import type { WorkflowStatus } from '@/types';
import { fetchClientList } from '@/lib/office';
import { getServiceMode } from '@/lib/services/mode';
import { isDraftStatusFilter } from '@/lib/services/clients/clientListQueryOptions';
import { loadClientIntakeDraft } from '@/lib/clients/clientIntakeDraftStorage';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  CLIENT_CARE_LEVEL_FILTERS,
  filterClientsByCareLevel,
  type ClientCareLevelFilterKey,
} from '@/data/demo/clientListStats';
import { useAsyncQuery, useListState } from './core';

export const CLIENT_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'archiviert', label: WORKFLOW_STATUS_LABELS.archiviert },
  { key: 'fehlerhaft', label: WORKFLOW_STATUS_LABELS.fehlerhaft },
  { key: 'gesperrt', label: WORKFLOW_STATUS_LABELS.gesperrt },
];

export const CLIENT_LIFECYCLE_FILTERS: { key: 'all' | 'active' | 'archived'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'active', label: 'Aktiv' },
  { key: 'archived', label: 'Archiviert' },
];

export const CLIENT_SORT_OPTIONS: ListSortOption<'lastName' | 'city'>[] = [
  { key: 'name_asc', label: 'Name A–Z', field: 'lastName', direction: 'asc' },
  { key: 'name_desc', label: 'Name Z–A', field: 'lastName', direction: 'desc' },
  { key: 'city_asc', label: 'Ort A–Z', field: 'city', direction: 'asc' },
];

const PAGE_SIZE = 8;

export function useClientList() {
  const isLive = getServiceMode() === 'supabase';
  const [showSuccess, setShowSuccess] = useState(false);
  const [careLevelFilter, setCareLevelFilter] = useState<ClientCareLevelFilterKey>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | 'active' | 'archived'>(
    isLive ? 'active' : 'all',
  );
  const [costBearerFilter, setCostBearerFilter] = useState<string>('all');
  const [liveSearch, setLiveSearch] = useState('');
  const [liveStatusFilter, setLiveStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [hasLocalOnlyIntakeDraft, setHasLocalOnlyIntakeDraft] = useState(false);
  const { profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const intakeDraftUserId = user?.id ?? profile?.id ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientList(
        tenantId,
        profile?.roleKey,
        isLive
          ? {
              search: liveSearch || undefined,
              statusFilter: liveStatusFilter,
              careLevelFilter,
              costBearerFilter,
              lifecycleFilter,
            }
          : undefined,
      );
    },
    [
      tenantId,
      profile?.roleKey,
      isLive,
      liveSearch,
      liveStatusFilter,
      careLevelFilter,
      costBearerFilter,
      lifecycleFilter,
    ],
    { enabled: !!tenantId },
  );

  const kpiQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'all' });
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId && isLive },
  );

  const allItems = query.data ?? [];
  const kpiItems = isLive ? (kpiQuery.data ?? []) : allItems;

  useEffect(() => {
    if (
      !isLive
      || !tenantId
      || !intakeDraftUserId
      || !isDraftStatusFilter(liveStatusFilter)
    ) {
      setHasLocalOnlyIntakeDraft(false);
      return;
    }

    let cancelled = false;

    void loadClientIntakeDraft(intakeDraftUserId, tenantId).then((draft) => {
      if (cancelled) return;

      if (!draft) {
        setHasLocalOnlyIntakeDraft(false);
        return;
      }

      const knownServerIds = new Set(allItems.map((item) => item.id));
      setHasLocalOnlyIntakeDraft(!draft.clientId || !knownServerIds.has(draft.clientId));
    });

    return () => {
      cancelled = true;
    };
  }, [allItems, intakeDraftUserId, isLive, liveStatusFilter, tenantId]);

  const itemsForList = useMemo(
    () => (isLive ? allItems : filterClientsByCareLevel(allItems, careLevelFilter)),
    [allItems, careLevelFilter, isLive],
  );

  const list = useListState<ClientListItem, 'lastName' | 'city'>({
    items: itemsForList,
    pageSize: PAGE_SIZE,
    searchFields: isLive ? [] : ['firstName', 'lastName', 'city', 'zip'],
    statusField: isLive ? undefined : 'status',
    sortOptions: CLIENT_SORT_OPTIONS,
    defaultSortKey: 'name_asc',
  });

  const costBearerFilters = useMemo(() => {
    const values = new Set<string>();
    allItems.forEach((item) => {
      if (item.costCarrier?.trim()) values.add(item.costCarrier.trim());
    });
    return [
      { key: 'all', label: 'Alle Kostenträger' },
      ...Array.from(values)
        .sort((a, b) => a.localeCompare(b, 'de'))
        .map((value) => ({ key: value, label: value })),
    ];
  }, [allItems]);

  const refresh = useCallback(async () => {
    await Promise.all([query.refresh(), isLive ? kpiQuery.refresh() : Promise.resolve()]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [isLive, kpiQuery, query]);

  const resetFilters = useCallback(() => {
    if (isLive) {
      setLiveSearch('');
      setLiveStatusFilter('all');
      setLifecycleFilter('active');
      setCostBearerFilter('all');
    } else {
      list.resetFilters();
    }
    setCareLevelFilter('all');
  }, [isLive, list]);

  const search = isLive ? liveSearch : list.search;
  const setSearch = isLive ? setLiveSearch : list.setSearch;
  const statusFilter = isLive ? liveStatusFilter : (list.statusFilter as WorkflowStatus | 'all');

  const setStatusFilter = useCallback(
    (value: WorkflowStatus | 'all') => {
      if (isLive) {
        setLiveStatusFilter(value);
        if (isDraftStatusFilter(value)) {
          setLifecycleFilter('all');
        }
        return;
      }
      list.setStatusFilter(value);
    },
    [isLive, list],
  );

  const hasActiveFilters =
    search.length > 0 ||
    statusFilter !== 'all' ||
    careLevelFilter !== 'all' ||
    lifecycleFilter !== (isLive ? 'active' : 'all') ||
    costBearerFilter !== 'all';

  return {
    items: list.paginated.items,
    allItems,
    kpiItems,
    totalCount: allItems.length,
    filteredCount: list.filtered.length,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    careLevelFilter,
    setCareLevelFilter,
    lifecycleFilter,
    setLifecycleFilter,
    costBearerFilter,
    setCostBearerFilter,
    sortKey: list.sortKey,
    setSortKey: list.setSortKey,
    sortOptions: CLIENT_SORT_OPTIONS,
    statusFilters: CLIENT_STATUS_FILTERS,
    lifecycleFilters: CLIENT_LIFECYCLE_FILTERS,
    careLevelFilters: CLIENT_CARE_LEVEL_FILTERS.map((f) => ({
      key: f.key,
      label: f.label,
    })),
    costBearerFilters,
    hasMore: list.paginated.hasMore,
    loadMore: list.loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty:
      !query.loading && !query.error && list.filtered.length === 0 && hasActiveFilters,
    hasLocalOnlyIntakeDraft,
    isLive,
  };
}
