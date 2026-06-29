/**
 * ASSIST.WORKFLOW.3 — Debounced batch task result persistence.
 */
import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { updateLiveEmployeePortalTasksBatch } from '@/lib/portal/employeePortalExecutionLiveService';
import { updateEmployeePortalTasksBatch } from '@/lib/portal/employeePortalExecutionService';
import { getServiceMode } from '@/lib/services/mode';
import { taskStatusRequiresNote } from '@/lib/assist/assignmentStatusMachine';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type TaskResultBatchItem = {
  taskId: string;
  status: ExtendedAssignmentTaskStatus;
  completionNote?: string;
};

export type SaveTaskResultsBatchInput = {
  ctx: AssistExecutionContext;
  updates: TaskResultBatchItem[];
};

export async function saveTaskResultsBatch(
  input: SaveTaskResultsBatchInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  const { ctx, updates } = input;
  if (!updates.length) {
    return { ok: true, data: ctx };
  }

  for (const item of updates) {
    if (taskStatusRequiresNote(item.status) && !item.completionNote?.trim()) {
      return assistWorkflowErrorToResult(
        createAssistWorkflowError('AWF_VALIDATION', {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'saveTaskResultsBatch',
        }, 'Abweichung erfordert eine Begründung.'),
      );
    }
  }

  const roleKey = ctx.roleKey as RoleKey | null;
  const updateFn =
    getServiceMode() === 'supabase'
      ? updateLiveEmployeePortalTasksBatch
      : updateEmployeePortalTasksBatch;

  const result = await updateFn(
    ctx.tenantId,
    ctx.assignmentId,
    ctx.employeeId,
    roleKey,
    updates,
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
