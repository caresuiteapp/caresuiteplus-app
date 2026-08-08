import { useCallback } from 'react';
import { fetchClientCarePlanSummaries, fetchClientPortalProfile } from '@/lib/portal';
import type { ClientPortalAccessSummary } from '@/lib/portal/clientProfileLiveService';
import type { PortalClientProfile } from '@/types/portal/client';
import { usePortalActor } from './usePortalActor';
import { useAsyncQuery } from './core';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

export function useClientPortalProfile() {
  const {
    tenantId,
    clientId,
    actorId,
    roleKey,
    isReady,
    isLinkedReady,
    isResolvingClientLink,
  } = usePortalActor();

  const queryParams = {
    profileId: actorId ?? '',
    tenantId,
    clientId,
    roleKey,
  };

  const profileQuery = useAsyncQuery(
    () => fetchClientPortalProfile(queryParams),
    [actorId, tenantId, clientId, roleKey],
    { enabled: isLinkedReady && !!actorId && !!roleKey && !!clientId },
  );

  const carePlanQuery = useAsyncQuery(
    () => fetchClientCarePlanSummaries(queryParams),
    [actorId, tenantId, clientId, roleKey],
    { enabled: isLinkedReady && !!actorId && !!roleKey && !!clientId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([profileQuery.refresh(), carePlanQuery.refresh()]);
  }, [profileQuery, carePlanQuery]);

  const profileData = profileQuery.data;
  const profile: PortalClientProfile | null = profileData?.profile ?? null;
  const portalAccess: ClientPortalAccessSummary | null = profileData?.portalAccess ?? null;

  return {
    profile,
    portalAccess,
    carePlans: carePlanQuery.data ?? [],
    loading: isResolvingClientLink || profileQuery.loading || carePlanQuery.loading,
    error:
      profileQuery.error || carePlanQuery.error
        ? toPortalUserFacingError(
            profileQuery.error ?? carePlanQuery.error,
            'Ihr Profil konnte gerade nicht vollständig geladen werden. Bitte versuchen Sie es erneut.',
          )
        : null,
    refresh,
    isReady,
    missingClientLink: isReady && !isResolvingClientLink && !clientId,
  };
}
