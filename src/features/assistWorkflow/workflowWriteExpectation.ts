import type { EmployeePortalSignatureCaptureInput } from '@/types/modules/employeePortalExecution';
import { computeSignatureDataHash, computeVisitSignaturePayloadHash } from '@/lib/assist/assistVisitSignaturePersistenceService';
import type { AssistExecutionContext } from './types';
import type { VisitDocumentationContent } from './visitDocumentationContent';

export type SignatureWriteExpectation = {
  payloadHash: string;
  signatureHash: string;
  signerName: string;
  signerRole: string;
};

export type WorkflowWriteExpectation =
  | { kind: 'documentation'; content: VisitDocumentationContent }
  | { kind: 'signature'; signature: SignatureWriteExpectation };

export function buildVisitSignaturePayload(ctx: AssistExecutionContext) {
  return {
    visitId: ctx.assistVisitId,
    clientId: ctx.detail.clientId,
    employeeId: ctx.employeeId,
    plannedStartAt: ctx.detail.plannedStartAt,
    plannedEndAt: ctx.detail.plannedEndAt,
    taskStatuses: ctx.detail.tasks.map((task) => ({ taskId: task.id, status: task.status })),
    documentationNote: ctx.detail.documentationNotes?.trim() || null,
  };
}

export async function buildSignatureWriteExpectation(ctx: AssistExecutionContext, signature: EmployeePortalSignatureCaptureInput): Promise<SignatureWriteExpectation> {
  const [payloadHash, signatureHash] = await Promise.all([
    computeVisitSignaturePayloadHash(buildVisitSignaturePayload(ctx)),
    computeSignatureDataHash(signature.signatureDataUrl ?? ''),
  ]);
  return { payloadHash, signatureHash, signerName: signature.signerName.trim(), signerRole: signature.signatureType.trim() };
}
