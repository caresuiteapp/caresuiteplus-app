import { useCallback } from 'react';
import { Linking } from 'react-native';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery, useMutation } from '@/hooks/core';
import {
  downloadLivePortalDocument,
  fetchEmployeePortalClientDocumentDetail,
} from '@/lib/portal/portalDocumentsLiveService';

export function useEmployeePortalClientDocument(
  clientId: string | undefined,
  documentId: string | null,
) {
  const { tenantId, isReady } = usePortalActor();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !clientId || !documentId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Dokument.' });
      }
      return fetchEmployeePortalClientDocumentDetail(tenantId, clientId, documentId);
    },
    [tenantId, clientId, documentId],
    { enabled: isReady && !!tenantId && !!clientId && !!documentId },
  );

  const downloadMutation = useMutation(
    (_: null) => {
      if (!tenantId || !clientId || !documentId) {
        return Promise.resolve({ ok: false as const, error: 'Download nicht möglich.' });
      }
      return downloadLivePortalDocument(tenantId, clientId, documentId);
    },
    {
      successMessage: 'Download gestartet.',
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

  const download = useCallback(async () => downloadMutation.mutate(null), [downloadMutation]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    download,
    downloadLoading: downloadMutation.loading,
    downloadError: downloadMutation.error,
    notFound: !query.loading && !query.error && !query.data && !!documentId,
  };
}
