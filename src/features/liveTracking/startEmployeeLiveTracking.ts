/**
 * LT.GMAPS.2 — Transactional employee tracking start (DB producer).
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  appendLocationPoint,
  fetchActiveTrackingSession,
  fetchTimeEventsForVisit,
  recordTimeEvent,
  startTrackingSession,
} from '@/lib/assist/assistTrackingPersistenceService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { syncAssistTimeEventToWfmPortalSafe } from '@/lib/wfm/wfmAssistAdapter';
import { mirrorAssistVisitStatusFromAssignment } from '@/lib/portal/employeePortalExecutionLiveService';
import {
  createLiveTrackingError,
  liveTrackingErrorFromSupabase,
  liveTrackingErrorToServiceResult,
  logLiveTrackingError,
} from './liveTrackingErrors';
import {
  resolveEmployeeLiveContext,
  type EmployeeLiveContext,
} from './resolveEmployeeLiveContext';
import { scheduleDeferredTask } from '@/lib/async/deferredTask';
import { persistResolvedAssignmentStatus } from './persistResolvedAssignmentStatus';

export type EmployeeGpsSnapshot = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

export type StartEmployeeLiveTrackingInput = {
  tenantId: string;
  employeeId: string;
  routeParamId: string;
  profileId?: string | null;
  /** Legacy persistence field; defaults to the workflow start timestamp. */
  consentGrantedAt?: string | null;
  consentExplainedAt?: string | null;
  gpsSnapshot?: EmployeeGpsSnapshot | null;
  /** Skip location point when browser GPS unavailable but consent granted. */
  withoutGps?: boolean;
  /** When true, also sets assignment status to unterwegs. */
  transitionToEnRoute?: boolean;
  /** Direct service start must not create a fictitious drive_start event. */
  recordDriveStart?: boolean;
  localConsent?: {
    granted: boolean;
    grantedAt: string | null;
    explainedAt: string | null;
  };
  /** Already loaded by the execution screen; avoids reloading the whole visit. */
  knownContext?: EmployeeLiveContext | null;
  knownTimeEvents?: { eventType: string; occurredAt: string }[];
};

export type StartEmployeeLiveTrackingResult = {
  context: EmployeeLiveContext;
  sessionId: string;
  locationPointId: string;
  statusUpdated: boolean;
};

