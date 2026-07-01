/**
 * ASSIST.STABILIZE.2 — Idempotent start service with readback verification.
 */
import type { ServiceResult } from '@/types';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { isAssignmentLocked } from './assistVisitStateMachine';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { repairWorkflowState } from './repairWorkflowState';
import { ensureVisitTimeEvent } from './saveVisitTimeEvent';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorFromSupabase,
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
  type AssistWorkflowErrorCode,
} from './assistWorkflowErrors';

const MAX_REPAIR_DEPTH = 1;

type WorkflowFail = { ok: false; error: string; errorCode?: string };

function mapStartServiceFailureCode(failure: WorkflowFail): AssistWorkflowErrorCode {
  switch (failure.errorCode) {
    case 'AWF_RLS_DENIED':
      return 'START_SERVICE_RLS_DENIED';
    case 'AWF_SCHEMA_MISMATCH':
      return 'START_SERVICE_SCHEMA_MISSING';
    case 'AWF_INVALID_TRANSITION':
      return 'START_SERVICE_INVALID_TRANSITION';
    default:
      return 'START_SERVICE_DB_ERROR';
  }
}

function startServiceError(
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
        operation: 'startService',
      },
      technicalMessage,
    ),
  );
}

function canAttemptStartService(ctx: AssistExecutionContext): boolean {
  const derived = ctx.derivedStatus ?? ctx.assignmentStatus;
  if (derived === 'angekommen') return true;
  if (ctx.assignmentStatus === 'pausiert') return false;
  return ctx.assignmentStatus === 'gestartet' && !ctx.visitTimes?.serviceStartedAt;
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

async function verifyStartServiceReadback(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const refreshed = await reloadContext(ctx);
  if (!refreshed.ok) {
    return startServiceError(
      'START_SERVICE_CONTEXT_MISSING',
      ctx,
      refreshed.error ?? 'Kontext nach Start konnte nicht geladen werden.',
    );
  }

  const data = refreshed.data;
  if (!data.visitTimes?.serviceStartedAt) {
    return startServiceError(
      'START_SERVICE_DB_ERROR',
      ctx,
      'service_started_at fehlt nach Start — DB-Schreibvorgang unvollständig.',
    );
  }

  if (data.derivedStatus !== 'gestartet') {
    return startServiceError(
      'START_SERVICE_INVALID_TRANSITION',
      ctx,
      `derivedStatus=${data.derivedStatus} erwartet gestartet`,
    );
  }

  if (!data.diagnostics.canEndService) {
    return startServiceError(
      'START_SERVICE_INVALID_TRANSITION',
      ctx,
      'canEndService=false nach Start',
    );
  }

  if (!data.allowedActions.includes('start_pause')) {
    return startServiceError(
      'START_SERVICE_INVALID_TRANSITION',
      ctx,
      'start_pause nicht in allowedActions',
    );
  }

  return refreshed;
}

async function persistServiceStartEvent(
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
          operation: 'startService.fetchTimeEvents',
        },
      ),
    );
  }

  const existing = events.data.map((e) => ({ eventType: e.eventType }));
  const saved = await ensureVisitTimeEvent(
    {
      tenantId: ctx.tenantId,
      visitId: ctx.assistVisitId,
      eventType: 'service_start',
      recordedBy: ctx.profileId ?? ctx.employeeId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
    },
    existing,
  );

  if (!saved.ok) {
    return startServiceError(mapStartServiceFailureCode(saved as WorkflowFail), ctx, saved.error);
  }

  return { ok: true, data: undefined };
}

async function applyExecutionStateAfterStart(
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
    return startServiceError(mapStartServiceFailureCode(upserted as WorkflowFail), ctx, upserted.error);
  }

  return { ok: true, data: undefined };
}

/** Backfill service_start when assignment already gestartet but event/timestamp missing. */
async function backfillServiceStart(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const saved = await persistServiceStartEvent(ctx);
  if (!saved.ok) return saved;

  const refreshed = await reloadContext(ctx);
  if (!refreshed.ok) {
    return startServiceError('START_SERVICE_CONTEXT_MISSING', ctx, refreshed.error);
  }

  const stateWrite = await applyExecutionStateAfterStart(ctx, refreshed.data.visitTimes);
  if (!stateWrite.ok) return stateWrite;

  return verifyStartServiceReadback(ctx);
}

/** Normal angekommen → gestartet transition with time event + execution state. */
async function transitionToServiceStart(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const result = await transitionAssistExecutionStatus(ctx, 'gestartet', {
    hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
  });

  if (!result.ok) {
    return startServiceError(mapStartServiceFailureCode(result as WorkflowFail), ctx, result.error);
  }

  const stateWrite = await applyExecutionStateAfterStart(ctx, result.data.visitTimes);
  if (!stateWrite.ok) return stateWrite;

  return verifyStartServiceReadback(ctx);
}

export async function startService(
  ctx: AssistExecutionContext,
  depth = 0,
): Promise<ServiceResult<AssistExecutionContext>> {
  if (!ctx.tenantId || !ctx.assignmentId || !ctx.employeeId) {
    return startServiceError(
      'START_SERVICE_CONTEXT_MISSING',
      ctx,
      'tenantId, assignmentId oder employeeId fehlt',
    );
  }

  if (isAssignmentLocked(ctx.assignmentStatus) || ctx.detail.isLocked) {
    return startServiceError('START_SERVICE_INVALID_TRANSITION', ctx, 'Einsatz ist abgeschlossen oder gesperrt.');
  }

  const hasArrived =
    Boolean(ctx.visitTimes?.arrivedAt) ||
    ctx.assignmentStatus === 'angekommen' ||
    ctx.derivedStatus === 'angekommen';

  if (!hasArrived) {
    return startServiceError(
      'START_SERVICE_INVALID_TRANSITION',
      ctx,
      'Ankunft fehlt — Einsatz kann nicht gestartet werden.',
    );
  }

  if (ctx.visitTimes?.serviceStartedAt) {
    const refreshed = await reloadContext(ctx);
    if (!refreshed.ok) {
      return startServiceError('START_SERVICE_CONTEXT_MISSING', ctx, refreshed.error);
    }
    if (refreshed.data.derivedStatus === 'gestartet' && refreshed.data.diagnostics.canEndService) {
      return refreshed;
    }
  }

  if (!canAttemptStartService(ctx)) {
    if (ctx.consistencyStatus === 'repairable' && depth < MAX_REPAIR_DEPTH) {
      const repaired = await repairWorkflowState(ctx);
      if (repaired.ok && repaired.data.repaired) {
        return startService(repaired.data.ctx, depth + 1);
      }
    }
    return startServiceError(
      'START_SERVICE_INVALID_TRANSITION',
      ctx,
      'Einsatz kann nur nach Ankunft gestartet werden.',
    );
  }

  let workingCtx = ctx;

  if (
    workingCtx.consistencyStatus === 'repairable' &&
    workingCtx.derivedStatus !== workingCtx.assignmentStatus &&
    !['gestartet', 'pausiert'].includes(workingCtx.assignmentStatus) &&
    depth < MAX_REPAIR_DEPTH
  ) {
    const repaired = await repairWorkflowState(workingCtx);
    if (repaired.ok && repaired.data.repaired) {
      workingCtx = repaired.data.ctx;
    }
  }

  if (workingCtx.assignmentStatus === 'gestartet' && !workingCtx.visitTimes?.serviceStartedAt) {
    return backfillServiceStart(workingCtx);
  }

  return transitionToServiceStart(workingCtx);
}
