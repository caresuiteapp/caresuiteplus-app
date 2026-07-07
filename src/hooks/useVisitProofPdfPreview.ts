import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import {
  resolveAssistProofPdfPreviewUrl,
  type AssistProofPdfPreviewResult,
} from '@/lib/assist/assistProofPdfService';
import type { VisitProofSnapshotEnrichment } from '@/lib/assist/visitProofSnapshotPreviewService';

export function useVisitProofPdfPreview(
  tenantId: string | null,
  proof: AssistVisitProofRow | null,
  enrichment?: VisitProofSnapshotEnrichment,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled !== false;
  const [preview, setPreview] = useState<AssistProofPdfPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current && typeof URL !== 'undefined') {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    revokeBlobUrl();
    setPreview(null);

    if (!tenantId || !proof || !enabled) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await resolveAssistProofPdfPreviewUrl(tenantId, proof, enrichment);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? 'PDF-Vorschau fehlgeschlagen.');
      return;
    }

    if (result.data.kind === 'blob') {
      blobUrlRef.current = result.data.url;
    }

    setPreview(result.data);
  }, [tenantId, proof, enrichment, enabled, revokeBlobUrl]);

  useEffect(() => {
    void load();
    return () => revokeBlobUrl();
  }, [load, revokeBlobUrl]);

  return { preview, loading, error, refresh: load };
}
