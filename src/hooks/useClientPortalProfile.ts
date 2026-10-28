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
  const scope = JSON.stringify([tenantId, actorId, roleKey, clientId]);
  // A family grant names individual content capabilities, not the client's
  // complete demographic, insurance or clinical profile.
  const profileAllowed = roleKey !== 'family_portal';

  const profileQuery = useAsyncQuery(
    () => fetchClientPortalProfile(queryParams),
    [actorId, tenantId, clientId, roleKey],
    { enabled: profileAllowed && isLinkedReady && !!actorId && !!roleKey && !!clientId, queryKey: `profile:${scope}` },
  );

  const carePlanQuery = useAsyncQuery(
    () => fetchClientCarePlanSummaries(queryParams),
    [actorId, tenantId, clientId, roleKey],
    { enabled: profileAllowed && isLinkedReady && !!actorId && !!roleKey && !!clientId, queryKey: `care-plans:${scope}` },
  );

  const refresh = useCallback(async () => {
    await Promise.all([profileQuery.refresh(), carePlanQuery.refresh()]);
  }, [profileQuery, carePlanQuery]);

  const profileData = profileQuery.data;
  const profile: PortalClientProfile | null = profileData?.profile ?? null;
  const portalAccess: ClientPortalAccessSummary | null = profileData?.portalAccess ?? null;
  const profileError = profileQuery.error ?? profileQuery.refreshError;
  const carePlanError = carePlanQuery.error ?? carePlanQuery.refreshError;

  return {
    profile,
    portalAccess,
    carePlans: carePlanQuery.data ?? [],
    loading: isResolvingClientLink || profileQuery.loading || carePlanQuery.loading,
    error:
      profileError || carePlanError
        ? toPortalUserFacingError(
            profileError ?? carePlanError,
            'Ihr Profil konnte gerade nicht vollständig geladen werden. Bitte versuchen Sie es erneut.',
          )
        : null,
    carePlanError: carePlanError ? toPortalUserFacingError(carePlanError,
      'Ihre Pflegepläne konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.') : null,
    refresh,
    isReady,
    missingClientLink: isReady && !isResolvingClientLink && !clientId,
  };
}
