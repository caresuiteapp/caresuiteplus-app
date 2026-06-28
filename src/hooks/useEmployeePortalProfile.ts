import { useCallback } from 'react';
import { fetchEmployeePortalProfile, fetchEmployeeTimesheet } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { useAsyncQuery } from './core';

export function useEmployeePortalProfile() {
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

  const profileQuery = useAsyncQuery(
    () => fetchEmployeePortalProfile(profileId, roleKey, portalContext),
    [profileId, roleKey, tenantId, employeeId],
    { enabled: isReady && !!profileId && !!roleKey, live: liveConfig },
  );

  const timesheetQuery = useAsyncQuery(
    () => fetchEmployeeTimesheet(profileId, roleKey, portalContext),
    [profileId, roleKey, tenantId, employeeId],
    { enabled: isReady && !!profileId && !!roleKey, live: liveConfig },
  );

  const refresh = useCallback(async () => {
    await Promise.all([profileQuery.refresh(), timesheetQuery.refresh()]);
  }, [profileQuery, timesheetQuery]);

  return {
    profile: profileQuery.data,
    timesheet: timesheetQuery.data ?? [],
    loading: profileQuery.loading || timesheetQuery.loading,
    error: profileQuery.error ?? timesheetQuery.error,
    refresh,
    missingEmployeeLink: isReady && !employeeId,
    isLiveConnected: profileQuery.isLiveConnected || timesheetQuery.isLiveConnected,
  };
}
