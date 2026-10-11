import type { AssistVisitSignatureRow } from '@/types/assistExecutionPersistence';
import { canonicalJsonStringify, computeSha256Hex } from '@/lib/assist/assistExecutionHashService';
import { buildVisitSignaturePayload } from './workflowWriteExpectation';
import type { AssistExecutionContext } from './types';

/** A valid flag alone can belong to an earlier document or task version. */
export async function signatureMatchesVisitContent(
  ctx: AssistExecutionContext,
  signature: AssistVisitSignatureRow,
  documentationText?: string | null,
): Promise<boolean> {
  if (signature.tenantId !== ctx.tenantId || signature.visitId !== ctx.assistVisitId
      || !signature.isValid || !signature.storagePath || !signature.signatureHash || !signature.payloadHash)
    return false;
  const payload = buildVisitSignaturePayload(ctx);
  if (documentationText !== undefined) payload.documentationNote = documentationText?.trim() || null;
  return signature.payloadHash === await computeSha256Hex(canonicalJsonStringify(payload));
}
