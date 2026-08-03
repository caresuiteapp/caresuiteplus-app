/** Fast, idempotent pause end. */
import type { ServiceResult } from '@/types';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';
import { isAssignmentLocked } from './assistVisitStateMachine';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { calculateVisitTimes } from './calculateVisitTimes';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { ensureOpenPauseEndEvent, hasOpenPauseSegment } from './saveVisitTimeEvent';
import { resolveAllowedActions, resolveAssistExecutionDiagnostics } from './resolveAllowedActions';
import type { AssistExecutionContext } from './types';
import { assistWorkflowErrorToResult, createAssistWorkflowError, type AssistWorkflowErrorCode } from './assistWorkflowErrors';

function pauseError(code: AssistWorkflowErrorCode, ctx: AssistExecutionContext, technicalMessage?: string) {
  return assistWorkflowErrorToResult(createAssistWorkflowError(code, {
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    assistVisitId: ctx.assistVisitId,
    operation: 'endPause',
  }, technicalMessage));
}

function buildResumedContext(ctx: AssistExecutionContext, occurredAt: string): AssistExecutionContext {
  const timeEvents = hasOpenPauseSegment(ctx.timeEvents)
    ? [...ctx.timeEvents, { eventType: 'pause_end', occurredAt }]
    : ctx.timeEvents;
  const visitTimes = calculateVisitTimes(timeEvents, 'gestartet');
  const detail = { ...ctx.detail, status: 'gestartet' as const };
  const workflow = {
    derivedStatus: 'gestartet' as const,
    recordedStatus: 'gestartet' as const,
    consistencyStatus: ctx.consistencyStatus,
    inconsistencies: ctx.inconsistencies,
    repairOptions: ctx.repairOptions,
    canStartService: false,
    nextActionHint: null,
  };
  return {
    ...ctx,
    assignmentStatus: 'gestartet',
    derivedStatus: 'gestartet',
    detail,
    timeEvents,
    visitTimes,
    diagnostics: resolveAssistExecutionDiagnostics('gestartet', visitTimes, workflow),
    allowedActions: resolveAllowedActions({ assignmentStatus: 'gestartet', visitTimes, detail, derivedStatus: 'gestartet', canStartService: false }),
  };
}

function scheduleResumeProjection(ctx: AssistExecutionContext): void {
  scheduleDeferredTask(`assist-execution-state:${ctx.tenantId}:${ctx.assignmentId}`, async () => {
    const result = await upsertAssistVisitExecutionState(ctx.tenantId, ctx.assignmentId, 'gestartet', {
      employeeId: ctx.employeeId,
      visitTimes: ctx.visitTimes,
    });
    if (!result.ok) throw new Error(result.error);
  });
}

export async function endPause(ctx: AssistExecutionContext): Promise<ServiceResult<AssistExecutionContext>> {
  if (!ctx.tenantId || !ctx.assignmentId || !ctx.employeeId) return pauseError('AWF_CONTEXT_MISSING', ctx);
  if (isAssignmentLocked(ctx.assignmentStatus) || ctx.detail.isLocked) return pauseError('WORKFLOW_INVALID_STATE', ctx, 'Einsatz ist abgeschlossen oder gesperrt.');
  if (!ctx.visitTimes?.serviceStartedAt) return pauseError('WORKFLOW_SERVICE_NOT_STARTED', ctx);

  if (ctx.assignmentStatus === 'gestartet' && !hasOpenPauseSegment(ctx.timeEvents)) {
    scheduleResumeProjection(ctx);
    return { ok: true, data: ctx };
  }
  if (ctx.assignmentStatus !== 'pausiert' && ctx.derivedStatus !== 'pausiert') {
    return pauseError('WORKFLOW_INVALID_STATE', ctx, 'Keine aktive Pause zum Beenden.');
  }

  const transitioned = await transitionAssistExecutionStatus(ctx, 'gestartet', {
    hasServiceStarted: true,
    hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
    skipStatusPersistence: true,
    fastWorkflow: true,
  });
  if (!transitioned.ok) return pauseError('WORKFLOW_INVALID_STATE', ctx, transitioned.error);

  const occurredAt = new Date().toISOString();
  const saved = await ensureOpenPauseEndEvent({
    tenantId: ctx.tenantId,
    visitId: ctx.assistVisitId,
    occurredAt,
    recordedBy: ctx.profileId ?? ctx.employeeId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
  }, ctx.timeEvents);
  if (!saved.ok) return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, saved.error);

  const optimistic = buildResumedContext(transitioned.data, occurredAt);
  scheduleResumeProjection(optimistic);
  return { ok: true, data: optimistic };
}
