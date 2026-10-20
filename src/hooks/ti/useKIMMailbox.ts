import { useCallback, useMemo, useState } from 'react';
import type { KIMMessageStatus } from '@/types/modules/ti';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchKIMMailbox, fetchKIMMailboxes } from '@/lib/ti';
import { KIM_PAGE_SIZE_OPTIONS, KIM_STATUS_FILTERS } from '@/data/demo/ti/kimQuery';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useKIMMailbox(initialPageSize = 10) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<KIMMessageStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const mailboxesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchKIMMailboxes(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
  { enabled: !!tenantId },
  );

  const mailboxId = mailboxesQuery.data?.[0]?.id;

  const messagesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchKIMMailbox(
        tenantId,
        {
          mailboxId,
          status: statusFilter,
          search,
          page,
          pageSize,
          sortDirection: 'desc',
        },
        profile?.roleKey,
      );
    },
    [tenantId, profile?.roleKey, mailboxId, statusFilter, search, page, pageSize],
  { enabled: !!tenantId },
  );

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  }, []);

  const loadMore = useCallback(() => {
    if (messagesQuery.data?.hasMore) setPage((p) => p + 1);
  }, [messagesQuery.data?.hasMore]);

  const refresh = useCallback(async () => {
    setPage(1);
    await mailboxesQuery.refresh();
    await messagesQuery.refresh();
  }, [mailboxesQuery, messagesQuery]);

  return useMemo(
    () => ({
      mailbox: mailboxesQuery.data?.[0] ?? null,
      items: messagesQuery.data?.items ?? [],
      totalCount: messagesQuery.data?.totalCount ?? 0,
      filteredCount: messagesQuery.data?.filteredCount ?? 0,
      page,
      pageSize,
      pageSizeOptions: KIM_PAGE_SIZE_OPTIONS,
      setPageSize: (size: number) => {
        setPageSize(size);
        setPage(1);
      },
      hasMore: messagesQuery.data?.hasMore ?? false,
      loading: mailboxesQuery.loading || messagesQuery.loading,
      error: messagesQuery.error ?? mailboxesQuery.error,
      refreshing: mailboxesQuery.refreshing || messagesQuery.refreshing,
      search,
      setSearch: (v: string) => {
        setSearch(v);
        setPage(1);
      },
      statusFilter,
      setStatusFilter: (v: KIMMessageStatus | 'all') => {
        setStatusFilter(v);
        setPage(1);
      },
      statusFilters: KIM_STATUS_FILTERS,
      loadMore,
      resetFilters,
      refresh,
      isEmpty: !messagesQuery.loading && (messagesQuery.data?.totalCount ?? 0) === 0,
      isFilterEmpty:
        !messagesQuery.loading &&
        (messagesQuery.data?.filteredCount ?? 0) === 0 &&
        (search.length > 0 || statusFilter !== 'all'),
    }),
    [mailboxesQuery, messagesQuery, page, pageSize, search, statusFilter, loadMore, resetFilters, refresh],
  );
}
