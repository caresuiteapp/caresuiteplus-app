/**
 * ASSIST.STABILIZE.3 — End service with service_end persistence + readback verification.
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorFromSupabase,
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
  type AssistWorkflowErrorCode,
} from './assistWorkflowErrors';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import {
  ensureOpenPauseEndEvent,
  ensureVisitTimeEvent,
  hasOpenPauseSegment,
} from './saveVisitTimeEvent';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { getServiceMode } from '@/lib/services/mode';
import { mirrorAssistVisitStatusFromAssignment } from '@/lib/portal/employeePortalExecutionLiveService';
import { checkVisitDeviationGate } from '@/lib/wfm/wfmOfficeTimekeepingService';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import { resolveAllowedActions, resolveAssistExecutionDiagnostics } from './resolveAllowedActions';
import { repairWorkflowState } from './repairWorkflowState';
import type { WorkflowDeviationApproval } from './startService';

type WorkflowFail = { ok: false; error: string; errorCode?: string };

export type EndServiceResult = AssistExecutionContext & {
  /** The employee workflow finished; one ancillary administration mirror needs a later retry. */
  wfmSyncFailed?: boolean;
};

const ACTIVE_SERVICE_STATUSES: AssignmentStatus[] = ['gestartet', 'pausiert'];
const POST_SERVICE_STATUSES: AssignmentStatus[] = [
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
  'abgeschlossen',
];

