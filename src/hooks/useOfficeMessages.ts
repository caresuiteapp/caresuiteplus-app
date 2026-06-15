import { useCallback, useState } from 'react';
import type { MessageListItem } from '@/types/portal/communication';
import type { WorkflowStatus } from '@/types';
import type { ListSortOption } from '@/types/list';
import { fetchOfficeMessages } from '@/lib/portal/messageService';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useAsyncQuery, useListState } from './core';

export const OFFICE_MESSAGE_STATUS_FILTERS: { key: WorkflowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'aktiv', label: WORKFLOW_STATUS_LABELS.aktiv },
  { key: 'in_bearbeitung', label: WORKFLOW_STATUS_LABELS.in_bearbeitung },
  { key: 'abgeschlossen', label: WORKFLOW_STATUS_LABELS.abgeschlossen },
];

export const OFFICE_MESSAGE_SORT_OPTIONS: ListSortOption<'subject' | 'updatedAt'>[] = [
  { key: 'updated_desc', label: 'Neueste zuerst', field: 'updatedAt', direction: 'desc' },
  { key: 'updated_asc', label: 'Älteste zuerst', field: 'updatedAt', direction: 'asc' },
  { key: 'subject_asc', label: 'Betreff A–Z', field: 'subject', direction: 'asc' },
];

const PAGE_SIZE = 10;

export function useOfficeMessages() {
  const [showSuccess, setShowSuccess] = useState(false);
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeMessages(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];
  const unreadCount = allItems.filter((m) => !m.readAt).length;

  const list = useListState<MessageListItem, 'subject' | 'updatedAt'>({
    items: allItems,
    pageSize: PAGE_SIZE,
    searchFields: ['subject', 'senderName', 'recipientName', 'body'],
    statusField: 'status',
    sortOptions: OFFICE_MESSAGE_SORT_OPTIONS,
    defaultSortKey: 'updated_desc',
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
    unreadCount,
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
    sortOptions: OFFICE_MESSAGE_SORT_OPTIONS,
    statusFilters: OFFICE_MESSAGE_STATUS_FILTERS,
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
