import { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  buildOfficeMessageNavBadges,
  computeOfficeMessageNavBadgeCounts,
} from '@/lib/office/officeMessageNavBadges';
import { fetchOfficeMessageNavBadgeData } from '@/lib/office/messagethreadservice';
import { subscribeToOfficeMessageInbox } from '@/lib/office/officemessagerealtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useOfficeMessageNavBadges(enabled = true) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeMessageNavBadgeData(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey, profile?.id],
    { enabled: enabled && Boolean(tenantId) },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  useEffect(() => {
    if (!enabled || !tenantId) return;
    const unsubscribe = subscribeToOfficeMessageInbox(tenantId, () => {
      void refresh();
    });
    return unsubscribe;
  }, [enabled, tenantId, refresh]);

  // Badges mirror the persisted unread counters. Merely visiting the inbox must
  // not clear them; the concrete thread read services reset those counters only
  // after a conversation has actually been opened.
  const counts = useMemo(
    () => computeOfficeMessageNavBadgeCounts(query.data?.newThreads ?? []),
    [query.data?.newThreads],
  );

  const badges = useMemo(() => buildOfficeMessageNavBadges(counts), [counts]);

  return {
    badges,
    counts,
    loading: query.loading,
    error: query.error,
    refresh,
  };
}

export { computeOfficeMessageNavBadgeCounts };
