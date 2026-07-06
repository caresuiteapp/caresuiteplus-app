import { useCallback, useMemo, useState } from 'react';
import type { PortalAppointmentItem } from '@/lib/portal';
import { loadPortalAppointmentsWithCache } from '@/lib/offline/assignmentCacheService';
import type { AssignmentCacheMeta } from '@/lib/offline/types';
import { useConnectivity } from '@/hooks/useConnectivity';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges, subscribeToPortalAssistChanges } from '@/lib/realtime';
import { useAsyncQuery } from './core';

export function usePortalAppointments() {
  const { tenantId, clientId, employeeId, actorId, roleKey, isLinkedReady } = usePortalActor();
  const { isOffline } = useConnectivity();
  const profileId = actorId ?? '';
  const [showSuccess, setShowSuccess] = useState(false);
  const [cacheMeta, setCacheMeta] = useState<AssignmentCacheMeta>({
    fromCache: false,
    cachedAt: null,
  });

  const liveConfig = useMemo(() => {
    if (!tenantId) return undefined;
    if (employeeId) {
      return {
        tenantId,
        subscribe: (tid: string, handler: () => void) =>
          subscribeToEmployeePortalChanges(tid, employeeId, handler),
      };
    }
    if (clientId) {
      return {
        tenantId,
        subscribe: (tid: string, handler: () => void) =>
          subscribeToPortalAssistChanges(tid, clientId, handler),
      };
    }
    return undefined;
  }, [tenantId, employeeId, clientId]);

  const query = useAsyncQuery(
    async () => {
      const result = await loadPortalAppointmentsWithCache(
        profileId,
        roleKey,
        tenantId,
        employeeId,
        clientId,
        { preferCache: isOffline },
      );
      setCacheMeta({ fromCache: result.fromCache, cachedAt: result.cachedAt });
      return result;
    },
    [profileId, roleKey, tenantId, clientId, employeeId, isOffline],
    { enabled: isLinkedReady, live: liveConfig },
  );

  const items = query.data ?? [];

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    items,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    refresh,
    isEmpty: !query.loading && !query.error && items.length === 0,
    isLiveConnected: query.isLiveConnected,
    fromCache: cacheMeta.fromCache,
    cachedAt: cacheMeta.cachedAt,
  };
}

export type { PortalAppointmentItem };
