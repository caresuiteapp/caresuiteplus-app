import { useCallback, useMemo, useState } from 'react';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import type { WorkflowStatus } from '@/types';
import type { ListSortOption } from '@/types/list';
import {
  OFFICE_DOCUMENT_CATEGORY_FILTERS,
  filterOfficeDocumentsByCategory,
  type OfficeDocumentCategoryFilterKey,
} from '@/lib/office/officeDocumentListStats';
import { fetchOfficeDocumentList } from '@/lib/office/officeDocumentsService';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const OFFICE_DOCUMENT_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
];

export const OFFICE_DOCUMENT_SORT_OPTIONS: ListSortOption<'title' | 'updatedAt'>[] = [
  { key: 'updated_desc', label: 'Neueste zuerst', field: 'updatedAt', direction: 'desc' },
  { key: 'updated_asc', label: 'Älteste zuerst', field: 'updatedAt', direction: 'asc' },
  { key: 'title_asc', label: 'Titel A–Z', field: 'title', direction: 'asc' },
];

const PAGE_SIZE = 10;

export function useOfficeDocuments() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<OfficeDocumentCategoryFilterKey>('all');
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeDocumentList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const itemsForList = useMemo(
    () => filterOfficeDocumentsByCategory(allItems, categoryFilter),
    [allItems, categoryFilter],
  );

  const list = useListState<PortalDocumentListItem, 'title' | 'updatedAt'>({
    items: itemsForList,
    pageSize: PAGE_SIZE,
    searchFields: ['title', 'fileName'],
    statusField: 'status',
    sortOptions: OFFICE_DOCUMENT_SORT_OPTIONS,
    defaultSortKey: 'updated_desc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  const resetFilters = useCallback(() => {
    list.resetFilters();
    setCategoryFilter('all');
  }, [list]);

  const hasActiveFilters = list.hasActiveFilters || categoryFilter !== 'all';

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
    categoryFilter,
    setCategoryFilter,
    sortKey: list.sortKey,
    setSortKey: list.setSortKey,
    sortOptions: OFFICE_DOCUMENT_SORT_OPTIONS,
    statusFilters: OFFICE_DOCUMENT_STATUS_FILTERS,
    categoryFilters: OFFICE_DOCUMENT_CATEGORY_FILTERS.map((f) => ({
      key: f.key,
      label: f.label,
    })),
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
