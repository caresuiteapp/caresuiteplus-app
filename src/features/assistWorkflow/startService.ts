/**
 * ASSIST.STABILIZE.2 — Idempotent start service with readback verification.
 */
import type { ServiceResult } from '@/types';
import { isAssignmentLocked } from './assistVisitStateMachine';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { repairWorkflowState } from './repairWorkflowState';
import { ensureVisitTimeEvent } from './saveVisitTimeEvent';
import { resolveAllowedActions, resolveAssistExecutionDiagnostics } from './resolveAllowedActions';
import { checkVisitDeviationGate } from '@/lib/wfm/wfmOfficeTimekeepingService';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';
import type { AssistExecutionContext } from './types';
import type { VisitTimesSummary } from './calculateVisitTimes';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
  type AssistWorkflowErrorCode,
} from './assistWorkflowErrors';

const MAX_REPAIR_DEPTH = 1;

export type WorkflowDeviationApproval = {
  /** The visible deviation dialog validated the justification for this exact action. */
  deviationApproved?: boolean;
  deviationPhase?: 'start' | 'end';
  deviationJustification?: string;
  deviationVisitId?: string;
  deviationActualAt?: string;
};

export function isValidWorkflowDeviationApproval(
  options: WorkflowDeviationApproval,
  visitId: string,
  phase: 'start' | 'end',
): boolean {
  return options.deviationApproved === true &&
    options.deviationPhase === phase &&
    options.deviationVisitId === visitId &&
    Boolean(options.deviationActualAt) &&
    (options.deviationJustification?.trim().length ?? 0) >= 10;
}

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

function mergeServiceStartedVisitTimes(
  ctx: AssistExecutionContext,
  visitTimes: VisitTimesSummary | null | undefined,
  fallbackIso?: string,
): VisitTimesSummary {
  const serviceStartedAt =
    visitTimes?.serviceStartedAt ?? ctx.detail.actualStartAt ?? fallbackIso ?? new Date().toISOString();
  return {
    driveSeconds: visitTimes?.driveSeconds ?? null,
    serviceSeconds: visitTimes?.serviceSeconds ?? null,
    pauseSeconds: visitTimes?.pauseSeconds ?? null,
    totalSeconds: visitTimes?.totalSeconds ?? null,
    driveStartedAt: visitTimes?.driveStartedAt ?? ctx.detail.onTheWayAt ?? null,
    serviceStartedAt,
    pauseStartedAt: visitTimes?.pauseStartedAt ?? null,
    arrivedAt: visitTimes?.arrivedAt ?? ctx.detail.arrivedAt ?? null,
    serviceEndedAt: visitTimes?.serviceEndedAt ?? null,
    activeTimer: visitTimes?.activeTimer ?? 'service',
  };
}

function buildOptimisticStartedContext(
  ctx: AssistExecutionContext,
  visitTimes: VisitTimesSummary,
): AssistExecutionContext {
  const detail = {
    ...ctx.detail,
    status: 'gestartet' as const,
    actualStartAt: visitTimes.serviceStartedAt ?? ctx.detail.actualStartAt,
  };
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
    visitTimes,
    diagnostics: resolveAssistExecutionDiagnostics('gestartet', visitTimes, workflow),
    allowedActions: resolveAllowedActions({
      assignmentStatus: 'gestartet',
      visitTimes,
      detail,
      derivedStatus: 'gestartet',
      canStartService: false,
    }),
  };
}

