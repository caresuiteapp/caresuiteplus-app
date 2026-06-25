import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import {
  applyOfficeMessageNavBadgeRouteOverrides,
  buildOfficeMessageNavBadges,
  collectOfficeMessageNavSeenThreadIds,
  computeOfficeMessageNavBadgeCounts,
  resolveOfficeMessageNavBadgeContext,
} from '@/lib/office/officeMessageNavBadges';
import {
  getSeenOfficeMessageNavThreadIds,
  getOfficeMessageNavBadgeMessengerView,
  markOfficeMessageNavThreadsSeen,
  subscribeOfficeMessageNavBadgeSeenStore,
} from '@/lib/office/officeMessageNavBadgeSeenStore';
import { fetchOfficeMessageNavBadgeData } from '@/lib/office/messagethreadservice';
import { subscribeToOfficeMessageInbox } from '@/lib/office/officemessagerealtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useOfficeMessageNavBadges(enabled = true) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const [seenRevision, setSeenRevision] = useState(0);

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

  useEffect(() => {
    return subscribeOfficeMessageNavBadgeSeenStore(() => {
      setSeenRevision((value) => value + 1);
    });
  }, []);

  const newThreads = query.data?.newThreads ?? [];
  const routeContext = useMemo(
    () =>
      resolveOfficeMessageNavBadgeContext(
        pathname,
        params,
        getOfficeMessageNavBadgeMessengerView(),
      ),
    [pathname, params, seenRevision],
  );

  useEffect(() => {
    if (!enabled || !tenantId || !routeContext?.seenAudiences.length) return;
    const threadIds = collectOfficeMessageNavSeenThreadIds(newThreads, routeContext.seenAudiences);
    markOfficeMessageNavThreadsSeen(tenantId, threadIds);
  }, [enabled, tenantId, routeContext, newThreads]);

  const seenThreadIds = useMemo(() => {
    if (!tenantId) return new Set<string>();
    return getSeenOfficeMessageNavThreadIds(tenantId);
  }, [tenantId, seenRevision]);

  const counts = useMemo(() => {
    const base = computeOfficeMessageNavBadgeCounts(newThreads, seenThreadIds);
    const activeNavKeys = routeContext ? new Set(routeContext.activeNavKeys) : undefined;
    return applyOfficeMessageNavBadgeRouteOverrides(base, activeNavKeys);
  }, [newThreads, seenThreadIds, routeContext]);

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
