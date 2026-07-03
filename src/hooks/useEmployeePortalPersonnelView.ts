import { useCallback } from 'react';
import { fetchEmployeePortalPersonnelView } from '@/lib/portal/employeePortalPersonnelService';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { useAsyncQuery } from './core';

export function useEmployeePortalPersonnelView() {
  const { tenantId, employeeId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';

  const portalContext = { tenantId, employeeId };

  const liveConfig =
    tenantId && employeeId
      ? {
          tenantId,
          subscribe: (tid: string, handler: () => void) =>
            subscribeToEmployeePortalChanges(tid, employeeId, handler),
        }
      : undefined;

  const query = useAsyncQuery(
    () => fetchEmployeePortalPersonnelView(profileId, roleKey, portalContext),
    [profileId, roleKey, tenantId, employeeId],
    { enabled: isReady && !!profileId && !!roleKey && !!employeeId, live: liveConfig },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    personnelView: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    isLiveConnected: query.isLiveConnected,
  };
}
