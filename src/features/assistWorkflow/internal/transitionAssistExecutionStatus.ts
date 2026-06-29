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
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from '../assistWorkflowErrors';

export type TransitionOptions = {
  noShowNote?: string | null;
  hasDocumentation?: boolean;
  hasRequiredSignature?: boolean;
  signatureImpossibleJustified?: boolean;
};

export async function transitionAssistExecutionStatus(
  ctx: AssistExecutionContext,
  toStatus: AssignmentStatus,
  options?: TransitionOptions,
): Promise<ServiceResult<AssistExecutionContext>> {
  const validation = validateWorkflowTransition(ctx.assignmentStatus, toStatus, {
    requireArrivedBeforeStart: true,
    hasDocumentation: options?.hasDocumentation,
    hasRequiredSignature: options?.hasRequiredSignature,
    signatureImpossibleJustified: options?.signatureImpossibleJustified,
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
  );

  if (!result.ok) {
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
