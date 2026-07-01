/**
 * ASSIST.STABILIZE.3 — End pause with pause_end event + readback verification.
 */
import type { ServiceResult } from '@/types';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { isAssignmentLocked } from './assistVisitStateMachine';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { ensureOpenPauseEndEvent, hasOpenPauseSegment } from './saveVisitTimeEvent';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorFromSupabase,
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
  type AssistWorkflowErrorCode,
} from './assistWorkflowErrors';

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
        operation: 'endPause',
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

async function verifyEndPauseReadback(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const refreshed = await reloadContext(ctx);
  if (!refreshed.ok) {
    return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
  }

  const data = refreshed.data;
  if (data.derivedStatus !== 'gestartet' && data.assignmentStatus !== 'gestartet') {
    return pauseError(
      'WORKFLOW_INVALID_STATE',
      ctx,
      `Status nach Fortsetzen erwartet gestartet, ist ${data.derivedStatus}`,
    );
  }

  if (hasOpenPauseSegment(data.timeEvents)) {
    return pauseError(
      'WORKFLOW_TIME_EVENT_FAILED',
      ctx,
      'pause_end fehlt nach Fortsetzen — offene Pause.',
    );
  }

  if (data.visitTimes?.activeTimer !== 'service') {
    return pauseError(
      'WORKFLOW_INVALID_STATE',
      ctx,
      `activeTimer=${data.visitTimes?.activeTimer} erwartet service`,
    );
  }

  if (!data.allowedActions.includes('start_pause')) {
    return pauseError('WORKFLOW_INVALID_STATE', ctx, 'start_pause nicht in allowedActions');
  }

  return refreshed;
}

async function persistPauseEndEvent(
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
          operation: 'endPause.fetchTimeEvents',
        },
      ),
    );
  }

  const existing = events.data.map((e) => ({ eventType: e.eventType }));
  const saved = await ensureOpenPauseEndEvent(
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

async function applyExecutionStateAfterResume(
  ctx: AssistExecutionContext,
  visitTimes: AssistExecutionContext['visitTimes'],
): Promise<ServiceResult<void>> {
  const upserted = await upsertAssistVisitExecutionState(
    ctx.tenantId,
    ctx.assignmentId,
    'gestartet',
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

export async function endPause(
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

  if (ctx.assignmentStatus === 'gestartet' && !hasOpenPauseSegment(ctx.timeEvents)) {
    const refreshed = await reloadContext(ctx);
    return refreshed.ok ? refreshed : pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
  }

  if (ctx.assignmentStatus !== 'pausiert' && ctx.derivedStatus !== 'pausiert') {
    return pauseError('WORKFLOW_INVALID_STATE', ctx, 'Keine aktive Pause zum Beenden.');
  }

  const result = await transitionAssistExecutionStatus(ctx, 'gestartet', {
    hasServiceStarted: true,
    hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
  });

  if (!result.ok) {
    return pauseError('WORKFLOW_INVALID_STATE', ctx, result.error);
  }

  const backfill = await persistPauseEndEvent(ctx);
  if (!backfill.ok) return backfill;

  const refreshed = await reloadContext(ctx);
  if (!refreshed.ok) {
    return pauseError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
  }

  const stateWrite = await applyExecutionStateAfterResume(ctx, refreshed.data.visitTimes);
  if (!stateWrite.ok) return stateWrite;

  return verifyEndPauseReadback(ctx);
}
