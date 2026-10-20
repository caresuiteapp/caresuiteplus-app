import { fetchQmDocument, fetchQmDocumentVersions, fetchQmReadConfirmations } from '@/lib/qm';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useQmDocumentDetail(documentId: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const document = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmDocument(tenantId, documentId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey, documentId],
    { enabled: !!tenantId && !!documentId },
  );

  const versions = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmDocumentVersions(tenantId, documentId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey, documentId],
    { enabled: !!tenantId && !!documentId },
  );

  const confirmations = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmReadConfirmations(tenantId, documentId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey, documentId],
    { enabled: !!tenantId && !!documentId },
  );

  return {
    document: document.data,
    versions: versions.data ?? [],
    confirmations: confirmations.data ?? [],
    loading: document.loading || versions.loading,
    error: document.error ?? versions.error,
    refresh: async () => {
      await Promise.all([document.refresh(), versions.refresh(), confirmations.refresh()]);
    },
  };
}
