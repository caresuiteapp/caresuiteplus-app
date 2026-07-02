/**
 * P0 — Validates whether a stored visit proof is complete enough for finalize/release.
 */
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

export type VisitProofCompletenessOptions = {
  /** When true, signature_id must be set on the proof row. */
  requireSignature?: boolean;
};

/** True when proof row has minimum snapshot integrity for P0 acceptance. */
export function isStoredVisitProofComplete(
  proof: AssistVisitProofRow,
  options?: VisitProofCompletenessOptions,
): boolean {
  if (!proof.visitId?.trim()) return false;
  if (!proof.payloadHash?.trim()) return false;
  const hasSnapshot =
    Boolean(proof.storagePath?.trim()) ||
    Boolean(proof.payloadSnapshot && Object.keys(proof.payloadSnapshot).length > 0);
  if (!hasSnapshot) return false;
  if (options?.requireSignature && !proof.signatureId?.trim()) return false;
  return true;
}

/** Proof exists but lacks hash, snapshot, signature link, or PDF path. */
export function visitProofNeedsRefresh(
  proof: AssistVisitProofRow,
  options?: VisitProofCompletenessOptions,
): boolean {
  return !isStoredVisitProofComplete(proof, options);
}
