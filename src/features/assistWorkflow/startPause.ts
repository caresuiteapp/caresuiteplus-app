/**
 * ASSIST.STABILIZE.3 — Start pause with pause_start event + readback verification.
 */
import type { ServiceResult } from '@/types';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { isAssignmentLocked } from './assistVisitStateMachine';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { ensureOpenPauseStartEvent, hasOpenPauseSegment } from './saveVisitTimeEvent';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorFromSupabase,
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
  type AssistWorkflowErrorCode,
} from './assistWorkflowErrors';

type WorkflowFail = { ok: false; error: string; errorCode?: string };

function pauseError(
  code: AssistWorkflowErrorCode,
  ctx: AssistExecutionContext,
  technicalMessage?: string,
) {
  return assistWorkflowErrorToResult(
    createAssistWorkflowError(
      code,
      {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        employeeId: ctx.employeeId,
        assistVisitId: ctx.assistVisitId,
        operation: 'startPause',
      },
      technicalMessage,
    ),
  );
}

async function reloadContext(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  return resolveAssistExecutionContext({
    tenantId: ctx.tenantId,
    assignmentId: ctx.assignmentId,
    employeeId: ctx.employeeId,
    profileId: ctx.profileId,
    roleKey: ctx.roleKey as import('@/types').RoleKey | null,
    autoRepair: false,
  });
}

async function verifyStartPauseReadback(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const refreshed = await reloadContext(ctx);
  if (!refreshed.ok) {
    return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
  }

  const data = refreshed.data;
  if (data.derivedStatus !== 'pausiert' && data.assignmentStatus !== 'pausiert') {
    return pauseError(
      'WORKFLOW_INVALID_STATE',
      ctx,
      `Status nach Pause erwartet pausiert, ist ${data.derivedStatus}`,
    );
  }

  if (!hasOpenPauseSegment(data.timeEvents)) {
    return pauseError(
      'WORKFLOW_TIME_EVENT_FAILED',
      ctx,
      'pause_start fehlt nach Pause — DB-Schreibvorgang unvollständig.',
    );
  }

  if (data.visitTimes?.activeTimer !== 'pause') {
    return pauseError(
      'WORKFLOW_INVALID_STATE',
      ctx,
      `activeTimer=${data.visitTimes?.activeTimer} erwartet pause`,
    );
  }

  if (!data.allowedActions.includes('end_pause')) {
    return pauseError('WORKFLOW_INVALID_STATE', ctx, 'end_pause nicht in allowedActions');
  }

  return refreshed;
}

async function persistPauseStartEvent(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<void>> {
  const events = await fetchTimeEventsForVisit(ctx.tenantId, ctx.assistVisitId, 50);
  if (!events.ok) {
    return assistWorkflowErrorToResult(
      assistWorkflowErrorFromSupabase(
        { message: events.error },
        {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          assistVisitId: ctx.assistVisitId,
          employeeId: ctx.employeeId,
          operation: 'startPause.fetchTimeEvents',
        },
      ),
    );
  }

  const existing = events.data.map((e) => ({ eventType: e.eventType }));
  const saved = await ensureOpenPauseStartEvent(
    {
      tenantId: ctx.tenantId,
      visitId: ctx.assistVisitId,
      recordedBy: ctx.profileId ?? ctx.employeeId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
    },
    existing,
  );

  if (!saved.ok) {
    return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, saved.error);
  }

  return { ok: true, data: undefined };
}

async function applyExecutionStateAfterPause(
  ctx: AssistExecutionContext,
  visitTimes: AssistExecutionContext['visitTimes'],
): Promise<ServiceResult<void>> {
  const upserted = await upsertAssistVisitExecutionState(
    ctx.tenantId,
    ctx.assignmentId,
    'pausiert',
    {
      employeeId: ctx.employeeId,
      visitTimes,
    },
  );

  if (!upserted.ok) {
    return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, upserted.error);
  }

  return { ok: true, data: undefined };
}

export async function startPause(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  if (!ctx.tenantId || !ctx.assignmentId || !ctx.employeeId) {
    return pauseError('AWF_CONTEXT_MISSING', ctx);
  }

  if (isAssignmentLocked(ctx.assignmentStatus) || ctx.detail.isLocked) {
    return pauseError('WORKFLOW_INVALID_STATE', ctx, 'Einsatz ist abgeschlossen oder gesperrt.');
  }

  if (!ctx.visitTimes?.serviceStartedAt) {
    return pauseError('WORKFLOW_SERVICE_NOT_STARTED', ctx);
  }

  if (ctx.assignmentStatus === 'pausiert' || ctx.derivedStatus === 'pausiert') {
    if (hasOpenPauseSegment(ctx.timeEvents)) {
      const refreshed = await reloadContext(ctx);
      return refreshed.ok ? refreshed : pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
    }
    const saved = await persistPauseStartEvent(ctx);
    if (!saved.ok) return saved;
    const refreshed = await reloadContext(ctx);
    if (!refreshed.ok) return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
    await applyExecutionStateAfterPause(ctx, refreshed.data.visitTimes);
    return verifyStartPauseReadback(ctx);
  }

  if (ctx.assignmentStatus !== 'gestartet' && ctx.derivedStatus !== 'gestartet') {
    return pauseError(
      'WORKFLOW_INVALID_STATE',
      ctx,
      'Pause nur während laufendem Einsatz möglich.',
    );
  }

  const result = await transitionAssistExecutionStatus(ctx, 'pausiert', {
    hasServiceStarted: true,
    hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
  });

  if (!result.ok) {
    return pauseError('WORKFLOW_INVALID_STATE', ctx, result.error);
  }

  const backfill = await persistPauseStartEvent(ctx);
  if (!backfill.ok) return backfill;

  const refreshed = await reloadContext(ctx);
  if (!refreshed.ok) {
    return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
  }

  const stateWrite = await applyExecutionStateAfterPause(ctx, refreshed.data.visitTimes);
  if (!stateWrite.ok) return stateWrite;

  return verifyStartPauseReadback(ctx);
}
