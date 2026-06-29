/**
 * ASSIST.WORKFLOW.1 — Capture and persist client signature.
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import type { EmployeePortalSignatureCaptureInput } from '@/types/modules/employeePortalExecution';
import { persistEmployeePortalSignature } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
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

export async function saveClientSignature(
  input: SaveClientSignatureInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  const { ctx, signature } = input;

  if (signature.signatureImpossibleReason?.trim()) {
    return resolveAssistExecutionContext({
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      roleKey: ctx.roleKey as RoleKey | null,
    });
  }

  if (!signature.signatureDataUrl?.trim() || !signature.signerName?.trim()) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_SIGNATURE_REQUIRED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveClientSignature',
      }, 'Signatur und Name des Unterzeichners sind erforderlich.'),
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

  if (ctx.assignmentStatus === 'dokumentation_offen') {
    return transitionAssistExecutionStatus(ctx, 'unterschrift_offen', {
      hasDocumentation: true,
    });
  }

  return resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey: ctx.roleKey as RoleKey | null,
  });
}

/** Check whether a valid DB signature exists for the visit. */
export async function hasPersistedClientSignature(
  tenantId: string,
  visitId: string,
): Promise<boolean> {
  const sig = await fetchValidVisitSignature(tenantId, visitId);
  return sig.ok && Boolean(sig.data);
}
