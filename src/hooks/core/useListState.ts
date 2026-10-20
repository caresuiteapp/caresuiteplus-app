import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListSortOption, PaginatedResult } from '@/types/list';
import { filterByField, filterBySearch, paginateItems, sortItems } from '@/lib/list';

type UseListStateOptions<TItem, TSortField extends string> = {
  items: TItem[];
  pageSize: number;
  searchFields: (keyof TItem & string)[];
  statusField?: keyof TItem & string;
  sortOptions: ListSortOption<TSortField>[];
  defaultSortKey: string;
};

export function useListState<TItem extends Record<string, unknown>, TSortField extends string>({
  items,
  pageSize,
  searchFields,
  statusField,
  sortOptions,
  defaultSortKey,
}: UseListStateOptions<TItem, TSortField>) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [page, setPage] = useState(1);

  const sortOption = sortOptions.find((o) => o.key === sortKey) ?? sortOptions[0];

  const filtered = useMemo(() => {
    let result = filterBySearch(items, search, searchFields);
    if (statusField && statusFilter !== 'all') {
      result = filterByField(result, statusField, statusFilter);
    }
    result = sortItems(result, sortOption.field, sortOption.direction);
    return result;
  }, [items, search, statusFilter, statusField, sortOption, searchFields]);

  const paginated: PaginatedResult<TItem> = useMemo(
    () => paginateItems(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortKey]);

  const loadMore = useCallback(() => {
    if (paginated.hasMore) setPage((p) => p + 1);
  }, [paginated.hasMore]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setSortKey(defaultSortKey);
    setPage(1);
  }, [defaultSortKey]);

  const hasActiveFilters = search.length > 0 || statusFilter !== 'all';

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
    page,
    filtered,
    paginated,
    loadMore,
    resetFilters,
    hasActiveFilters,
    sortOption,
  };
}
