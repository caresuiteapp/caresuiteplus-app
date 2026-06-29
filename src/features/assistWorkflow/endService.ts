/**
 * ASSIST.WORKFLOW.2 — End service / checkout (requires service_started_at).
 */
import type { ServiceResult } from '@/types';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';

export async function endService(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const serviceStarted = Boolean(ctx.visitTimes?.serviceStartedAt);

  if (!serviceStarted) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_SERVICE_NOT_STARTED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        assistVisitId: ctx.assistVisitId,
        operation: 'endService',
      }, 'Service ended without service_started_at - INVALID'),
    );
  }

  const travelEnded = Boolean(ctx.visitTimes?.arrivedAt || ctx.visitTimes?.driveStartedAt);
  if (!ctx.visitTimes?.arrivedAt && ctx.assignmentStatus !== 'gestartet' && ctx.assignmentStatus !== 'pausiert') {
    if (!travelEnded) {
      return assistWorkflowErrorToResult(
        createAssistWorkflowError('WORKFLOW_TRAVEL_NOT_STOPPED', {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'endService',
        }),
      );
    }
  }

  const result = await transitionAssistExecutionStatus(ctx, 'beendet', {
    hasServiceStarted: true,
    hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
  });

  if (result.ok) {
    void upsertAssistVisitExecutionState(ctx.tenantId, ctx.assignmentId, 'beendet', {
      employeeId: ctx.employeeId,
      visitTimes: ctx.visitTimes,
      documentationComplete: false,
    });
  }

  return result;
}
