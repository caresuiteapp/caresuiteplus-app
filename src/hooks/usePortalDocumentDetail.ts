import { useCallback } from 'react';
import { Linking } from 'react-native';
import { downloadPortalDocument, fetchPortalDocumentDetail } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { isDemoMode } from '@/lib/supabase/config';
import { useAsyncQuery, useMutation } from './core';
import {
  isRoleAllowedForPortalAudience,
  type OperationalPortalAudience,
} from '@/lib/portal/portalAudience';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

export function usePortalDocumentDetail(
  documentId: string | undefined,
  audience: OperationalPortalAudience,
) {
  const {
    tenantId,
    clientId,
    actorId,
    roleKey,
    isLinkedReady,
    isResolvingClientLink,
  } = usePortalActor();
  const profileId = actorId ?? '';
  const roleMatchesAudience = isRoleAllowedForPortalAudience(roleKey, audience);
  const scopedRoleKey = roleMatchesAudience ? roleKey : null;
  const scopedClientId = audience === 'client' && roleMatchesAudience ? clientId : null;

  const query = useAsyncQuery(
    () =>
      fetchPortalDocumentDetail(documentId ?? '', profileId, scopedRoleKey, {
        tenantId,
        clientId: scopedClientId,
      }),
    [documentId, profileId, scopedRoleKey, tenantId, scopedClientId],
    {
      enabled:
        !!documentId &&
        isLinkedReady &&
        roleMatchesAudience &&
        (audience !== 'client' || Boolean(scopedClientId)),
    },
  );

  const downloadMutation = useMutation(
    (_: null) =>
      downloadPortalDocument(documentId ?? '', profileId, scopedRoleKey, {
        tenantId,
        clientId: scopedClientId,
      }),
    {
      successMessage: isDemoMode() ? 'Download vorbereitet.' : 'Download gestartet.',
      onSuccess: async (data) => {
        if (data.downloadUrl) {
          await Linking.openURL(data.downloadUrl);
        }
      },
    },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  const download = useCallback(async () => {
    return downloadMutation.mutate(null);
  }, [downloadMutation]);

  return {
    data: query.data,
    loading: isResolvingClientLink || query.loading,
    error: !roleMatchesAudience && roleKey
      ? 'Diese Sitzung gehört zu einem anderen Portal.'
      : audience === 'client' && !isResolvingClientLink && !scopedClientId
        ? 'Ihr Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
        : query.error
          ? toPortalUserFacingError(
              query.error,
              'Das Dokument konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
            )
          : null,
    refresh,
    download,
    downloadLoading: downloadMutation.loading,
    downloadError: downloadMutation.error
      ? toPortalUserFacingError(
          downloadMutation.error,
          'Der Download konnte gerade nicht gestartet werden. Bitte versuchen Sie es erneut.',
        )
      : null,
    successMessage: downloadMutation.successMessage,
    notFound:
      isLinkedReady &&
      !query.loading &&
      !query.error &&
      !query.data &&
      !!documentId,
  };
}
