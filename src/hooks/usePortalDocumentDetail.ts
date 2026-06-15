import { useCallback } from 'react';
import { downloadPortalDocument, fetchPortalDocumentDetail } from '@/lib/portal';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';

export function usePortalDocumentDetail(documentId: string | undefined) {
  const { profile } = useAuth();
  const profileId = profile?.id ?? '';
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => fetchPortalDocumentDetail(documentId ?? '', profileId, roleKey),
    [documentId, profileId, roleKey],
    { enabled: !!documentId && !!profileId && !!roleKey },
  );

  const downloadMutation = useMutation(
    (_: null) => downloadPortalDocument(documentId ?? '', profileId, roleKey),
    { successMessage: 'Download vorbereitet (Demo).' },
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
