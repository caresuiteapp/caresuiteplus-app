import { useCallback } from 'react';
import { fetchClientCarePlanSummaries, fetchClientPortalProfile } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from './core';

export function useClientPortalProfile() {
  const actor = usePortalActor();

  const profileQuery = useAsyncQuery(
    () =>
      fetchClientPortalProfile(actor.actorId ?? '', actor.roleKey, {
        clientId: actor.clientId,
        tenantId: actor.tenantId,
      }),
    [actor.actorId, actor.roleKey, actor.clientId, actor.tenantId],
    { enabled: actor.isReady },
  );

  const carePlanQuery = useAsyncQuery(
    () => fetchClientCarePlanSummaries(actor.actorId ?? '', actor.roleKey, { clientId: actor.clientId }),
    [actor.actorId, actor.roleKey, actor.clientId],
    { enabled: actor.isReady },
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
