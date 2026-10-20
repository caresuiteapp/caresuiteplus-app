import { useCallback, useState } from 'react';
import type { MessageListItem } from '@/types/portal/communication';
import { fetchPortalMessages } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from './core';
import {
  isRoleAllowedForPortalAudience,
  type OperationalPortalAudience,
} from '@/lib/portal/portalAudience';

export function useMessages(audience: OperationalPortalAudience) {
  const { actorId, roleKey } = usePortalActor();
  const profileId = actorId ?? '';
  const roleMatchesAudience = isRoleAllowedForPortalAudience(roleKey, audience);
  const scopedRoleKey = roleMatchesAudience ? roleKey : null;
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => fetchPortalMessages(profileId, scopedRoleKey),
    [profileId, scopedRoleKey],
    { enabled: !!profileId && !!scopedRoleKey },
  );

  const items = query.data ?? [];
  const unreadCount = items.filter((m) => !m.readAt).length;

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    items,
    unreadCount,
    loading: query.loading,
    error: !roleMatchesAudience && roleKey
      ? 'Diese Sitzung gehört zu einem anderen Portal.'
      : query.error,
    refreshing: query.refreshing,
    showSuccess,
    refresh,
    isEmpty: !query.loading && !query.error && items.length === 0,
  };
}

export type { MessageListItem };
