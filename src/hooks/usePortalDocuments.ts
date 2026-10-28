import { useCallback, useEffect, useState } from 'react';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { fetchPortalDocuments } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from './core';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';
import {
  isRoleAllowedForPortalAudience,
  type OperationalPortalAudience,
} from '@/lib/portal/portalAudience';
import { familyPortalAllows } from '@/lib/portal/familyPortalAccessScope';

export function usePortalDocuments(audience: OperationalPortalAudience) {
  const {
    tenantId,
    clientId,
    employeeId,
    actorId,
    roleKey,
    isLinkedReady,
    isResolvingClientLink,
    isResolvingEmployeeLink,
    familyAccess,
  } = usePortalActor();
  const profileId = actorId ?? '';
  const [showSuccess, setShowSuccess] = useState(false);
  const roleMatchesAudience = isRoleAllowedForPortalAudience(roleKey, audience);
  const scopedRoleKey = roleMatchesAudience ? roleKey : null;
  const scopedClientId = audience === 'client' && roleMatchesAudience ? clientId : null;
  const scopedEmployeeId = audience === 'employee' && roleMatchesAudience ? employeeId : null;
  const resolvingLink = audience === 'employee' ? isResolvingEmployeeLink : isResolvingClientLink;
  const familyDocumentsAllowed =
    roleKey !== 'family_portal' || familyPortalAllows(familyAccess, 'documents');
  const scopeKey = JSON.stringify([tenantId, profileId, scopedRoleKey, scopedClientId, scopedEmployeeId, familyDocumentsAllowed]);
  useEffect(() => setShowSuccess(false), [scopeKey]);

  const query = useAsyncQuery(
    () =>
      fetchPortalDocuments(profileId, scopedRoleKey, {
        tenantId,
        clientId: scopedClientId,
        employeeId: scopedEmployeeId,
      }),
    [profileId, scopedRoleKey, tenantId, scopedClientId, scopedEmployeeId],
    {
      queryKey: scopeKey,
      enabled:
        isLinkedReady &&
        roleMatchesAudience &&
        familyDocumentsAllowed &&
        (audience === 'client' ? Boolean(scopedClientId) : Boolean(scopedEmployeeId)),
    },
  );

  const items = query.data ?? [];

  const refresh = useCallback(async () => {
    const succeeded = await query.refreshWithResult();
    setShowSuccess(succeeded);
  }, [query]);

  return {
    items,
    loading: resolvingLink || query.loading,
    error: !roleMatchesAudience && roleKey
      ? 'Diese Sitzung gehört zu einem anderen Portal.'
      : audience === 'client' && !isResolvingClientLink && !scopedClientId
      ? 'Ihr Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
      : audience === 'employee' && !resolvingLink && !scopedEmployeeId
      ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
            : roleKey === 'family_portal' && !familyDocumentsAllowed
      ? 'Dokumente sind für diesen Angehörigenzugang nicht freigegeben.'
      : (query.error ?? query.refreshError)
      ? toPortalUserFacingError(
          (query.error ?? query.refreshError)!,
          'Ihre Dokumente konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
        )
      : null,
    refreshing: query.refreshing,
    showSuccess,
    refresh,
    isEmpty:
      isLinkedReady &&
      roleMatchesAudience &&
      (audience === 'client' ? Boolean(scopedClientId) : Boolean(scopedEmployeeId)) &&
      !query.loading &&
      !query.error &&
      !query.refreshError &&
      items.length === 0,
  };
}

export type { PortalDocumentListItem };
