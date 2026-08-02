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

export function usePortalDocumentDetail(
  documentId: string | undefined,
  audience: OperationalPortalAudience,
) {
  const { tenantId, clientId, actorId, roleKey, isReady } = usePortalActor();
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
    { enabled: !!documentId && isReady && roleMatchesAudience },
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
    loading: query.loading,
    error: !roleMatchesAudience && roleKey
      ? 'Diese Sitzung gehört zu einem anderen Portal.'
      : query.error,
    refresh,
    download,
    downloadLoading: downloadMutation.loading,
    downloadError: downloadMutation.error,
    successMessage: downloadMutation.successMessage,
    notFound: !query.loading && !query.error && !query.data && !!documentId,
  };
}