function endServiceError(
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
        operation: 'endService',
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

import type { VisitTimesSummary } from './calculateVisitTimes';

function mergeServiceEndedVisitTimes(
  ctx: AssistExecutionContext,
  visitTimes: VisitTimesSummary | null | undefined,
  fallbackIso?: string,
): VisitTimesSummary {
  const serviceEndedAt =
    visitTimes?.serviceEndedAt ?? ctx.detail.actualEndAt ?? fallbackIso ?? new Date().toISOString();
  return {
    driveSeconds: visitTimes?.driveSeconds ?? null,
    serviceSeconds: visitTimes?.serviceSeconds ?? 0,
    pauseSeconds: visitTimes?.pauseSeconds ?? null,
    totalSeconds: visitTimes?.totalSeconds ?? null,
    driveStartedAt: visitTimes?.driveStartedAt ?? ctx.detail.onTheWayAt ?? null,
    serviceStartedAt: visitTimes?.serviceStartedAt ?? ctx.detail.actualStartAt ?? null,
    pauseStartedAt: visitTimes?.pauseStartedAt ?? null,
    arrivedAt: visitTimes?.arrivedAt ?? ctx.detail.arrivedAt ?? null,
    serviceEndedAt,
    activeTimer: null,
  };
}

function buildOptimisticEndedContext(
  ctx: AssistExecutionContext,
  visitTimes: VisitTimesSummary,
  targetStatus: AssignmentStatus = 'beendet',
): AssistExecutionContext {
  const detail = {
    ...ctx.detail,
    status: targetStatus,
    actualEndAt: visitTimes.serviceEndedAt ?? ctx.detail.actualEndAt,
  };
  const workflow = {
    derivedStatus: targetStatus,
    recordedStatus: targetStatus,
    consistencyStatus: ctx.consistencyStatus,
    inconsistencies: ctx.inconsistencies,
    repairOptions: ctx.repairOptions,
    canStartService: false,
    nextActionHint: null,
  };
  return {
    ...ctx,
    assignmentStatus: targetStatus,
    derivedStatus: targetStatus,
    detail,
    visitTimes,
    diagnostics: resolveAssistExecutionDiagnostics(targetStatus, visitTimes, workflow),
    allowedActions: resolveAllowedActions({
      assignmentStatus: targetStatus,
      visitTimes,
      detail,
      derivedStatus: targetStatus,
      canStartService: false,
    }),
  };
}

async function persistEndedExecutionMirrors(
  ctx: AssistExecutionContext,
  visitTimes: VisitTimesSummary,
  targetStatus: AssignmentStatus,
): Promise<{ wfmSyncFailed: boolean }> {
  let wfmSyncFailed = false;
  const upserted = await upsertAssistVisitExecutionState(
    ctx.tenantId,
    ctx.assignmentId,
    targetStatus,
    {
      employeeId: ctx.employeeId,
      visitTimes,
      documentationComplete: ctx.detail.documentationStatus === 'submitted',
    },
  );
  if (!upserted.ok) {
    // service_end is the authoritative employee time event. A secondary
    // execution snapshot must never force the employee to repeat a completed
    // action; finalization retries the administration/WFM projection.
    wfmSyncFailed = true;
  }

  if (getServiceMode() === 'supabase') {
    const mirrored = await mirrorAssistVisitStatusFromAssignment(
      ctx.tenantId,
      ctx.assignmentId,
      targetStatus,
      ctx.profileId ?? null,
    );
    if (!mirrored.ok) {
      wfmSyncFailed = true;
    }
  }
  return { wfmSyncFailed };
}

function resolvePostServiceTargetStatus(ctx: AssistExecutionContext): AssignmentStatus {
  return POST_SERVICE_STATUSES.includes(ctx.assignmentStatus)
    ? ctx.assignmentStatus
    : 'beendet';
}

async function prepareEndServiceTransition(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  let workingCtx = ctx;

  // The durable service_start event can be ahead of assignments.status after
  // an earlier request lost its response. Repair that forward-only drift once
  // before validating the end transition.
  if (
    ACTIVE_SERVICE_STATUSES.includes(ctx.derivedStatus) &&
    !ACTIVE_SERVICE_STATUSES.includes(ctx.assignmentStatus) &&
    !POST_SERVICE_STATUSES.includes(ctx.assignmentStatus)
  ) {
    const repaired = await repairWorkflowState(ctx);
    if (!repaired.ok) return repaired;
    if (repaired.data.repaired) workingCtx = repaired.data.ctx;
  }

  // A previous end attempt may already have advanced the assignment while the
  // service_end event or another mirror failed. Continue idempotently from
  // that durable state instead of trying an invalid backwards transition.
  if (POST_SERVICE_STATUSES.includes(workingCtx.assignmentStatus)) {
    return { ok: true, data: workingCtx };
  }

  const transitioned = await transitionAssistExecutionStatus(workingCtx, 'beendet', {
    hasServiceStarted: true,
    hasTravelEnded: Boolean(workingCtx.visitTimes?.arrivedAt),
    skipStatusPersistence: true,
  });
  if (transitioned.ok) return transitioned;

  // updateStatus can be committed before an ancillary mirror reports an
  // error. Read the real state back and finish the missing time event when the
  // requested transition already reached a post-service status.
  const refreshed = await reloadContext(workingCtx);
  if (refreshed.ok && POST_SERVICE_STATUSES.includes(refreshed.data.assignmentStatus)) {
    return refreshed;
  }

  return transitioned;
}

async function verifyEndServiceReadback(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  const refreshed = await reloadContext(ctx);
  if (!refreshed.ok) {
    return endServiceError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
  }

  const data = refreshed.data;
  if (!data.visitTimes?.serviceEndedAt) {
    return endServiceError(
      'WORKFLOW_TIME_EVENT_FAILED',
      ctx,
      'service_end fehlt nach Beenden — DB-Schreibvorgang unvollständig.',
    );
  }

  if (data.visitTimes.serviceSeconds == null && data.visitTimes.serviceEndedAt) {
    // Zero-length service is valid after immediate end.
  } else if (data.visitTimes.serviceSeconds == null) {
    return endServiceError(
      'WORKFLOW_TIME_EVENT_FAILED',
      ctx,
      'serviceSeconds null nach Beenden — Zeit nicht lesbar.',
    );
  }

  if (data.diagnostics.isServiceEnded !== true) {
    return endServiceError(
      'WORKFLOW_INVALID_STATE',
      ctx,
      'isServiceEnded=false nach Beenden',
    );
  }

  if (
    data.derivedStatus !== 'beendet' &&
    !['beendet', 'dokumentation_offen'].includes(data.assignmentStatus)
  ) {
    return endServiceError(
      'WORKFLOW_INVALID_STATE',
      ctx,
      `Status nach Beenden unerwartet: ${data.derivedStatus}`,
    );
  }

  return refreshed;
}

async function persistEndServiceEvents(
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
          operation: 'endService.fetchTimeEvents',
        },
      ),
    );
  }

  const existing = events.data.map((e) => ({
    eventType: e.eventType,
    occurredAt: e.occurredAt,
  }));

  if (hasOpenPauseSegment(existing)) {
    const pauseClosed = await ensureOpenPauseEndEvent(
      {
        tenantId: ctx.tenantId,
        visitId: ctx.assistVisitId,
        recordedBy: ctx.profileId ?? ctx.employeeId,
        employeeId: ctx.employeeId,
        profileId: ctx.profileId,
      },
      existing,
    );
    if (!pauseClosed.ok) {
      return endServiceError('WORKFLOW_TIME_EVENT_FAILED', ctx, pauseClosed.error);
    }
  }

  const refreshedEvents = await fetchTimeEventsForVisit(ctx.tenantId, ctx.assistVisitId, 50);
  const eventList = refreshedEvents.ok
    ? refreshedEvents.data.map((e) => ({
        eventType: e.eventType,
        occurredAt: e.occurredAt,
      }))
    : existing;

  const saved = await ensureVisitTimeEvent(
    {
      tenantId: ctx.tenantId,
      visitId: ctx.assistVisitId,
      eventType: 'service_end',
      recordedBy: ctx.profileId ?? ctx.employeeId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
    },
    eventList,
  );

  if (!saved.ok) {
    return endServiceError('WORKFLOW_TIME_EVENT_FAILED', ctx, saved.error);
  }

  return { ok: true, data: undefined };
}

