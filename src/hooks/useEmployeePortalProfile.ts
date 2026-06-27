import { useCallback } from 'react';
import { fetchEmployeePortalProfile, fetchEmployeeTimesheet } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from './core';

export function useEmployeePortalProfile() {
  const { tenantId, employeeId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';

  const portalContext = { tenantId, employeeId };

  const profileQuery = useAsyncQuery(
    () => fetchEmployeePortalProfile(profileId, roleKey, portalContext),
    [profileId, roleKey, tenantId, employeeId],
    { enabled: isReady && !!profileId && !!roleKey },
  );

  const timesheetQuery = useAsyncQuery(
    () => fetchEmployeeTimesheet(profileId, roleKey, portalContext),
    [profileId, roleKey, tenantId, employeeId],
    { enabled: isReady && !!profileId && !!roleKey },
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
  };
}
