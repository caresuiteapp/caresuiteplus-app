import { useCallback, useState } from 'react';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { fetchPortalDocuments } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from './core';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';
import {
  isRoleAllowedForPortalAudience,
  type OperationalPortalAudience,
} from '@/lib/portal/portalAudience';

export function usePortalDocuments(audience: OperationalPortalAudience) {
  const {
    tenantId,
    clientId,
    actorId,
    roleKey,
    isLinkedReady,
    isResolvingClientLink,
  } = usePortalActor();
  const profileId = actorId ?? '';
  const [showSuccess, setShowSuccess] = useState(false);
  const roleMatchesAudience = isRoleAllowedForPortalAudience(roleKey, audience);
  const scopedRoleKey = roleMatchesAudience ? roleKey : null;
  const scopedClientId = audience === 'client' && roleMatchesAudience ? clientId : null;

  const query = useAsyncQuery(
    () =>
      fetchPortalDocuments(profileId, scopedRoleKey, {
        tenantId,
        clientId: scopedClientId,
      }),
    [profileId, scopedRoleKey, tenantId, scopedClientId],
    {
      enabled:
        isLinkedReady &&
        roleMatchesAudience &&
        (audience !== 'client' || Boolean(scopedClientId)),
    },
  );

  const items = query.data ?? [];

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    items,
    loading: isResolvingClientLink || query.loading,
    error: !roleMatchesAudience && roleKey
      ? 'Diese Sitzung gehört zu einem anderen Portal.'
      : audience === 'client' && !isResolvingClientLink && !scopedClientId
      ? 'Ihr Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
      : query.error
      ? toPortalUserFacingError(
          query.error,
          'Ihre Dokumente konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
        )
      : null,
    refreshing: query.refreshing,
    showSuccess,
    refresh,
    isEmpty:
      isLinkedReady &&
      roleMatchesAudience &&
      !query.loading &&
      !query.error &&
      items.length === 0,
  };
}

export type { PortalDocumentListItem };
