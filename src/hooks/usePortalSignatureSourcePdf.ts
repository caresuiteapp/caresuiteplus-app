import { useEffect, useState } from 'react';
import { usePortalActor } from '@/hooks/usePortalActor';
import { resolvePortalSignatureStorageUrl } from '@/lib/portal/portalDocumentSignatureService';

export function usePortalSignatureSourcePdf(storagePath: string | null | undefined, documentId: string) {
  const { roleKey, tenantId, employeeId, isLinkedReady } = usePortalActor();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath?.trim() || !tenantId || !employeeId || !isLinkedReady) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);

    void resolvePortalSignatureStorageUrl(storagePath, roleKey, { tenantId, employeeId, documentId }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setUrl(result.data);
      } else {
        setUrl(null);
        setError(result.error ?? 'PDF-Vorschau nicht verfügbar.');
      }
    }).catch(() => {
      if (!cancelled) { setLoading(false); setUrl(null); setError('Das Dokument konnte gerade nicht geöffnet werden. Bitte erneut versuchen.'); }
    });

    return () => {
      cancelled = true;
    };
  }, [storagePath, roleKey, tenantId, employeeId, documentId, isLinkedReady]);

  return { url, loading, error };
}
