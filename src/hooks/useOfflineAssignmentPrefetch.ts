import { useEffect, useRef } from 'react';
import { prefetchEmployeeAssignmentCache } from '@/lib/offline/assignmentCacheService';
import { useHydrated } from './useHydrated';
import { useConnectivity } from './useConnectivity';
import { usePortalActor } from './usePortalActor';

/**
 * OFFLINE.2 — prefetch assignment list + near-term details when MP is online.
 */
export function useOfflineAssignmentPrefetch(): void {
  const hydrated = useHydrated();
  const { isOffline } = useConnectivity();
  const { tenantId, employeeId, actorId, roleKey, isLinkedReady } = usePortalActor();
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !isLinkedReady || isOffline) return;
    if (!tenantId?.trim() || !employeeId?.trim() || !actorId || !roleKey) return;

    const key = `${tenantId}:${employeeId}:${actorId}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    void prefetchEmployeeAssignmentCache(actorId, roleKey, tenantId, employeeId);
  }, [hydrated, isLinkedReady, isOffline, tenantId, employeeId, actorId, roleKey]);
}
