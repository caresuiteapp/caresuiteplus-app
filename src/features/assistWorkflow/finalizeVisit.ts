/**
 * ASSIST.WORKFLOW.1 — Finalize visit: validate readiness, generate proof, lock assignment.
 */
import type { ServiceResult } from '@/types';
import { validateVisitCloseReadiness } from '@/lib/assist/visitExecutionService';
import { hasPortalPersistedClientSignature } from '@/lib/portal/resolveEmployeePortalSignatureRequirement';
import { getServiceMode } from '@/lib/services/mode';
import { generateServiceRecord } from './generateServiceRecord';
import { assistProofProjectionKey } from './internal/workflowProjectionKeys';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { fetchLatestVisitProof } from '@/lib/assist/assistVisitProofPersistenceService';
import { isStoredVisitProofComplete } from '@/lib/assist/visitProofCompleteness';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';
import { scheduleDeferredTask, waitForDeferredTask } from '@/lib/async/deferredTask';

export type FinalizeVisitResult = {
  ctx: AssistExecutionContext;
  serviceRecordId: string | null;
  proofPersisted: boolean;
  wfmSyncFailed?: boolean;
};

export async function finalizeVisit(
  ctx: AssistExecutionContext,
  documentationText?: string | null,
): Promise<ServiceResult<FinalizeVisitResult>> {
  const proofProjection = waitForDeferredTask(assistProofProjectionKey(ctx), 1_000);

  const hasSignature =
    ctx.detail.requiresSignature
      ? await hasPortalPersistedClientSignature(
          ctx.tenantId,
          ctx.assignmentId,
          ctx.employeeId,
        )
      : true;

  const docText =
    documentationText?.trim() ||
    ctx.detail.documentationNotes?.trim() ||
    '';

  const readiness = validateVisitCloseReadiness({
    tasks: ctx.detail.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      // Tasks guide the employee but never block documentation, signature or close.
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
    hasSignature,
  });

  if (!readiness.valid) {
    const code =
      readiness.error.includes('Unterschrift')
        ? 'AWF_SIGNATURE_REQUIRED'
        : readiness.error.includes('Dokumentation')
          ? 'AWF_DOCUMENTATION_REQUIRED'
          : 'AWF_DOCUMENTATION_REQUIRED';
    return assistWorkflowErrorToResult(
      createAssistWorkflowError(code, {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisit',
      }, readiness.error),
    );
  }

  // Documentation/signature already starts proof generation. Wait only a
  // bounded moment for that projection and reuse it instead of repeating the
  // expensive signature download, orientation probe and proof upload.
  await proofProjection;
  const existingProof = await fetchLatestVisitProof(ctx.tenantId, ctx.assistVisitId);
  const reusableProof =
    existingProof.ok &&
    existingProof.data &&
    isStoredVisitProofComplete(existingProof.data, {
      requireSignature: ctx.detail.requiresSignature,
    });
  const record = reusableProof
    ? {
        ok: true as const,
        data: { serviceRecordId: null, proofPersisted: true, html: '' },
      }
    : await generateServiceRecord(ctx, docText);

  if (getServiceMode() === 'supabase' && (!record.ok || !record.data.proofPersisted)) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_PROOF_GENERATION_FAILED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'finalizeVisit',
      }, record.ok ? 'Leistungsnachweis konnte nicht gespeichert werden.' : (record.error ?? 'Leistungsnachweis konnte nicht erstellt werden.')),
    );
  }

  const transitioned = await transitionAssistExecutionStatus(ctx, 'abgeschlossen', {
    hasDocumentation: Boolean(docText),
    hasRequiredSignature: hasSignature,
    fastWorkflow: true,
  });

  if (!transitioned.ok) {
    return { ok: false, error: transitioned.error };
  }

  const finalizedAt = new Date().toISOString();
  scheduleDeferredTask(`assist-service-record:${ctx.tenantId}:${ctx.assignmentId}`, async () => {
    const serviceRecord = await assignmentSupabaseRepository.prepareServiceRecord(
      ctx.tenantId,
      ctx.assignmentId,
      {
        actorProfileId: ctx.profileId ?? ctx.employeeId,
        actorEmployeeId: ctx.employeeId,
      },
    );
    if (!serviceRecord.ok) throw new Error(serviceRecord.error);
  });

  scheduleDeferredTask(`assist-finalization:${ctx.tenantId}:${ctx.assignmentId}`, async () => {
    const executionState = await upsertAssistVisitExecutionState(
      ctx.tenantId,
      ctx.assignmentId,
      'abgeschlossen',
      {
        employeeId: ctx.employeeId,
        visitTimes: transitioned.data.visitTimes,
        documentationComplete: true,
        signatureComplete: hasSignature,
        proofGenerated: record.ok ? record.data.proofPersisted : false,
        finalizedAt,
      },
    );
    if (!executionState.ok) throw new Error(executionState.error);

    const wfmVisitId = ctx.assistVisitId ?? ctx.assignmentId;
    if (getServiceMode() === 'supabase' && ctx.employeeId && wfmVisitId) {
      const { syncAssistVisitTimesToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
      const wfmSync = await syncAssistVisitTimesToWfm(
        ctx.tenantId,
        ctx.employeeId,
        ctx.profileId ?? null,
        wfmVisitId,
      );
      if (!wfmSync.ok) throw new Error(wfmSync.error);
    }
  });

  const wfmSyncFailed = false;

  return {
    ok: true,
    data: {
      ctx: transitioned.data,
      serviceRecordId: record.ok ? record.data.serviceRecordId : null,
      proofPersisted: record.ok ? record.data.proofPersisted : false,
      wfmSyncFailed,
    },
  };
}
