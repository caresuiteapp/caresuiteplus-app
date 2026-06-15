import type { ListSortDirection, PaginatedResult } from '@/types/list';

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function filterBySearch<T extends Record<string, unknown>>(
  items: T[],
  query: string,
  fields: (keyof T)[],
): T[] {
  const q = normalizeSearch(query);
  if (!q) return items;
  return items.filter((item) =>
    fields.some((field) => {
      const val = item[field];
      return typeof val === 'string' && val.toLowerCase().includes(q);
    }),
  );
}

export function filterByField<T extends Record<string, unknown>, K extends keyof T>(
  items: T[],
  field: K,
  value: string | 'all',
): T[] {
  if (value === 'all') return items;
  return items.filter((item) => String(item[field]) === value);
}

export function sortItems<T extends Record<string, unknown>>(
  items: T[],
  field: keyof T,
  direction: ListSortDirection,
): T[] {
  const sorted = [...items].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const aStr = av == null ? '' : String(av);
    const bStr = bv == null ? '' : String(bv);
    return aStr.localeCompare(bStr, 'de');
  });
  return direction === 'desc' ? sorted.reverse() : sorted;
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const total = items.length;
  const end = page * pageSize;
  return {
    items: items.slice(0, end),
    total,
    page,
    pageSize,
    hasMore: end < total,
  };
}
