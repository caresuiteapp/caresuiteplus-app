import { useCallback } from 'react';
import { Linking } from 'react-native';
import { downloadPortalDocument, fetchPortalDocumentDetail } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { isDemoMode } from '@/lib/supabase/config';
import { useAsyncQuery, useMutation } from './core';

export function usePortalDocumentDetail(documentId: string | undefined) {
  const { tenantId, clientId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';

  const query = useAsyncQuery(
    () =>
      fetchPortalDocumentDetail(documentId ?? '', profileId, roleKey, {
        tenantId,
        clientId,
      }),
    [documentId, profileId, roleKey, tenantId, clientId],
    { enabled: !!documentId && isReady },
  );

  const downloadMutation = useMutation(
    (_: null) =>
      downloadPortalDocument(documentId ?? '', profileId, roleKey, {
        tenantId,
        clientId,
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
    error: query.error,
    refresh,
    download,
    downloadLoading: downloadMutation.loading,
    downloadError: downloadMutation.error,
    successMessage: downloadMutation.successMessage,
    notFound: !query.loading && !query.error && !query.data && !!documentId,
  };
}
