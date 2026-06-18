import { useCallback } from 'react';
import { fetchClientCarePlanSummaries, fetchClientPortalProfile } from '@/lib/portal';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useClientPortalProfile() {
  const { profile } = useAuth();
  const profileId = profile?.id ?? '';
  const roleKey = profile?.roleKey ?? null;

  const profileQuery = useAsyncQuery(
    () => fetchClientPortalProfile(profileId, roleKey),
    [profileId, roleKey],
    { enabled: !!profileId && !!roleKey },
  );

  const carePlanQuery = useAsyncQuery(
    () => fetchClientCarePlanSummaries(profileId, roleKey),
    [profileId, roleKey],
    { enabled: !!profileId && !!roleKey },
  );

  const refresh = useCallback(async () => {
    await Promise.all([profileQuery.refresh(), carePlanQuery.refresh()]);
  }, [profileQuery, carePlanQuery]);

  return {
    profile: profileQuery.data,
    carePlans: carePlanQuery.data ?? [],
    loading: profileQuery.loading || carePlanQuery.loading,
    error: profileQuery.error ?? carePlanQuery.error,
    refresh,
  };
}
