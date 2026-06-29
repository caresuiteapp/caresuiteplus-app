/**
 * ASSIST.WORKFLOW.1 — Persist task completion results.
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { updateLiveEmployeePortalTask } from '@/lib/portal/employeePortalExecutionLiveService';
import { updateEmployeePortalTask } from '@/lib/portal/employeePortalExecutionService';
import { getServiceMode } from '@/lib/services/mode';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import { taskStatusRequiresNote } from '@/lib/assist/assignmentStatusMachine';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type SaveTaskResultInput = {
  ctx: AssistExecutionContext;
  taskId: string;
  status: ExtendedAssignmentTaskStatus;
  completionNote?: string;
};

export async function saveTaskResults(
  input: SaveTaskResultInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  const { ctx, taskId, status, completionNote } = input;

  if (taskStatusRequiresNote(status) && !completionNote?.trim()) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_VALIDATION', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'saveTaskResults',
      }, 'Abweichung erfordert eine Begründung.'),
    );
  }

  const roleKey = ctx.roleKey as RoleKey | null;
  const updateFn =
    getServiceMode() === 'supabase' ? updateLiveEmployeePortalTask : updateEmployeePortalTask;

  const result = await updateFn(
    ctx.tenantId,
    ctx.assignmentId,
    ctx.employeeId,
    roleKey,
    taskId,
    status,
    completionNote,
  );

  if (!result.ok) return { ok: false, error: result.error };

  return resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey,
  });
}
