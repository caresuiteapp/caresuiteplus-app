import { useCallback, useState } from 'react';
import type { InvoiceListItem } from '@/types/modules/billing';
import type { InvoiceStatus } from '@/types/modules/billing';
import type { ListSortOption } from '@/types/list';
import type { TenantModuleKey } from '@/types/tenant/tenantCenter';
import { fetchInvoiceList } from '@/lib/office';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { INVOICE_STATUS_LABELS } from '@/lib/office/invoiceStatus';
import { useAsyncQuery, useListState } from './core';

export const INVOICE_STATUS_FILTERS: { key: InvoiceStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'draft', label: INVOICE_STATUS_LABELS.draft },
  { key: 'ready', label: INVOICE_STATUS_LABELS.ready },
  { key: 'sent', label: INVOICE_STATUS_LABELS.sent },
  { key: 'partly_paid', label: INVOICE_STATUS_LABELS.partly_paid },
  { key: 'paid', label: INVOICE_STATUS_LABELS.paid },
  { key: 'overdue', label: INVOICE_STATUS_LABELS.overdue },
  { key: 'cancelled', label: INVOICE_STATUS_LABELS.cancelled },
];

export const INVOICE_SORT_OPTIONS: ListSortOption<'dueDate' | 'invoiceNumber'>[] = [
  { key: 'due_asc', label: 'Fälligkeit ↑', field: 'dueDate', direction: 'asc' },
  { key: 'due_desc', label: 'Fälligkeit ↓', field: 'dueDate', direction: 'desc' },
  { key: 'number_asc', label: 'Nummer A–Z', field: 'invoiceNumber', direction: 'asc' },
];

const PAGE_SIZE = 10;

export function useInvoiceList(moduleFilter: TenantModuleKey | 'all' = 'all') {
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

  const allInvoices = query.data ?? [];
  const allItems = moduleFilter === 'all'
    ? allInvoices
    : allInvoices.filter((invoice) => invoice.billingModule === moduleFilter);

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
    globalTotalCount: allInvoices.length,
    filteredCount: list.filtered.length,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    search: list.search,
    setSearch: list.setSearch,
    statusFilter: list.statusFilter as InvoiceStatus | 'all',
    setStatusFilter: list.setStatusFilter as (v: InvoiceStatus | 'all') => void,
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
