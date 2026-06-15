import { useCallback } from 'react';
import type { ListSortOption } from '@/types/list';

export function resolveTableColumnSort<TField extends string>(
  columnKey: string,
  currentSortKey: string,
  sortOptions: ListSortOption<TField>[],
  columnMap: Record<string, TField>,
): string {
  const field = columnMap[columnKey];
  if (!field) return currentSortKey;

  const matching = sortOptions.filter((option) => option.field === field);
  if (matching.length === 0) return currentSortKey;

  const current = matching.find((option) => option.key === currentSortKey);
  if (current) {
    const nextDirection = current.direction === 'asc' ? 'desc' : 'asc';
    const toggled = matching.find((option) => option.direction === nextDirection);
    return toggled?.key ?? current.key;
  }

  const preferred = matching.find((option) => option.direction === 'asc') ?? matching[0];
  return preferred.key;
}

export function sortKeyToColumnState<TField extends string>(
  sortKey: string,
  sortOptions: ListSortOption<TField>[],
  columnMap: Record<string, TField>,
): { columnKey: string | null; direction: 'asc' | 'desc' } {
  const option = sortOptions.find((item) => item.key === sortKey);
  if (!option) return { columnKey: null, direction: 'asc' };

  const columnKey =
    Object.entries(columnMap).find(([, field]) => field === option.field)?.[0] ?? null;

  return { columnKey, direction: option.direction };
}

export function useTableColumnSort<TField extends string>(
  sortKey: string,
  setSortKey: (key: string) => void,
  sortOptions: ListSortOption<TField>[],
  columnMap: Record<string, TField>,
) {
  const { columnKey, direction } = sortKeyToColumnState(sortKey, sortOptions, columnMap);

  const onSortColumn = useCallback(
    (columnKeyClicked: string) => {
      setSortKey(resolveTableColumnSort(columnKeyClicked, sortKey, sortOptions, columnMap));
    },
    [columnMap, setSortKey, sortKey, sortOptions],
  );

  return { sortColumnKey: columnKey, sortDirection: direction, onSortColumn };
}
