import { useCallback, useEffect, useState } from 'react';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import {
  buildVisitProofPreviewFromProof,
  enrichVisitProofForPreview,
  type VisitProofSnapshotEnrichment,
} from '@/lib/assist/visitProofSnapshotPreviewService';
import type { VisitProofPreview } from '@/lib/assist/visitProofPreviewService';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';

export type VisitProofReviewPreview = VisitProofPreview & {
  visitTimes: VisitTimesSummary | null;
  signatureImageUrl: string | null;
};

export function useVisitProofReviewPreview(
  tenantId: string | null,
  proof: AssistVisitProofRow | null,
) {
  const [preview, setPreview] = useState<VisitProofReviewPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Becomes true once the first enrichment attempt completes (success or error).
  // Used to gate PDF generation so it fires exactly once with final enrichment data.
  const [enrichmentReady, setEnrichmentReady] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !proof) {
      setPreview(null);
      setLoading(false);
      setError(null);
      setEnrichmentReady(false);
      return;
    }

    setLoading(true);
    setError(null);
    setEnrichmentReady(false);
    setPreview(buildVisitProofPreviewFromProof(proof));

    try {
      let enrichment: VisitProofSnapshotEnrichment = {};
      const enriched = await enrichVisitProofForPreview(tenantId, proof);
      if (enriched.ok) {
        enrichment = enriched.data;
      } else {
        setError(enriched.error ?? 'Vorschau konnte nicht ergänzt werden.');
      }

      setPreview(buildVisitProofPreviewFromProof(proof, enrichment));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Vorschau konnte nicht aus Einsatzdaten geladen werden.',
      );
      setPreview(buildVisitProofPreviewFromProof(proof));
    } finally {
      setLoading(false);
      setEnrichmentReady(true);
    }
  }, [tenantId, proof]);

  useEffect(() => {
    void load();
  }, [load]);

  return { preview, loading, error, enrichmentReady, refresh: load };
}
