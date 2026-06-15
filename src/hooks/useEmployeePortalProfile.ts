import { useCallback } from 'react';
import { fetchEmployeePortalProfile, fetchEmployeeTimesheet } from '@/lib/portal';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useEmployeePortalProfile() {
  const { profile } = useAuth();
  const profileId = profile?.id ?? '';
  const roleKey = profile?.roleKey ?? null;

  const profileQuery = useAsyncQuery(
    () => fetchEmployeePortalProfile(profileId, roleKey),
    [profileId, roleKey],
    { enabled: !!profileId && !!roleKey },
  );

  const timesheetQuery = useAsyncQuery(
    () => fetchEmployeeTimesheet(profileId, roleKey),
    [profileId, roleKey],
    { enabled: !!profileId && !!roleKey },
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
  };
}
