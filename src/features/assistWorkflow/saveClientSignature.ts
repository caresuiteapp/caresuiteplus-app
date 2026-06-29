/**
 * ASSIST.WORKFLOW.2 — Capture client signature and advance to proof/finalize step.
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import type { EmployeePortalSignatureCaptureInput } from '@/types/modules/employeePortalExecution';
import { persistEmployeePortalSignature } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type SaveClientSignatureInput = {
  ctx: AssistExecutionContext;
  signature: EmployeePortalSignatureCaptureInput;
};

export type SaveClientSignatureResult = {
  ctx: AssistExecutionContext;
  readyToFinalize: boolean;
};

export async function saveClientSignature(
  input: SaveClientSignatureInput,
): Promise<ServiceResult<SaveClientSignatureResult>> {
  const { ctx, signature } = input;

  if (signature.signatureImpossibleReason?.trim()) {
    const refreshed = await resolveAssistExecutionContext({
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      roleKey: ctx.roleKey as RoleKey | null,
    });
    if (!refreshed.ok) return { ok: false, error: refreshed.error };
    return { ok: true, data: { ctx: refreshed.data, readyToFinalize: false } };
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

  if (ctx.assignmentStatus !== 'dokumentation_offen' && ctx.assignmentStatus !== 'unterschrift_offen') {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_DOCUMENTATION_REQUIRED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveClientSignature',
      }, 'Dokumentation muss vor der Unterschrift gespeichert werden.'),
    );
  }

  const persist = await persistEmployeePortalSignature(
    {
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      locationAddress: ctx.detail.locationAddress,
    },
    signature,
    {
      visitId: ctx.assistVisitId,
      clientId: ctx.detail.clientId,
      employeeId: ctx.employeeId,
      plannedStartAt: ctx.detail.plannedStartAt,
      plannedEndAt: ctx.detail.plannedEndAt,
      taskStatuses: ctx.detail.tasks.map((t) => ({ taskId: t.id, status: t.status })),
      documentationNote: null,
    },
  );

  if (!persist.ok) {
    return { ok: false, error: persist.error ?? 'Signatur konnte nicht gespeichert werden.' };
  }

  let updatedCtx = ctx;
  if (ctx.assignmentStatus === 'dokumentation_offen') {
    const transitioned = await transitionAssistExecutionStatus(ctx, 'unterschrift_offen', {
      hasDocumentation: true,
      hasRequiredSignature: true,
    });
    if (!transitioned.ok) return { ok: false, error: transitioned.error };
    updatedCtx = transitioned.data;
  }

  void upsertAssistVisitExecutionState(ctx.tenantId, ctx.assignmentId, 'unterschrift_offen', {
    employeeId: ctx.employeeId,
    visitTimes: updatedCtx.visitTimes,
    documentationComplete: true,
    signatureComplete: true,
  });

  const refreshed = await resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey: ctx.roleKey as RoleKey | null,
  });

  if (!refreshed.ok) return { ok: false, error: refreshed.error };

  return {
    ok: true,
    data: { ctx: refreshed.data, readyToFinalize: true },
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
