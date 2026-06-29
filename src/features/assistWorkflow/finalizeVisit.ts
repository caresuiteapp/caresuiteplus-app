/**
 * ASSIST.WORKFLOW.1 — Finalize visit: validate readiness, generate proof, lock assignment.
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import { validateVisitCloseReadiness } from '@/lib/assist/visitExecutionService';
import { hasPersistedClientSignature } from './saveClientSignature';
import { generateServiceRecord } from './generateServiceRecord';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type FinalizeVisitResult = {
  ctx: AssistExecutionContext;
  serviceRecordId: string | null;
  proofPersisted: boolean;
};

export async function finalizeVisit(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
): Promise<ServiceResult<FinalizeVisitResult>> {
  const openRequired = ctx.detail.tasks.filter(
    (t) => t.required && t.status !== 'done' && t.status !== 'requires_follow_up',
  );
  if (openRequired.length > 0) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_TASKS_INCOMPLETE', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisit',
      }, `${openRequired.length} Pflichtaufgabe(n) noch offen.`),
    );
  }

  const hasSignature =
    ctx.detail.requiresSignature
      ? await hasPersistedClientSignature(ctx.tenantId, ctx.assistVisitId)
      : true;

  const docText =
    documentationText?.trim() ||
    (ctx.detail.documentationStatus === 'submitted' ? 'submitted' : '');

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
    hasSignature,
  });

  if (!readiness.valid) {
    const code =
      readiness.error.includes('Unterschrift')
        ? 'AWF_SIGNATURE_REQUIRED'
        : readiness.error.includes('Dokumentation')
          ? 'AWF_DOCUMENTATION_REQUIRED'
          : 'AWF_TASKS_INCOMPLETE';
    return assistWorkflowErrorToResult(
      createAssistWorkflowError(code, {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisit',
      }, readiness.error),
    );
  }

  const record = await generateServiceRecord(ctx, docText);

  const transitioned = await transitionAssistExecutionStatus(ctx, 'abgeschlossen', {
    hasDocumentation: Boolean(docText),
    hasRequiredSignature: hasSignature,
  });

  if (!transitioned.ok) {
    return { ok: false, error: transitioned.error };
  }

  void upsertAssistVisitExecutionState(ctx.tenantId, ctx.assignmentId, 'abgeschlossen', {
    employeeId: ctx.employeeId,
    visitTimes: transitioned.data.visitTimes,
    documentationComplete: true,
    signatureComplete: hasSignature,
    proofGenerated: record.ok ? record.data.proofPersisted : false,
    finalizedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    data: {
      ctx: transitioned.data,
      serviceRecordId: record.ok ? record.data.serviceRecordId : null,
      proofPersisted: record.ok ? record.data.proofPersisted : false,
    },
  };
}
