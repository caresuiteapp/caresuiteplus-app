/**
 * ASSIST.WORKFLOW.1 — Shared status transition with DB persistence.
 */
import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { transitionLiveEmployeePortalAssignment } from '@/lib/portal/employeePortalExecutionLiveService';
import { transitionEmployeePortalAssignment } from '@/lib/portal/employeePortalExecutionService';
import { getServiceMode } from '@/lib/services/mode';
import { validateWorkflowTransition } from '../assistVisitStateMachine';
import { resolveAssistExecutionContext } from '../resolveAssistExecutionContext';
import type { AssistExecutionContext } from '../types';
import {
  assistWorkflowErrorFromSupabase,
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from '../assistWorkflowErrors';

export type TransitionOptions = {
  noShowNote?: string | null;
  hasServiceStarted?: boolean;
  hasTravelEnded?: boolean;
  hasDocumentation?: boolean;
  hasRequiredSignature?: boolean;
  signatureImpossibleJustified?: boolean;
  signatureDeferredToClientPortal?: boolean;
  /** When true, caller persists status side-effects (markArrived). */
  skipStatusPersistence?: boolean;
  arrivalOptions?: {
    arrivalMode?: 'gps' | 'without_gps' | 'manual';
    manualReason?: string | null;
  };
};

export async function transitionAssistExecutionStatus(
  ctx: AssistExecutionContext,
  toStatus: AssignmentStatus,
  options?: TransitionOptions,
): Promise<ServiceResult<AssistExecutionContext>> {
  if (ctx.assignmentStatus === toStatus) {
    return resolveAssistExecutionContext({
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      roleKey: ctx.roleKey as RoleKey | null,
    });
  }

  const hasServiceStarted =
    options?.hasServiceStarted ??
    Boolean(ctx.visitTimes?.serviceStartedAt);

  const hasTravelEnded =
    options?.hasTravelEnded ??
    Boolean(ctx.visitTimes?.arrivedAt);

  const validation = validateWorkflowTransition(ctx.assignmentStatus, toStatus, {
    requireArrivedBeforeStart: true,
    hasServiceStarted: toStatus === 'beendet' ? hasServiceStarted : undefined,
    hasTravelEnded: toStatus === 'beendet' ? hasTravelEnded : undefined,
    hasDocumentation: options?.hasDocumentation,
    hasRequiredSignature: options?.hasRequiredSignature,
    signatureImpossibleJustified: options?.signatureImpossibleJustified,
    signatureDeferredToClientPortal: options?.signatureDeferredToClientPortal,
    noShowNote: options?.noShowNote,
  });

  if (!validation.valid) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_INVALID_TRANSITION', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'transitionAssistExecutionStatus',
      }, validation.error),
    );
  }

  const roleKey = ctx.roleKey as RoleKey | null;
  const transitionFn =
    getServiceMode() === 'supabase'
      ? transitionLiveEmployeePortalAssignment
      : transitionEmployeePortalAssignment;

  const note = toStatus === 'nicht_erschienen' ? options?.noShowNote?.trim() : undefined;
  const result = await transitionFn(
    ctx.tenantId,
    ctx.assignmentId,
    ctx.employeeId,
    roleKey,
    toStatus,
    options?.skipStatusPersistence
      ? {
          profileId: ctx.profileId,
          skipStatusPersistence: true,
          arrivalOptions: options.arrivalOptions,
          executionTransition: {
            hasDocumentation: options.hasDocumentation,
            hasRequiredSignature: options.hasRequiredSignature,
            signatureDeferredToClientPortal: options.signatureDeferredToClientPortal,
          },
        }
      : {
          profileId: ctx.profileId,
          executionTransition: {
            hasDocumentation: options?.hasDocumentation,
            hasRequiredSignature: options?.hasRequiredSignature,
            signatureDeferredToClientPortal: options?.signatureDeferredToClientPortal,
          },
        },
  );

  if (!result.ok) {
    if (result.error?.includes('Datenbankfehler')) {
      return assistWorkflowErrorToResult(
        assistWorkflowErrorFromSupabase(
          { message: result.error },
          {
            tenantId: ctx.tenantId,
            assignmentId: ctx.assignmentId,
            employeeId: ctx.employeeId,
            operation: 'transitionAssistExecutionStatus',
          },
        ),
      );
    }
    return { ok: false, error: result.error };
  }

  void note;

  return resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey,
  });
}
