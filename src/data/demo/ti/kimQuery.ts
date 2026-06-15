import type { KIMMessageListItem, KIMMailboxQuery, KIMMailboxResult } from '@/types/modules/ti';
import { filterBySearch, paginateItems } from '@/lib/list';

const DEFAULT_PAGE_SIZE = 10;

/** Server-side filter/search/pagination logic (demo + Supabase-ready) */
export function queryKIMMailbox(
  messages: KIMMessageListItem[],
  query: KIMMailboxQuery,
): KIMMailboxResult {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = query.page ?? 1;
  const sortDirection = query.sortDirection ?? 'desc';

  let filtered = [...messages];

  if (query.mailboxId) {
    filtered = filtered.filter((m) => m.mailboxId === query.mailboxId);
  }

  if (query.status && query.status !== 'all') {
    filtered = filtered.filter((m) => m.status === query.status);
  }

  if (query.search?.trim()) {
    filtered = filterBySearch(filtered, query.search, ['sender', 'senderName', 'subject']);
  }

  filtered.sort((a, b) => {
    const diff = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    return sortDirection === 'desc' ? -diff : diff;
  });

  const paginated = paginateItems(filtered, page, pageSize);

  return {
    items: paginated.items,
    totalCount: messages.length,
    filteredCount: filtered.length,
    page,
    pageSize,
    hasMore: paginated.hasMore,
  };
}

export const KIM_STATUS_FILTERS = [
  { key: 'all' as const, label: 'Alle' },
  { key: 'unread' as const, label: 'Ungelesen' },
  { key: 'archived' as const, label: 'Archiviert' },
  { key: 'error' as const, label: 'Fehlerhaft' },
];

export const KIM_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