async function updateSessionLastLocation(
  tenantId: string,
  sessionId: string,
  capturedAt: string,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const { error } = await fromUnknownTable(supabase, 'assist_tracking_sessions')
    .update({
      last_location_at: capturedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', sessionId);

  if (error) {
    const err = liveTrackingErrorFromSupabase(error, {
      tenantId,
      tableOrRpc: 'assist_tracking_sessions',
      operation: 'updateSessionLastLocation',
    });
    return liveTrackingErrorToServiceResult(err);
  }
  return { ok: true, data: undefined };
}

function latestEventTime(
  events: { eventType: string; occurredAt: string }[],
  types: string[],
): string | null {
  return events
    .filter((event) => types.includes(event.eventType))
    .map((event) => event.occurredAt)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
}

/** Start or resume live tracking — all DB steps; no partial success. */
export async function startEmployeeLiveTracking(
  input: StartEmployeeLiveTrackingInput,
): Promise<ServiceResult<StartEmployeeLiveTrackingResult>> {
  const ctxResult: ServiceResult<EmployeeLiveContext> = input.knownContext
    ? { ok: true, data: input.knownContext }
    : await resolveEmployeeLiveContext({
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        routeParamId: input.routeParamId,
        portalAccountId: input.profileId,
        localConsent: input.localConsent,
      });

  if (!ctxResult.ok) return ctxResult;
  const ctx = ctxResult.data;
  const trackingAuthorizedAt = input.consentGrantedAt ?? new Date().toISOString();

  let sessionId = ctx.trackingSessionId;

  if (!sessionId || !ctx.trackingSessionActive) {
    const existing = await fetchActiveTrackingSession(input.tenantId, ctx.assistVisitId);
    if (!existing.ok) {
      const err = createLiveTrackingError('LIVE_SESSION_CREATE_FAILED', {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        assignmentId: ctx.assignmentId,
        assistVisitId: ctx.assistVisitId,
        operation: 'startEmployeeLiveTracking.session.read',
        supabaseMessage: existing.error,
      });
      logLiveTrackingError(err);
      return liveTrackingErrorToServiceResult(err);
    }
    if (existing.data?.id) {
      sessionId = existing.data.id;
    } else {
      const started = await startTrackingSession(input.tenantId, {
        visitId: ctx.assistVisitId,
        employeeId: input.employeeId,
        consentGrantedAt: trackingAuthorizedAt,
        consentExplainedAt: input.consentExplainedAt ?? trackingAuthorizedAt,
        source: 'employee_portal',
      });

      if (!started.ok) {
        const err = createLiveTrackingError('LIVE_SESSION_CREATE_FAILED', {
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          assignmentId: ctx.assignmentId,
          assistVisitId: ctx.assistVisitId,
          operation: 'startEmployeeLiveTracking',
          supabaseMessage: started.error,
        });
        logLiveTrackingError(err);
        return liveTrackingErrorToServiceResult(err);
      }
      sessionId = started.data.id;
    }
  }

  if (!sessionId) {
    const err = createLiveTrackingError('LIVE_SESSION_CREATE_FAILED', {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      assignmentId: ctx.assignmentId,
      assistVisitId: ctx.assistVisitId,
      operation: 'startEmployeeLiveTracking',
    });
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }

  if (input.recordDriveStart !== false) {
    const existingEvents: ServiceResult<{ eventType: string; occurredAt: string }[]> = input.knownTimeEvents
      ? { ok: true, data: input.knownTimeEvents }
      : await fetchTimeEventsForVisit(input.tenantId, ctx.assistVisitId, 50);
    if (!existingEvents.ok) {
      const err = createLiveTrackingError('LIVE_TIME_EVENT_INSERT_FAILED', {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        assignmentId: ctx.assignmentId,
        assistVisitId: ctx.assistVisitId,
        operation: 'startEmployeeLiveTracking.drive_start.read',
        supabaseMessage: existingEvents.error,
      });
      logLiveTrackingError(err);
      return liveTrackingErrorToServiceResult(err);
    }

    const lastStart = latestEventTime(existingEvents.data, ['drive_start']);
    const lastEnd = latestEventTime(existingEvents.data, ['drive_end', 'arrive']);
    const hasOpenDrive = Boolean(
      lastStart && (!lastEnd || new Date(lastStart).getTime() > new Date(lastEnd).getTime()),
    );
    const driveStartedAt = hasOpenDrive && lastStart ? lastStart : new Date().toISOString();

    if (!hasOpenDrive) {
      const driveEvent = await recordTimeEvent(
        input.tenantId,
        {
          visitId: ctx.assistVisitId,
          sessionId,
          eventType: 'drive_start',
          occurredAt: driveStartedAt,
        },
        input.profileId ?? input.employeeId,
      );

      if (!driveEvent.ok) {
        const err = createLiveTrackingError('LIVE_TIME_EVENT_INSERT_FAILED', {
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          assignmentId: ctx.assignmentId,
          assistVisitId: ctx.assistVisitId,
          operation: 'startEmployeeLiveTracking.drive_start',
          supabaseMessage: driveEvent.error,
        });
        logLiveTrackingError(err);
        return liveTrackingErrorToServiceResult(err);
      }
    }

    scheduleDeferredTask(`assist-time-wfm:${input.tenantId}:${ctx.assistVisitId}`, async () => {
      const wfmSync = await syncAssistTimeEventToWfmPortalSafe(
        input.tenantId,
        input.employeeId,
        input.profileId ?? null,
        ctx.assistVisitId,
        'drive_start',
        driveStartedAt,
      );
      if (!wfmSync.ok) throw new Error(wfmSync.error);
    });
  }

  const location = input.withoutGps || !input.gpsSnapshot
    ? ({ ok: true, data: { id: 'without-gps' } } as ServiceResult<{ id: string }>)
    : await appendLocationPoint(input.tenantId, {
        sessionId,
        visitId: ctx.assistVisitId,
        latitude: input.gpsSnapshot.latitude,
        longitude: input.gpsSnapshot.longitude,
        accuracyMeters: input.gpsSnapshot.accuracyMeters,
        recordedAt: input.gpsSnapshot.capturedAt,
        source: 'device',
      });

  if (!location.ok) {
    const err = createLiveTrackingError('LIVE_LOCATION_INSERT_FAILED', {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      assignmentId: ctx.assignmentId,
      assistVisitId: ctx.assistVisitId,
      operation: 'startEmployeeLiveTracking.location',
      supabaseMessage: location.error,
    });
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }

  if (!input.withoutGps && input.gpsSnapshot) {
    scheduleDeferredTask(`tracking-session-location:${input.tenantId}:${sessionId}`, async () => {
      const sessionUpdate = await updateSessionLastLocation(
        input.tenantId,
        sessionId!,
        input.gpsSnapshot!.capturedAt,
      );
      if (!sessionUpdate.ok) throw new Error(sessionUpdate.error);
    });
  }

  let statusUpdated = false;
  let detailAfterStatus = ctx.resolution.detail;
  if (input.transitionToEnRoute !== false && ctx.assignmentStatus !== 'unterwegs') {
    const statusResult = await persistResolvedAssignmentStatus({
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      profileId: input.profileId,
      resolution: ctx.resolution,
      toStatus: 'unterwegs',
      fastWorkflow: true,
    });
    if (!statusResult.ok) return statusResult as ServiceResult<never>;
    detailAfterStatus = statusResult.data;
    statusUpdated = true;
  }

  if (
    input.transitionToEnRoute !== false &&
    ctx.resolution.persistenceSource === 'assignments'
  ) {
    scheduleDeferredTask(`assist-status:${input.tenantId}:${ctx.assignmentId}`, async () => {
      const mirrored = await mirrorAssistVisitStatusFromAssignment(
        input.tenantId,
        ctx.assignmentId,
        'unterwegs',
        input.profileId ?? null,
      );
      if (!mirrored.ok) throw new Error(mirrored.error);
    });
  }

  const nextAssignmentStatus =
    input.transitionToEnRoute !== false ? ('unterwegs' as AssignmentStatus) : ctx.assignmentStatus;
  const nextContext: EmployeeLiveContext = {
    ...ctx,
    assignmentStatus: nextAssignmentStatus,
    resolution: {
      ...ctx.resolution,
      detail: detailAfterStatus,
    },
    trackingSessionId: sessionId,
    trackingSessionActive: true,
    lastLocationAt: input.gpsSnapshot?.capturedAt ?? ctx.lastLocationAt,
    lastLocationAccuracyMeters:
      input.gpsSnapshot?.accuracyMeters ?? ctx.lastLocationAccuracyMeters,
    locationPointCount:
      (ctx.locationPointCount ?? 0) + (!input.withoutGps && input.gpsSnapshot ? 1 : 0),
    consentStatus: {
      granted: true,
      grantedAt: trackingAuthorizedAt,
      explainedAt: input.consentExplainedAt ?? trackingAuthorizedAt,
    },
  };

  return {
    ok: true,
    data: {
      context: nextContext,
      sessionId,
      locationPointId: location.data.id,
      statusUpdated,
    },
  };
}
