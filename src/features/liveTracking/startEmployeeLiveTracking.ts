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
import { assignmentStatusToRemote } from '@/lib/assist/assignmentStatusBridge';
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

async function transitionAssignmentToEnRoute(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const now = new Date().toISOString();
  const remoteStatus = assignmentStatusToRemote('unterwegs' as AssignmentStatus);

  const { error: rpcError } = await supabase.rpc('set_assignment_status', {
    input_assignment_id: assignmentId,
    input_status: remoteStatus,
    input_note: undefined,
    input_employee_id: employeeId,
  });

  if (rpcError) {
    const { error: updateError } = await fromUnknownTable(supabase, 'assignments')
      .update({
        status: remoteStatus,
        on_the_way_at: now,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .eq('employee_id', employeeId);

    if (updateError) {
      const err = liveTrackingErrorFromSupabase(updateError, {
        tenantId,
        employeeId,
        assignmentId,
        tableOrRpc: 'assignments',
        operation: 'transitionAssignmentToEnRoute',
      });
      return liveTrackingErrorToServiceResult(err);
    }
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
  const ctxResult = await resolveEmployeeLiveContext({
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
    const existingEvents = await fetchTimeEventsForVisit(input.tenantId, ctx.assistVisitId, 50);
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

    const wfmSync = await syncAssistTimeEventToWfmPortalSafe(
      input.tenantId,
      input.employeeId,
      input.profileId ?? null,
      ctx.assistVisitId,
      'drive_start',
      driveStartedAt,
    );
    if (!wfmSync.ok) {
      const err = createLiveTrackingError('LIVE_TIME_EVENT_INSERT_FAILED', {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        assignmentId: ctx.assignmentId,
        assistVisitId: ctx.assistVisitId,
        operation: 'startEmployeeLiveTracking.drive_start.wfm',
        supabaseMessage: wfmSync.error,
      });
      logLiveTrackingError(err);
      return liveTrackingErrorToServiceResult(err);
    }
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
    const sessionUpdate = await updateSessionLastLocation(
      input.tenantId,
      sessionId,
      input.gpsSnapshot.capturedAt,
    );
    if (!sessionUpdate.ok) {
      return sessionUpdate as ServiceResult<never>;
    }
  }

  let statusUpdated = false;
  if (input.transitionToEnRoute !== false && ctx.assignmentStatus !== 'unterwegs') {
    const statusResult = await transitionAssignmentToEnRoute(
      input.tenantId,
      ctx.assignmentId,
      input.employeeId,
    );
    if (!statusResult.ok) return statusResult as ServiceResult<never>;
    statusUpdated = true;
  }

  if (input.transitionToEnRoute !== false) {
    const mirrored = await mirrorAssistVisitStatusFromAssignment(
      input.tenantId,
      ctx.assignmentId,
      'unterwegs',
      input.profileId ?? null,
    );
    if (!mirrored.ok) {
      const err = createLiveTrackingError('LIVE_TIME_EVENT_INSERT_FAILED', {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        assignmentId: ctx.assignmentId,
        assistVisitId: ctx.assistVisitId,
        operation: 'startEmployeeLiveTracking.status_mirror',
        supabaseMessage: mirrored.error,
      });
      logLiveTrackingError(err);
      return liveTrackingErrorToServiceResult(err);
    }
  }

  const nextAssignmentStatus =
    input.transitionToEnRoute !== false ? ('unterwegs' as AssignmentStatus) : ctx.assignmentStatus;
  const nextContext: EmployeeLiveContext = {
    ...ctx,
    assignmentStatus: nextAssignmentStatus,
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
