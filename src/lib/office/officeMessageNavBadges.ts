import { formatNavBadgeLabel } from '@/lib/navigation/navBadgeLabel';
import {
  filterThreadsByAudience,
  isNewChat,
  parseOfficeMessageAudience,
  threadAudience,
} from '@/lib/office/officemessengerfilters';
import type { OfficeMessageNavMessengerView } from '@/lib/office/officeMessageNavBadgeSeenStore';
import type { OfficeMessageAudience, OfficeMessageThread } from '@/types/office/messaging';

export type OfficeMessageNavBadgeCounts = {
  total: number;
  clients: number;
  employees: number;
  internal: number;
};

export const OFFICE_MESSAGE_NAV_BADGE_KEYS = {
  messages: 'total',
  'messages-clients': 'clients',
  'messages-employees': 'employees',
  'messages-internal': 'internal',
} as const satisfies Record<string, keyof OfficeMessageNavBadgeCounts>;

export type OfficeMessageNavRouteContext = {
  /** Nav keys whose badges are hidden while the user is on this route. */
  activeNavKeys: readonly string[];
  /** Audiences whose current new threads are marked seen for the session. */
  seenAudiences: readonly OfficeMessageAudience[];
};

function firstSearchParam(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export function officeMessageAudienceNavKey(audience: OfficeMessageAudience): string {
  switch (audience) {
    case 'clients':
      return 'messages-clients';
    case 'employees':
      return 'messages-employees';
    case 'internal':
      return 'messages-internal';
  }
}

export function resolveOfficeMessageNavRouteContext(
  pathname: string,
  params: Record<string, unknown> = {},
): OfficeMessageNavRouteContext | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  if (path !== '/office/messages') return null;

  const view = firstSearchParam(params.view) ?? firstSearchParam(params.tab);
  if (view === 'broadcasts') {
    return { activeNavKeys: ['messages'], seenAudiences: [] };
  }

  const audience = parseOfficeMessageAudience(
    firstSearchParam(params.audience) ?? firstSearchParam(params.filter),
  );

  return {
    activeNavKeys: ['messages', officeMessageAudienceNavKey(audience)],
    seenAudiences: [audience],
  };
}

export function resolveOfficeMessageNavMessengerContext(
  pathname: string,
  messengerView: OfficeMessageNavMessengerView | null,
): OfficeMessageNavRouteContext | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  if (path !== '/office/messages' || !messengerView) return null;

  if (messengerView.view === 'broadcasts') {
    return { activeNavKeys: ['messages'], seenAudiences: [] };
  }

  return {
    activeNavKeys: ['messages', officeMessageAudienceNavKey(messengerView.audience)],
    seenAudiences: [messengerView.audience],
  };
}

export function resolveOfficeMessageNavBadgeContext(
  pathname: string,
  params: Record<string, unknown> = {},
  messengerView: OfficeMessageNavMessengerView | null = null,
): OfficeMessageNavRouteContext | null {
  return (
    resolveOfficeMessageNavMessengerContext(pathname, messengerView) ??
    resolveOfficeMessageNavRouteContext(pathname, params)
  );
}

export function computeOfficeMessageNavBadgeCounts(
  threads: OfficeMessageThread[],
  seenThreadIds?: ReadonlySet<string>,
): OfficeMessageNavBadgeCounts {
  const newThreads = threads
    .filter(isNewChat)
    .filter((thread) => !seenThreadIds?.has(thread.id));

  return {
    total: newThreads.length,
    clients: filterThreadsByAudience(newThreads, 'clients').length,
    employees: filterThreadsByAudience(newThreads, 'employees').length,
    internal: filterThreadsByAudience(newThreads, 'internal').length,
  };
}

export function applyOfficeMessageNavBadgeRouteOverrides(
  counts: OfficeMessageNavBadgeCounts,
  activeNavKeys?: ReadonlySet<string>,
): OfficeMessageNavBadgeCounts {
  if (!activeNavKeys?.size) return counts;

  const next = { ...counts };
  for (const [key, field] of Object.entries(OFFICE_MESSAGE_NAV_BADGE_KEYS)) {
    if (activeNavKeys.has(key)) {
      next[field as keyof OfficeMessageNavBadgeCounts] = 0;
    }
  }
  return next;
}

export function collectOfficeMessageNavSeenThreadIds(
  threads: OfficeMessageThread[],
  audiences: readonly OfficeMessageAudience[],
): string[] {
  if (audiences.length === 0) return [];
  const audienceSet = new Set(audiences);
  return threads
    .filter(isNewChat)
    .filter((thread) => audienceSet.has(threadAudience(thread)))
    .map((thread) => thread.id);
}

export function resolveOfficeMessageNavBadge(
  itemKey: string,
  counts: OfficeMessageNavBadgeCounts,
): string | undefined {
  const field = OFFICE_MESSAGE_NAV_BADGE_KEYS[itemKey as keyof typeof OFFICE_MESSAGE_NAV_BADGE_KEYS];
  if (!field) return undefined;
  return formatNavBadgeLabel(counts[field]);
}

export function buildOfficeMessageNavBadges(
  counts: OfficeMessageNavBadgeCounts,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.keys(OFFICE_MESSAGE_NAV_BADGE_KEYS).map((key) => [
      key,
      resolveOfficeMessageNavBadge(key, counts),
    ]),
  );
}
