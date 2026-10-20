export type ListSortDirection = 'asc' | 'desc';

export type ListSortOption<TField extends string = string> = {
  key: string;
  label: string;
  field: TField;
  direction: ListSortDirection;
};

export type ListFilterOption<TKey extends string = string> = {
  key: TKey;
  label: string;
};

export type ListQueryState<TFilter extends string = string> = {
  search: string;
  filter: TFilter | 'all';
  sortKey: string;
  page: number;
  pageSize: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};
