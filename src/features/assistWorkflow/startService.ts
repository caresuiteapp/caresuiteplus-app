/**
 * ASSIST.WORKFLOW.2 — Start service at client (sets service_started_at via time event).
 */
import type { ServiceResult } from '@/types';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export async function startService(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  if (ctx.assignmentStatus !== 'angekommen' && ctx.assignmentStatus !== 'pausiert') {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('WORKFLOW_INVALID_STATE', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'startService',
      }, 'Einsatz kann nur nach Ankunft gestartet werden.'),
    );
  }

  if (!ctx.visitTimes?.arrivedAt && ctx.assignmentStatus === 'angekommen') {
    // Status says arrived but time event missing — allow transition (persist will backfill).
  }

  const result = await transitionAssistExecutionStatus(ctx, 'gestartet', {
    hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
  });

  if (result.ok) {
    void upsertAssistVisitExecutionState(ctx.tenantId, ctx.assignmentId, 'gestartet', {
      employeeId: ctx.employeeId,
      visitTimes: result.data.visitTimes,
    });
  }

  return result;
}
