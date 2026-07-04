import { useEffect, useRef } from 'react';
import { prefetchEmployeeAssignmentCache, readAssignmentListCache } from '@/lib/offline/assignmentCacheService';
import { useHydrated } from './useHydrated';
import { useConnectivity } from './useConnectivity';
import { usePortalActor } from './usePortalActor';

/**
 * OFFLINE.3 — prefetch assignment list + near-term details when MP is online.
 * Retries when the scoped list cache becomes available (covers list-after-shell race).
 */
export function useOfflineAssignmentPrefetch(): void {
  const hydrated = useHydrated();
  const { isOffline } = useConnectivity();
  const { tenantId, employeeId, actorId, roleKey, isLinkedReady } = usePortalActor();
  const lastWarmKeyRef = useRef<string | null>(null);
  const lastDetailKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !isLinkedReady || isOffline) return;
    if (!tenantId?.trim() || !employeeId?.trim() || !actorId || !roleKey) return;

    const key = `${tenantId}:${employeeId}:${actorId}`;

    if (lastWarmKeyRef.current !== key) {
      lastWarmKeyRef.current = key;
      lastDetailKeyRef.current = null;
      void prefetchEmployeeAssignmentCache(actorId, roleKey, tenantId, employeeId);
      return;
    }

    void (async () => {
      const cached = await readAssignmentListCache(tenantId, employeeId);
      if (!cached?.items.length) return;

      const detailKey = `${key}:${cached.cachedAt}:${cached.items.length}`;
      if (lastDetailKeyRef.current === detailKey) return;
      lastDetailKeyRef.current = detailKey;

      const { scheduleAssignmentDetailPrefetch } = await import(
        '@/lib/offline/assignmentDetailPrefetch'
      );
      scheduleAssignmentDetailPrefetch(actorId, roleKey, tenantId, employeeId, cached.items);
    })();
  }, [hydrated, isLinkedReady, isOffline, tenantId, employeeId, actorId, roleKey]);
}
