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
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';

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

  if (data.visitTimes.serviceSeconds == null) {
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

  const eventsWritten = await persistEndServiceEvents(ctx);
  if (!eventsWritten.ok) return eventsWritten;

  const refreshed = await reloadContext(ctx);
  if (!refreshed.ok) {
    return endServiceError('WORKFLOW_TIME_EVENT_FAILED', ctx, refreshed.error);
  }

  const upserted = await upsertAssistVisitExecutionState(
    ctx.tenantId,
    ctx.assignmentId,
    'beendet',
    {
      employeeId: ctx.employeeId,
      visitTimes: refreshed.data.visitTimes,
      documentationComplete: false,
    },
  );

  if (!upserted.ok) {
    return endServiceError('WORKFLOW_TIME_EVENT_FAILED', ctx, upserted.error);
  }

  return verifyEndServiceReadback(ctx);
}
