/**
 * ASSIST.WORKFLOW.2 — Capture client signature and advance to proof/finalize step.
 */
import type { ServiceResult } from '@/types';
import type { EmployeePortalSignatureCaptureInput } from '@/types/modules/employeePortalExecution';
import { persistEmployeePortalSignature } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { generateServiceRecord } from './generateServiceRecord';
import { assistProofProjectionKey } from './internal/workflowProjectionKeys';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { repairWorkflowState } from './repairWorkflowState';
import { resolveAllowedActions } from './resolveAllowedActions';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';

export type SaveClientSignatureInput = {
  ctx: AssistExecutionContext;
  signature: EmployeePortalSignatureCaptureInput;
};

export type SaveClientSignatureResult = {
  ctx: AssistExecutionContext;
  readyToFinalize: boolean;
  proofGenerated: boolean;
};

export async function saveClientSignature(
  input: SaveClientSignatureInput,
): Promise<ServiceResult<SaveClientSignatureResult>> {
  const { ctx, signature } = input;

  if (signature.signatureImpossibleReason?.trim()) {
    return { ok: true, data: { ctx, readyToFinalize: false, proofGenerated: false } };
  }

  if (!signature.signatureDataUrl?.trim() || !signature.signerName?.trim()) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_SIGNATURE_REQUIRED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveClientSignature',
      }, 'Signatur und Name des Unterzeichners sind erforderlich.'),
    );
  }

  const docSubmitted =
    ctx.detail.documentationStatus === 'submitted' ||
    ctx.detail.documentationStatus === 'locked';
  if (!docSubmitted) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_DOCUMENTATION_REQUIRED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveClientSignature',
      }, 'Dokumentation muss vor der Unterschrift gespeichert werden.'),
    );
  }

  let workingCtx = ctx;
  const signatureReadyStatuses = ['dokumentation_offen', 'unterschrift_offen'] as const;
  if (!signatureReadyStatuses.includes(workingCtx.assignmentStatus as (typeof signatureReadyStatuses)[number])) {
    const postServiceDerived = ['beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(
      workingCtx.derivedStatus ?? '',
    );
    if (
      postServiceDerived &&
      workingCtx.derivedStatus !== workingCtx.assignmentStatus
    ) {
      const repaired = await repairWorkflowState(workingCtx, { autoOnly: false });
      if (repaired.ok && repaired.data.repaired) {
        workingCtx = repaired.data.ctx;
      }
    }

    if (workingCtx.assignmentStatus === 'beendet') {
      const transitioned = await transitionAssistExecutionStatus(workingCtx, 'dokumentation_offen', {
        hasDocumentation: true,
        hasServiceStarted: Boolean(workingCtx.visitTimes?.serviceStartedAt),
        fastWorkflow: true,
      });
      if (transitioned.ok) {
        workingCtx = transitioned.data;
      }
    }

    if (
      !signatureReadyStatuses.includes(workingCtx.assignmentStatus as (typeof signatureReadyStatuses)[number])
    ) {
      return assistWorkflowErrorToResult(
        createAssistWorkflowError('WORKFLOW_INVALID_STATE', {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'saveClientSignature',
        }, 'Einsatzstatus erlaubt Unterschrift noch nicht — bitte Seite neu laden.'),
      );
    }
  }

  const persist = await persistEmployeePortalSignature(
    {
      tenantId: workingCtx.tenantId,
      assignmentId: workingCtx.assignmentId,
      employeeId: workingCtx.employeeId,
      profileId: workingCtx.profileId,
      locationAddress: workingCtx.detail.locationAddress,
    },
    signature,
    {
      visitId: workingCtx.assistVisitId,
      clientId: workingCtx.detail.clientId,
      employeeId: workingCtx.employeeId,
      plannedStartAt: workingCtx.detail.plannedStartAt,
      plannedEndAt: workingCtx.detail.plannedEndAt,
      taskStatuses: workingCtx.detail.tasks.map((t) => ({ taskId: t.id, status: t.status })),
      documentationNote: workingCtx.detail.documentationNotes?.trim() || null,
    },
  );

  if (!persist.ok) {
    return { ok: false, error: persist.error ?? 'Signatur konnte nicht gespeichert werden.' };
  }

  let updatedCtx = workingCtx;
  if (workingCtx.assignmentStatus === 'dokumentation_offen') {
    const transitioned = await transitionAssistExecutionStatus(workingCtx, 'unterschrift_offen', {
      hasDocumentation: true,
      hasRequiredSignature: true,
      fastWorkflow: true,
    });
    if (!transitioned.ok) return { ok: false, error: transitioned.error };
    updatedCtx = transitioned.data;
  }

  // Persist the lightweight workflow projection before returning to the UI.
  // The signature table remains authoritative, but list/card screens use this
  // projection for fast reads. Previously it was only updated behind proof
  // generation, so a failed/slow deferred task left a real signature displayed
  // as "Unterschrift offen" and could send the visit down the portal fallback.
  const signatureState = await upsertAssistVisitExecutionState(
    workingCtx.tenantId,
    workingCtx.assignmentId,
    'unterschrift_offen',
    {
      employeeId: workingCtx.employeeId,
      visitTimes: updatedCtx.visitTimes,
      documentationComplete: true,
      signatureComplete: true,
      proofGenerated: false,
    },
  );
  if (!signatureState.ok) {
    scheduleDeferredTask(`assist-signature-state:${workingCtx.tenantId}:${workingCtx.assignmentId}`, async () => {
      const retry = await upsertAssistVisitExecutionState(
        workingCtx.tenantId,
        workingCtx.assignmentId,
        'unterschrift_offen',
        {
          employeeId: workingCtx.employeeId,
          visitTimes: updatedCtx.visitTimes,
          documentationComplete: true,
          signatureComplete: true,
          proofGenerated: false,
        },
      );
      if (!retry.ok) throw new Error(retry.error);
    });
  }

  const documentationText =
    updatedCtx.detail.documentationStatus === 'submitted' ||
    updatedCtx.detail.documentationStatus === 'locked'
      ? updatedCtx.detail.documentationNotes?.trim() || null
      : null;
  scheduleDeferredTask(assistProofProjectionKey(updatedCtx), async () => {
    const proof = await generateServiceRecord(updatedCtx, documentationText);
    const executionState = await upsertAssistVisitExecutionState(
      workingCtx.tenantId,
      workingCtx.assignmentId,
      'unterschrift_offen',
      {
        employeeId: workingCtx.employeeId,
        visitTimes: updatedCtx.visitTimes,
        documentationComplete: true,
        signatureComplete: true,
        proofGenerated: proof.ok ? proof.data.proofPersisted : false,
      },
    );
    if (!executionState.ok) throw new Error(executionState.error);
  });
  const proofGenerated = false;

  const detail = {
    ...updatedCtx.detail,
    status: 'unterschrift_offen' as const,
    signatureStatus: 'captured' as const,
  };
  const optimisticCtx: AssistExecutionContext = {
    ...updatedCtx,
    assignmentStatus: 'unterschrift_offen',
    derivedStatus: 'unterschrift_offen',
    detail,
    allowedActions: resolveAllowedActions({
      assignmentStatus: 'unterschrift_offen',
      visitTimes: updatedCtx.visitTimes,
      detail,
      derivedStatus: 'unterschrift_offen',
      canStartService: false,
    }),
  };

  return {
    ok: true,
    data: {
      ctx: optimisticCtx,
      readyToFinalize: true,
      proofGenerated,
    },
  };
}

/** Check whether a valid DB signature exists for the visit. */
export async function hasPersistedClientSignature(
  tenantId: string,
  visitId: string,
): Promise<boolean> {
  const sig = await fetchValidVisitSignature(tenantId, visitId);
  return sig.ok && Boolean(sig.data);
}
