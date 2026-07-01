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

  const load = useCallback(async () => {
    if (!tenantId || !proof) {
      setPreview(null);
      return;
    }

    setLoading(true);
    setError(null);

    let enrichment: VisitProofSnapshotEnrichment = {};
    const enriched = await enrichVisitProofForPreview(tenantId, proof);
    if (enriched.ok) {
      enrichment = enriched.data;
    } else {
      setError(enriched.error ?? 'Vorschau konnte nicht ergänzt werden.');
    }

    setPreview(buildVisitProofPreviewFromProof(proof, enrichment));
    setLoading(false);
  }, [tenantId, proof]);

  useEffect(() => {
    void load();
  }, [load]);

  return { preview, loading, error, refresh: load };
}