export async function endService(
  ctx: AssistExecutionContext,
  options: WorkflowDeviationApproval = {},
): Promise<ServiceResult<EndServiceResult>> {
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

  if (ctx.visitTimes?.serviceEndedAt) {
    const targetStatus = resolvePostServiceTargetStatus(ctx);
    const mirrors = await persistEndedExecutionMirrors(
      ctx,
      mergeServiceEndedVisitTimes(ctx, ctx.visitTimes),
      targetStatus,
    );
    const refreshed = await reloadContext(ctx);
    const completedCtx = refreshed.ok
      ? refreshed.data
      : buildOptimisticEndedContext(
          ctx,
          mergeServiceEndedVisitTimes(ctx, ctx.visitTimes),
          targetStatus,
        );
    return {
      ok: true,
      data: { ...completedCtx, wfmSyncFailed: mirrors.wfmSyncFailed },
    };
  }

  const actualEnd = new Date().toISOString();
  const deviationGate = checkVisitDeviationGate(
    ctx.tenantId,
    ctx.employeeId,
    ctx.assistVisitId,
    'end',
    ctx.detail.plannedEndAt,
    actualEnd,
  );
  if (deviationGate.blocked && !options.deviationApproved) {
    return endServiceError(
      'WORKFLOW_DEVIATION_JUSTIFICATION_REQUIRED',
      ctx,
      'Abweichung zur geplanten Einsatz-Endzeit — schriftliche Begründung erforderlich.',
    );
  }

  const result = await prepareEndServiceTransition(ctx);

  if (!result.ok) {
    return result;
  }

  const eventsWritten = await persistEndServiceEvents(result.data);
  if (!eventsWritten.ok) return eventsWritten;

  const endedAt = new Date().toISOString();
  const mergedTimes = mergeServiceEndedVisitTimes(result.data, result.data.visitTimes, endedAt);

  const targetStatus = resolvePostServiceTargetStatus(result.data);
  const mirrors = await persistEndedExecutionMirrors(result.data, mergedTimes, targetStatus);

  return {
    ok: true,
    data: {
      ...buildOptimisticEndedContext(result.data, mergedTimes, targetStatus),
      wfmSyncFailed: mirrors.wfmSyncFailed,
    },
  };
}