async function persistServiceStartEvent(
  ctx: AssistExecutionContext,
  approval?: WorkflowDeviationApproval,
): Promise<ServiceResult<{ occurredAt: string }>> {
  const existing = ctx.timeEvents.map((e) => ({
    eventType: e.eventType,
    occurredAt: e.occurredAt,
  }));
  const occurredAt = new Date().toISOString();
  const saved = await ensureVisitTimeEvent(
    {
      tenantId: ctx.tenantId,
      visitId: ctx.assistVisitId,
      eventType: 'service_start',
      occurredAt,
      recordedBy: ctx.profileId ?? ctx.employeeId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      metadata: isValidWorkflowDeviationApproval(approval ?? {}, ctx.assistVisitId, 'start')
        ? {
            deviation_approved: true,
            deviation_phase: 'start',
            deviation_justification: approval?.deviationJustification?.trim(),
            deviation_actual_at: approval?.deviationActualAt,
          }
        : undefined,
    },
    existing,
  );

  if (!saved.ok) {
    return startServiceError(mapStartServiceFailureCode(saved as WorkflowFail), ctx, saved.error);
  }

  return {
    ok: true,
    data: { occurredAt },
  };
}

function scheduleExecutionStateAfterStart(
  ctx: AssistExecutionContext,
  visitTimes: AssistExecutionContext['visitTimes'],
): void {
  scheduleDeferredTask(
    `assist-execution-state:${ctx.tenantId}:${ctx.assignmentId}`,
    async () => {
      const upserted = await upsertAssistVisitExecutionState(
        ctx.tenantId,
        ctx.assignmentId,
        'gestartet',
        { employeeId: ctx.employeeId, visitTimes },
      );
      if (!upserted.ok) throw new Error(upserted.error);
    },
  );
}

/** Backfill service_start when assignment already gestartet but event/timestamp missing. */
async function backfillServiceStart(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const saved = await persistServiceStartEvent(ctx);
  if (!saved.ok) return saved;
  const mergedTimes = mergeServiceStartedVisitTimes(
    ctx,
    ctx.visitTimes,
    saved.data.occurredAt,
  );
  const optimistic = buildOptimisticStartedContext(ctx, mergedTimes);
  scheduleExecutionStateAfterStart(optimistic, mergedTimes);
  return { ok: true, data: optimistic };
}
async function transitionToServiceStart(
  ctx: AssistExecutionContext,
  approval: WorkflowDeviationApproval,
): Promise<ServiceResult<AssistExecutionContext>> {
  const result = await transitionAssistExecutionStatus(ctx, 'gestartet', {
    hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
    skipStatusPersistence: true,
    fastWorkflow: true,
  });

  if (!result.ok) {
    return startServiceError(mapStartServiceFailureCode(result as WorkflowFail), ctx, result.error);
  }

  const eventSaved = await persistServiceStartEvent(result.data, approval);
  if (!eventSaved.ok) return eventSaved;

  const mergedTimes = mergeServiceStartedVisitTimes(
    result.data,
    result.data.visitTimes,
    eventSaved.data.occurredAt,
  );
  const optimistic = buildOptimisticStartedContext(result.data, mergedTimes);
  scheduleExecutionStateAfterStart(optimistic, mergedTimes);
  return { ok: true, data: optimistic };
}

export async function startService(
  ctx: AssistExecutionContext,
  options: WorkflowDeviationApproval = {},
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
    if (ctx.derivedStatus === 'gestartet' && ctx.diagnostics.canEndService) {
      return { ok: true, data: ctx };
    }
  }

  if (!canAttemptStartService(ctx)) {
    if (ctx.consistencyStatus === 'repairable' && depth < MAX_REPAIR_DEPTH) {
      const repaired = await repairWorkflowState(ctx);
      if (repaired.ok && repaired.data.repaired) {
        return startService(repaired.data.ctx, options, depth + 1);
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

  const actualStart = new Date().toISOString();
  const deviationGate = checkVisitDeviationGate(
    workingCtx.tenantId,
    workingCtx.employeeId,
    workingCtx.assistVisitId,
    'start',
    workingCtx.detail.plannedStartAt,
    actualStart,
  );
  if (deviationGate.blocked && !isValidWorkflowDeviationApproval(options, workingCtx.assistVisitId, 'start')) {
    return startServiceError(
      'WORKFLOW_DEVIATION_JUSTIFICATION_REQUIRED',
      workingCtx,
      'Abweichung zur geplanten Einsatzzeit — schriftliche Begründung erforderlich.',
    );
  }

  return transitionToServiceStart(workingCtx, options);
}
