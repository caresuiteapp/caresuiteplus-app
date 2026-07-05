import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalSignatureStorageUrl } from '@/lib/portal/portalDocumentSignatureService';

export function usePortalSignatureSourcePdf(storagePath: string | null | undefined) {
  const { profile } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath?.trim()) {
      setUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void resolvePortalSignatureStorageUrl(storagePath, profile?.roleKey ?? null).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setUrl(result.data);
      } else {
        setUrl(null);
        setError(result.error ?? 'PDF-Vorschau nicht verfügbar.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [storagePath, profile?.roleKey]);

  return { url, loading, error };
}
