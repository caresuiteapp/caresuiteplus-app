/**
 * ASSIST.STABILIZE.1 — Office/admin manual workflow repair for broken visits.
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import { repairWorkflowState } from './repairWorkflowState';
import { deriveWorkflowStatus } from './deriveWorkflowStatus';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type AdminRepairVisitWorkflowInput = {
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  profileId?: string | null;
  roleKey?: string | null;
  /** Force target status; defaults to timestamp-derived status. */
  targetStatus?: AssignmentStatus;
  reason?: string;
};

export type AdminRepairVisitWorkflowResult = {
  ctx: AssistExecutionContext;
  appliedRepairs: string[];
  derivedStatus: AssignmentStatus;
};

export async function adminRepairVisitWorkflow(
  input: AdminRepairVisitWorkflowInput,
): Promise<ServiceResult<AdminRepairVisitWorkflowResult>> {
  const ctxResult = await resolveAssistExecutionContext({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    employeeId: input.employeeId,
    profileId: input.profileId,
    roleKey: input.roleKey as import('@/types').RoleKey | null,
    autoRepair: false,
  });

  if (!ctxResult.ok) return ctxResult;

  const ctx = ctxResult.data;
  const derived = deriveWorkflowStatus(ctx.assignmentStatus, ctx.visitTimes);
  const target = input.targetStatus ?? derived.derivedStatus;

  if (derived.consistencyStatus === 'consistent' && ctx.assignmentStatus === target) {
    return {
      ok: true,
      data: {
        ctx,
        appliedRepairs: [],
        derivedStatus: target,
      },
    };
  }

  const repaired = await repairWorkflowState(
    { ...ctx, derivedStatus: target },
    { autoOnly: false },
  );

  if (!repaired.ok) return repaired;

  return {
    ok: true,
    data: {
      ctx: repaired.data.ctx,
      appliedRepairs: repaired.data.appliedRepairs,
      derivedStatus: repaired.data.ctx.derivedStatus,
    },
  };
}

export async function adminRepairVisitWorkflowSafe(
  input: AdminRepairVisitWorkflowInput,
): Promise<ServiceResult<AdminRepairVisitWorkflowResult>> {
  try {
    return await adminRepairVisitWorkflow(input);
  } catch (err) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_DATABASE_ERROR', {
        tenantId: input.tenantId,
        assignmentId: input.assignmentId,
        employeeId: input.employeeId,
        operation: 'adminRepairVisitWorkflow',
      }, err instanceof Error ? err.message : 'Repair fehlgeschlagen.'),
    );
  }
}
