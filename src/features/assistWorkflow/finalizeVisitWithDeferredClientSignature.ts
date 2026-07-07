/**
 * ASSIST.WORKFLOW.1 — Finalize visit without on-device signature;
 * release signature request to Klient:innenportal (Phase 1 deferred signing).
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import { validateVisitCloseReadiness } from '@/lib/assist/visitExecutionService';
import { releaseDeferredClientSignatureRequest } from '@/lib/portal/deferredVisitClientSignatureService';
import { getServiceMode } from '@/lib/services/mode';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type FinalizeVisitDeferredResult = {
  ctx: AssistExecutionContext;
  proofId: string | null;
  clientDocumentId: string | null;
  wfmSyncFailed?: boolean;
};

export async function finalizeVisitWithDeferredClientSignature(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
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

  const release = await releaseDeferredClientSignatureRequest(ctx, docText);
  if (!release.ok) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_PROOF_GENERATION_FAILED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisitWithDeferredClientSignature',
      }, release.error ?? 'Unterschriftsanfrage konnte nicht ans Klient:innenportal gesendet werden.'),
    );
  }

  if (getServiceMode() === 'supabase' && !release.data.proofId) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_PROOF_GENERATION_FAILED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisitWithDeferredClientSignature',
      }, 'Unterschriftsanfrage konnte nicht gespeichert werden.'),
    );
  }

  const transitioned = await transitionAssistExecutionStatus(ctx, 'abgeschlossen', {
    hasDocumentation: Boolean(docText),
    hasRequiredSignature: true,
    signatureDeferredToClientPortal: true,
  });

  if (!transitioned.ok) {
    return { ok: false, error: transitioned.error };
  }

  const executionState = await upsertAssistVisitExecutionState(
    ctx.tenantId,
    ctx.assignmentId,
    'abgeschlossen',
    {
      employeeId: ctx.employeeId,
      visitTimes: transitioned.data.visitTimes,
      documentationComplete: true,
      signatureComplete: false,
      proofGenerated: false,
      finalizedAt: new Date().toISOString(),
    },
  );

  if (!executionState.ok) {
    return { ok: false, error: executionState.error ?? 'Einsatzstatus konnte nicht gespeichert werden.' };
  }

  let wfmSyncFailed = false;
  const wfmVisitId = ctx.assistVisitId ?? ctx.assignmentId;
  if (getServiceMode() === 'supabase' && ctx.employeeId && wfmVisitId) {
    const { syncAssistVisitTimesToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
    const wfmSync = await syncAssistVisitTimesToWfm(
      ctx.tenantId,
      ctx.employeeId,
      ctx.profileId ?? null,
      wfmVisitId,
    );
    if (!wfmSync.ok) {
      wfmSyncFailed = true;
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[finalizeVisitWithDeferredClientSignature] WFM sync failed (non-blocking):',
          wfmSync.error,
        );
      }
    }
  }

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
      proofId: release.data.proofId,
      clientDocumentId: release.data.clientDocumentId,
      wfmSyncFailed,
    },
  };
}
