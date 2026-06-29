/**
 * LT.GMAPS.2 — Transactional employee tracking start (DB producer).
 */
import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  appendLocationPoint,
  fetchActiveTrackingSession,
  recordTimeEvent,
  startTrackingSession,
} from '@/lib/assist/assistTrackingPersistenceService';
import { assignmentStatusToRemote } from '@/lib/assist/assignmentStatusBridge';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
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
  consentGrantedAt: string;
  consentExplainedAt?: string | null;
  gpsSnapshot: EmployeeGpsSnapshot;
  /** When true, also sets assignment status to unterwegs. */
  transitionToEnRoute?: boolean;
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
    input_note: null,
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

  if (!ctx.consentStatus.granted && !input.consentGrantedAt) {
    const err = createLiveTrackingError('LIVE_CONSENT_SAVE_FAILED', {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      assignmentId: ctx.assignmentId,
      assistVisitId: ctx.assistVisitId,
      operation: 'startEmployeeLiveTracking',
    });
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }

  let sessionId = ctx.trackingSessionId;

  if (!sessionId || !ctx.trackingSessionActive) {
    const existing = await fetchActiveTrackingSession(input.tenantId, ctx.assistVisitId);
    if (existing.ok && existing.data?.id) {
      sessionId = existing.data.id;
    } else {
      const started = await startTrackingSession(input.tenantId, {
        visitId: ctx.assistVisitId,
        employeeId: input.employeeId,
        consentGrantedAt: input.consentGrantedAt,
        consentExplainedAt: input.consentExplainedAt ?? input.consentGrantedAt,
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

  const driveEvent = await recordTimeEvent(
    input.tenantId,
    {
      visitId: ctx.assistVisitId,
      sessionId,
      eventType: 'drive_start',
      occurredAt: new Date().toISOString(),
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

  const location = await appendLocationPoint(input.tenantId, {
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

  const sessionUpdate = await updateSessionLastLocation(
    input.tenantId,
    sessionId,
    input.gpsSnapshot.capturedAt,
  );
  if (!sessionUpdate.ok) {
    return sessionUpdate as ServiceResult<never>;
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

  const refreshed = await resolveEmployeeLiveContext({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    routeParamId: input.routeParamId,
    localConsent: {
      granted: true,
      grantedAt: input.consentGrantedAt,
      explainedAt: input.consentExplainedAt ?? input.consentGrantedAt,
    },
  });

  if (!refreshed.ok) return refreshed;

  return {
    ok: true,
    data: {
      context: refreshed.data,
      sessionId,
      locationPointId: location.data.id,
      statusUpdated,
    },
  };
}
