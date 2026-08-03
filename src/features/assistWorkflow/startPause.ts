/** Fast, idempotent pause start. Canonical status + time event block the UI; projections do not. */
import type { ServiceResult } from '@/types';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';
import { isAssignmentLocked } from './assistVisitStateMachine';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { calculateVisitTimes } from './calculateVisitTimes';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { ensureOpenPauseStartEvent, hasOpenPauseSegment } from './saveVisitTimeEvent';
import { resolveAllowedActions, resolveAssistExecutionDiagnostics } from './resolveAllowedActions';
import type { AssistExecutionContext } from './types';
import { assistWorkflowErrorToResult, createAssistWorkflowError, type AssistWorkflowErrorCode } from './assistWorkflowErrors';

function pauseError(code: AssistWorkflowErrorCode, ctx: AssistExecutionContext, technicalMessage?: string) {
  return assistWorkflowErrorToResult(createAssistWorkflowError(code, {
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    assistVisitId: ctx.assistVisitId,
    operation: 'startPause',
  }, technicalMessage));
}

function buildPausedContext(ctx: AssistExecutionContext, occurredAt: string): AssistExecutionContext {
  const timeEvents = hasOpenPauseSegment(ctx.timeEvents)
    ? ctx.timeEvents
    : [...ctx.timeEvents, { eventType: 'pause_start', occurredAt }];
  const visitTimes = calculateVisitTimes(timeEvents, 'pausiert');
  const detail = { ...ctx.detail, status: 'pausiert' as const };
  const workflow = {
    derivedStatus: 'pausiert' as const,
    recordedStatus: 'pausiert' as const,
    consistencyStatus: ctx.consistencyStatus,
    inconsistencies: ctx.inconsistencies,
    repairOptions: ctx.repairOptions,
    canStartService: false,
    nextActionHint: null,
  };
  return {
    ...ctx,
    assignmentStatus: 'pausiert',
    derivedStatus: 'pausiert',
    detail,
    timeEvents,
    visitTimes,
    diagnostics: resolveAssistExecutionDiagnostics('pausiert', visitTimes, workflow),
    allowedActions: resolveAllowedActions({ assignmentStatus: 'pausiert', visitTimes, detail, derivedStatus: 'pausiert', canStartService: false }),
  };
}

function schedulePauseProjection(ctx: AssistExecutionContext): void {
  scheduleDeferredTask(`assist-execution-state:${ctx.tenantId}:${ctx.assignmentId}`, async () => {
    const result = await upsertAssistVisitExecutionState(ctx.tenantId, ctx.assignmentId, 'pausiert', {
      employeeId: ctx.employeeId,
      visitTimes: ctx.visitTimes,
    });
    if (!result.ok) throw new Error(result.error);
  });
}

export async function startPause(ctx: AssistExecutionContext): Promise<ServiceResult<AssistExecutionContext>> {
  if (!ctx.tenantId || !ctx.assignmentId || !ctx.employeeId) return pauseError('AWF_CONTEXT_MISSING', ctx);
  if (isAssignmentLocked(ctx.assignmentStatus) || ctx.detail.isLocked) return pauseError('WORKFLOW_INVALID_STATE', ctx, 'Einsatz ist abgeschlossen oder gesperrt.');
  if (!ctx.visitTimes?.serviceStartedAt) return pauseError('WORKFLOW_SERVICE_NOT_STARTED', ctx);

  if ((ctx.assignmentStatus === 'pausiert' || ctx.derivedStatus === 'pausiert') && hasOpenPauseSegment(ctx.timeEvents)) {
    schedulePauseProjection(ctx);
    return { ok: true, data: ctx };
  }
  if (ctx.assignmentStatus !== 'gestartet' && ctx.derivedStatus !== 'gestartet' && ctx.assignmentStatus !== 'pausiert') {
    return pauseError('WORKFLOW_INVALID_STATE', ctx, 'Pause nur während laufendem Einsatz möglich.');
  }

  const transitioned = ctx.assignmentStatus === 'pausiert'
    ? { ok: true as const, data: ctx }
    : await transitionAssistExecutionStatus(ctx, 'pausiert', {
        hasServiceStarted: true,
        hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
        skipStatusPersistence: true,
        fastWorkflow: true,
      });
  if (!transitioned.ok) return pauseError('WORKFLOW_INVALID_STATE', ctx, transitioned.error);

  const occurredAt = new Date().toISOString();
  const saved = await ensureOpenPauseStartEvent({
    tenantId: ctx.tenantId,
    visitId: ctx.assistVisitId,
    occurredAt,
    recordedBy: ctx.profileId ?? ctx.employeeId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
  }, ctx.timeEvents);
  if (!saved.ok) return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, saved.error);

  const optimistic = buildPausedContext(transitioned.data, occurredAt);
  schedulePauseProjection(optimistic);
  return { ok: true, data: optimistic };
}
