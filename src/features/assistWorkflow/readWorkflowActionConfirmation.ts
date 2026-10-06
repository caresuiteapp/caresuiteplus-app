import type { AssistExecutionContext } from './types';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import {
  didWorkflowActionReachPostcondition,
  type RecoverableWorkflowAction,
} from './workflowRecoveryVerification';
import {
  withWorkflowTimeout,
  WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS,
} from './internal/withWorkflowTimeout';

export type WorkflowActionConfirmation =
  | { state: 'confirmed'; context: AssistExecutionContext }
  | { state: 'pending' }
  | { state: 'unavailable' };

/** A pending write is confirmed by a fresh, read-only server read, never by a cached UI fallback. */
export async function readWorkflowActionConfirmation(
  before: AssistExecutionContext,
  action: RecoverableWorkflowAction,
): Promise<WorkflowActionConfirmation> {
  try {
    const result = await withWorkflowTimeout(
      resolveAssistExecutionContext({
        tenantId: before.tenantId,
        assignmentId: before.assignmentId,
        employeeId: before.employeeId,
        profileId: before.profileId,
        roleKey: before.roleKey as import('@/types').RoleKey | null,
        autoRepair: false,
      }),
      WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS,
      'workflowConfirmationReadback',
    );
    if (!result.ok) return { state: 'unavailable' };
    return didWorkflowActionReachPostcondition(action, before, result.data)
      ? { state: 'confirmed', context: result.data }
      : { state: 'pending' };
  } catch {
    return { state: 'unavailable' };
  }
}
