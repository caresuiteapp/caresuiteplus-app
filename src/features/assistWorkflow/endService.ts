/**
 * ASSIST.STABILIZE.3 — End service with service_end persistence + readback verification.
 */
import type { ServiceResult } from '@/types';
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
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import { resolveAllowedActions, resolveAssistExecutionDiagnostics } from './resolveAllowedActions';

type WorkflowFail = { ok: false; error: string; errorCode?: string };

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
): AssistExecutionContext {
  const detail = {
    ...ctx.detail,
    status: 'beendet' as const,
    actualEndAt: visitTimes.serviceEndedAt ?? ctx.detail.actualEndAt,
  };
  const workflow = {
    derivedStatus: 'beendet' as const,
    recordedStatus: 'beendet' as const,
    consistencyStatus: ctx.consistencyStatus,
    inconsistencies: ctx.inconsistencies,
    repairOptions: ctx.repairOptions,
    canStartService: false,
    nextActionHint: null,
  };
  return {
    ...ctx,
    assignmentStatus: 'beendet',
    derivedStatus: 'beendet',
    detail,
    visitTimes,
    diagnostics: resolveAssistExecutionDiagnostics('beendet', visitTimes, workflow),
    allowedActions: resolveAllowedActions({
      assignmentStatus: 'beendet',
      visitTimes,
      detail,
      derivedStatus: 'beendet',
      canStartService: false,
    }),
  };
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

  const existing = events.data.map((e) => ({ eventType: e.eventType }));

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
    ? refreshedEvents.data.map((e) => ({ eventType: e.eventType }))
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

  if (ctx.visitTimes?.serviceEndedAt) {
    const refreshed = await reloadContext(ctx);
    return refreshed.ok ? refreshed : endServiceError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
  }

  const result = await transitionAssistExecutionStatus(ctx, 'beendet', {
    hasServiceStarted: true,
    hasTravelEnded: Boolean(ctx.visitTimes?.arrivedAt),
  });

  if (!result.ok) {
    return endServiceError('WORKFLOW_INVALID_STATE', ctx, result.error);
  }

  const eventsWritten = await persistEndServiceEvents(result.data);
  if (!eventsWritten.ok) return eventsWritten;

  const endedAt = new Date().toISOString();
  const mergedTimes = mergeServiceEndedVisitTimes(result.data, result.data.visitTimes, endedAt);

  const upserted = await upsertAssistVisitExecutionState(
    ctx.tenantId,
    ctx.assignmentId,
    'beendet',
    {
      employeeId: ctx.employeeId,
      visitTimes: mergedTimes,
      documentationComplete: false,
    },
  );

  if (!upserted.ok) {
    return endServiceError('WORKFLOW_TIME_EVENT_FAILED', ctx, upserted.error);
  }

  if (getServiceMode() === 'supabase') {
    void mirrorAssistVisitStatusFromAssignment(
      ctx.tenantId,
      ctx.assignmentId,
      'beendet',
      ctx.profileId ?? null,
    );
  }

  return { ok: true, data: buildOptimisticEndedContext(result.data, mergedTimes) };
}
