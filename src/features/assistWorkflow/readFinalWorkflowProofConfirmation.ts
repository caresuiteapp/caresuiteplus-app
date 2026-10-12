import { fetchLatestVisitProof } from '@/lib/assist/assistVisitProofPersistenceService';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { canonicalJsonStringify, computeSha256Hex } from '@/lib/assist/assistExecutionHashService';
import { isStoredVisitProofComplete, visitProofSnapshotsMatch } from '@/lib/assist/visitProofCompleteness';
import { buildServiceRecordSnapshot } from './buildServiceRecordHtml';
import { signatureMatchesVisitContent } from './signatureMatchesVisitContent';
import type { AssistExecutionContext } from './types';

/** The final status alone cannot confirm a signed or released proof version. */
export async function readFinalWorkflowProofConfirmation(
  before: AssistExecutionContext,
  current: AssistExecutionContext,
  deferred: boolean,
): Promise<'confirmed' | 'pending' | 'unavailable'> {
  const proofResult = await fetchLatestVisitProof(current.tenantId, current.assistVisitId);
  if (!proofResult.ok || proofResult.tableMissing) return 'unavailable';
  const proof = proofResult.data;
  if (!proof || proof.tenantId !== current.tenantId || proof.visitId !== current.assistVisitId
      || !isStoredVisitProofComplete(proof, { requireSignature: !deferred })) return 'pending';
  if (proof.payloadHash !== await computeSha256Hex(canonicalJsonStringify(proof.payloadSnapshot))) return 'pending';
  let signatureSummary: { signerName: string; signerRole: string; signedAt: string } | null = null;
  if (!deferred || current.detail.clientPortalSignatureCompleted) {
    const signed = await fetchValidVisitSignature(current.tenantId, current.assistVisitId);
    if (!signed.ok || signed.tableMissing) return 'unavailable';
    if (!signed.data || signed.data.id !== proof.signatureId
        || !await signatureMatchesVisitContent(current, signed.data)) return 'pending';
    signatureSummary = { signerName: signed.data.signerName, signerRole: signed.data.signerRole, signedAt: signed.data.signedAt };
  }
  let content = proof.payloadSnapshot;
  if (deferred) {
    const completedViaPortal = current.detail.clientPortalSignatureCompleted === true
      && content.signatureDeferredToClientPortal === false && content.signedViaClientPortal === true
      && content.clientPortalPdfSignatureId === proof.signatureId;
    if (!proof.portalVisible || proof.portalReleaseStatus !== 'released'
        || (content.signatureDeferredToClientPortal !== true && !completedViaPortal)) return 'pending';
    const { signatureDeferredToClientPortal: _deferred, signatureDeferredAt: _at,
      signatureDeferredBy: _by, signatureDeferredReason: _reason, clientPortalSignedAt: _clientAt,
      signedViaClientPortal: _via, clientPortalPdfSignatureId: _clientSignature, ...base } = content;
    content = base;
  }
  const snapshot = (ctx: AssistExecutionContext) => buildServiceRecordSnapshot({
    detail: ctx.detail, visitTimes: ctx.visitTimes,
    documentationText: ctx.detail.documentationNotes?.trim() || null,
    visitId: ctx.assistVisitId, employeeId: ctx.employeeId, serviceName: ctx.detail.title, signatureSummary,
  });
  return visitProofSnapshotsMatch(content, snapshot(current)) && visitProofSnapshotsMatch(content, snapshot(before))
    ? 'confirmed' : 'pending';
}
