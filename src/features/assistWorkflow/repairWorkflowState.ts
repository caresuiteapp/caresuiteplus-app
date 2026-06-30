/**
 * ASSIST.STABILIZE.1 — Auto-repair workflow when timestamps make target status unambiguous.
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import { deriveWorkflowStatus } from './deriveWorkflowStatus';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorFromSupabase,
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type RepairWorkflowResult = {
  repaired: boolean;
  ctx: AssistExecutionContext;
  appliedRepairs: string[];
};

async function forceRepairAssignmentStatus(
  tenantId: string,
  assignmentId: string,
  targetStatus: AssignmentStatus,
  actorEmployeeId: string,
  reason: string,
): Promise<ServiceResult<void>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: undefined };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase ist nicht verfügbar.' };
  }

  const { error } = await supabase.rpc('repair_assist_visit_workflow_status', {
    p_tenant_id: tenantId,
    p_assignment_id: assignmentId,
    p_target_status: targetStatus,
    p_reason: reason,
    p_actor_employee_id: actorEmployeeId,
  });

  if (error) {
    // RPC missing — fall back to standard update when forward transition exists.
    const updated = await assignmentSupabaseRepository.updateStatus(
      tenantId,
      assignmentId,
      targetStatus,
      { actorEmployeeId, actorProfileId: actorEmployeeId },
      reason,
    );
    if (!updated.ok) {
      return assistWorkflowErrorToResult(
        assistWorkflowErrorFromSupabase(error, {
          tenantId,
          assignmentId,
          employeeId: actorEmployeeId,
          operation: 'forceRepairAssignmentStatus',
        }),
      );
    }
    return { ok: true, data: undefined };
  }

  return { ok: true, data: undefined };
}

/** Reset assignment status when DB is ahead of time events (unambiguous repair). */
export async function repairWorkflowState(
  ctx: AssistExecutionContext,
  options?: { autoOnly?: boolean },
): Promise<ServiceResult<RepairWorkflowResult>> {
  const derived = deriveWorkflowStatus(ctx.assignmentStatus, ctx.visitTimes);
  const consistencyStatus = derived.consistencyStatus;
  const appliedRepairs: string[] = [];

  if (consistencyStatus === 'blocked') {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_INVALID_STATE', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'repairWorkflowState',
      }, 'Einsatzstatus kann nicht automatisch repariert werden.'),
    );
  }

  const needsStatusReset = derived.derivedStatus !== ctx.assignmentStatus;

  const blockedReset =
    ['gestartet', 'pausiert'].includes(ctx.assignmentStatus) &&
    !['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(
      derived.derivedStatus,
    ) &&
    derived.consistencyStatus !== 'repairable';

  if (!needsStatusReset || blockedReset) {
    return { ok: true, data: { repaired: false, ctx, appliedRepairs: [] } };
  }

  if (needsStatusReset) {
    const repair = await forceRepairAssignmentStatus(
      ctx.tenantId,
      ctx.assignmentId,
      derived.derivedStatus,
      ctx.employeeId,
      'ASSIST.STABILIZE.1 auto-repair',
    );
    if (!repair.ok) {
      if (options?.autoOnly) {
        return { ok: true, data: { repaired: false, ctx, appliedRepairs: [] } };
      }
      return repair;
    }
    appliedRepairs.push(`status→${derived.derivedStatus}`);
  }

  const refreshed = await resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey: ctx.roleKey as import('@/types').RoleKey | null,
  });

  if (!refreshed.ok) {
    return { ok: false, error: refreshed.error };
  }

  return {
    ok: true,
    data: {
      repaired: appliedRepairs.length > 0,
      ctx: refreshed.data,
      appliedRepairs,
    },
  };
}
