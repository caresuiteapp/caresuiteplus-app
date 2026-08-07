/**
 * Employee requests administrative approval for a later client-portal signature.
 * This step neither completes the visit nor publishes anything to the client portal.
 */
import type { ServiceResult } from '@/types';
import { validateVisitCloseReadiness } from '@/lib/assist/visitExecutionService';
import { requestDeferredSignatureAdministrativeApproval } from '@/lib/portal/deferredVisitClientSignatureService';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type FinalizeVisitDeferredResult = {
  ctx: AssistExecutionContext;
  proofId: string | null;
  clientDocumentId: string | null;
  approvalRequestId?: string;
};

export async function finalizeVisitWithDeferredClientSignature(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
  approvalReason = '',
): Promise<ServiceResult<FinalizeVisitDeferredResult>> {
  if (!ctx.detail.requiresSignature) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_SIGNATURE_REQUIRED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisitWithDeferredClientSignature',
      }, 'Für diesen Einsatz ist keine Unterschrift erforderlich — bitte normal abschließen.'),
    );
  }

  const openRequired = ctx.detail.tasks.filter(
    (t) => t.required && t.status !== 'done' && t.status !== 'requires_follow_up',
  );
  if (openRequired.length > 0) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_TASKS_INCOMPLETE', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisitWithDeferredClientSignature',
      }, `${openRequired.length} Pflichtaufgabe(n) noch offen.`),
    );
  }

  const docText =
    documentationText?.trim() ||
    ctx.detail.documentationNotes?.trim() ||
    '';

  const readiness = validateVisitCloseReadiness({
    tasks: ctx.detail.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      isRequired: t.required,
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
    const code =
      readiness.error.includes('Dokumentation')
        ? 'AWF_DOCUMENTATION_REQUIRED'
        : 'AWF_TASKS_INCOMPLETE';
    return assistWorkflowErrorToResult(
      createAssistWorkflowError(code, {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisitWithDeferredClientSignature',
      }, readiness.error),
    );
  }

  const request = await requestDeferredSignatureAdministrativeApproval(ctx, approvalReason);
  if (!request.ok) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_ADMIN_APPROVAL_REQUEST_FAILED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisitWithDeferredClientSignature',
      }, request.error ?? 'Freigabeanfrage konnte nicht an die Verwaltung gesendet werden.'),
    );
  }

  const refreshed = {
    ...ctx,
    detail: {
      ...ctx.detail,
      signatureStatus: 'administrative_approval_pending' as const,
    },
  };

  return {
    ok: true,
    data: {
      ctx: refreshed,
      proofId: null,
      clientDocumentId: null,
      approvalRequestId: request.data.requestId,
    },
  };
}
