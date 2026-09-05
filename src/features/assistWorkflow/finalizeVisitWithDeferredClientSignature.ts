/**
 * Employee sends the required signature directly to the client portal when
 * on-site signing is not possible. Documentation remains mandatory.
 */
import type { ServiceResult } from '@/types';
import { validateVisitCloseReadiness } from '@/lib/assist/visitExecutionService';
import { releaseDeferredClientSignatureRequest } from '@/lib/portal/deferredVisitClientSignatureService';
import type { AssistExecutionContext } from './types';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type FinalizeVisitDeferredResult = {
  ctx: AssistExecutionContext;
  proofId: string | null;
  clientDocumentId: string | null;
  sentDirectlyToClientPortal: boolean;
};

export async function finalizeVisitWithDeferredClientSignature(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
  approvalReason = '',
): Promise<ServiceResult<FinalizeVisitDeferredResult>> {
  const docText =
    documentationText?.trim() ||
    ctx.detail.documentationNotes?.trim() ||
    '';

  const readiness = validateVisitCloseReadiness({
    tasks: ctx.detail.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      isRequired: false,
      status:
        t.status === 'done'
          ? 'done'
          : t.status === 'not_done'
            ? 'not_possible'
            : t.status === 'requires_follow_up'
              ? 'deferred'
              : 'open',
      notDoneReason: t.completionNote,
    })),
    documentationNote: docText || null,
    hasSignature: false,
    allowDeferredSignature: true,
  });

  if (!readiness.valid) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_DOCUMENTATION_REQUIRED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisitWithDeferredClientSignature',
      }, readiness.error),
    );
  }

  const request = await releaseDeferredClientSignatureRequest(ctx, docText, {
    reason: approvalReason.trim() || null,
  });
  if (!request.ok) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_PORTAL_SIGNATURE_RELEASE_FAILED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisitWithDeferredClientSignature',
      }, request.error ?? 'Die Unterschriftsanfrage konnte nicht an das Klient:innenportal gesendet werden.'),
    );
  }

  const transitioned = await transitionAssistExecutionStatus(ctx, 'abgeschlossen', {
    hasDocumentation: true,
    hasRequiredSignature: false,
    signatureDeferredToClientPortal: true,
    fastWorkflow: true,
  });
  if (!transitioned.ok) return transitioned;

  const refreshed = {
    ...transitioned.data,
    detail: {
      ...transitioned.data.detail,
      signatureStatus: 'deferred_to_client_portal' as const,
    },
  };

  return {
    ok: true,
    data: {
      ctx: refreshed,
      proofId: request.data.proofId,
      clientDocumentId: request.data.clientDocumentId,
      sentDirectlyToClientPortal: true,
    },
  };
}
