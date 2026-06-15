import { useCallback, useState } from 'react';
import type { InvoiceListItem } from '@/types/modules/billing';
import type { WorkflowStatus } from '@/types';
import type { ListSortOption } from '@/types/list';
import { fetchInvoiceList } from '@/lib/office';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const INVOICE_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'entwurf', label: WORKFLOW_STATUS_LABELS.entwurf },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
  { key: 'archiviert', label: WORKFLOW_STATUS_LABELS.archiviert },
  { key: 'fehlerhaft', label: WORKFLOW_STATUS_LABELS.fehlerhaft },
];

export const INVOICE_SORT_OPTIONS: ListSortOption<'dueDate' | 'invoiceNumber'>[] = [
  { key: 'due_asc', label: 'Fälligkeit ↑', field: 'dueDate', direction: 'asc' },
  { key: 'due_desc', label: 'Fälligkeit ↓', field: 'dueDate', direction: 'desc' },
  { key: 'number_asc', label: 'Nummer A–Z', field: 'invoiceNumber', direction: 'asc' },
];

const PAGE_SIZE = 10;

export function useInvoiceList() {
  const [showSuccess, setShowSuccess] = useState(false);
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInvoiceList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const list = useListState<InvoiceListItem, 'dueDate' | 'invoiceNumber'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['invoiceNumber', 'clientName'],
    statusField: 'status',
    sortOptions: INVOICE_SORT_OPTIONS,
    defaultSortKey: 'due_asc',
  });

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    allItems,
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
    sortOptions: INVOICE_SORT_OPTIONS,
    statusFilters: INVOICE_STATUS_FILTERS,
    hasMore: list.paginated.hasMore,
    loadMore: list.loadMore,
    refresh,
    resetFilters: list.resetFilters,
    hasActiveFilters: list.hasActiveFilters,
    isEmpty: !query.loading && !query.error && allItems.length === 0,
    isFilterEmpty:
      !query.loading && !query.error && list.filtered.length === 0 && list.hasActiveFilters,
  };
}
