/**
 * ASSIST.WORKFLOW.1 — Start en-route tracking (delegates to LT.GMAPS startEmployeeLiveTracking).
 */
import type { RoleKey, ServiceResult } from '@/types';
import { startEmployeeLiveTracking, type EmployeeGpsSnapshot } from '@/features/liveTracking/startEmployeeLiveTracking';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import { calculateVisitTimes } from './calculateVisitTimes';
import { resolveAllowedActions, resolveAssistExecutionDiagnostics } from './resolveAllowedActions';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';

export type StartEnRouteInput = {
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  profileId?: string | null;
  roleKey?: RoleKey | null;
  /** Legacy persistence field; no separate per-visit employee click required. */
  consentGrantedAt?: string | null;
  consentExplainedAt?: string | null;
  gpsSnapshot?: EmployeeGpsSnapshot | null;
  /** When true, transition to en-route without recording a GPS point. */
  withoutGps?: boolean;
  localConsent?: {
    granted: boolean;
    grantedAt: string | null;
    explainedAt: string | null;
  };
  /** Current screen context; avoids a second complete visit read after persistence. */
  executionContext?: AssistExecutionContext | null;
};

export async function startEnRoute(
  input: StartEnRouteInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  const started = await startEmployeeLiveTracking({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    routeParamId: input.assignmentId,
    profileId: input.profileId,
    consentGrantedAt: input.consentGrantedAt,
    consentExplainedAt: input.consentExplainedAt,
    gpsSnapshot: input.gpsSnapshot ?? null,
    withoutGps: input.withoutGps ?? !input.gpsSnapshot,
    transitionToEnRoute: true,
    localConsent: input.localConsent,
    knownContext: input.executionContext?.liveContext ?? null,
    knownTimeEvents: input.executionContext?.timeEvents,
  });

  if (!started.ok) {
    // The live session/status can already be durable when a later GPS or WFM
    // mirror reports an error. Recover from the authoritative readback so the
    // employee never has to start the same journey twice.
    const recovered = await resolveAssistExecutionContext({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      employeeId: input.employeeId,
      profileId: input.profileId,
      roleKey: input.roleKey,
    });
    if (
      recovered.ok &&
      (Boolean(recovered.data.visitTimes?.driveStartedAt) ||
        Boolean(recovered.data.detail.onTheWayAt) ||
        ['unterwegs', 'angekommen', 'gestartet', 'pausiert', 'beendet'].includes(
          recovered.data.assignmentStatus,
        ) ||
        ['unterwegs', 'angekommen', 'gestartet', 'pausiert', 'beendet'].includes(
          recovered.data.derivedStatus,
        ))
    ) {
      return recovered;
    }
    // GPS-/Trackingtabellen sind Zusatzsysteme und dürfen die kanonische
    // Einsatzkette nicht blockieren. Wenn der bereits geladene Kontext
    // vorliegt, wird die Anfahrt serverseitig als Workflowstatus gestartet;
    // das Tracking kann anschließend unabhängig wiederverbinden.
    if (input.executionContext) {
      const transitioned = await transitionAssistExecutionStatus(
        input.executionContext,
        'unterwegs',
        { fastWorkflow: true },
      );
      if (transitioned.ok) return transitioned;
    }
    return { ok: false, error: started.error };
  }

  if (input.executionContext) {
    const occurredAt = new Date().toISOString();
    const existingTimeEvents = Array.isArray(input.executionContext.timeEvents)
      ? input.executionContext.timeEvents
      : [];
    const hasDriveStart = existingTimeEvents.some((event) => event.eventType === 'drive_start');
    const timeEvents = hasDriveStart
      ? existingTimeEvents
      : [...existingTimeEvents, { eventType: 'drive_start', occurredAt }];
    const visitTimes = calculateVisitTimes(timeEvents, 'unterwegs');
    const detail = {
      ...input.executionContext.detail,
      status: 'unterwegs' as const,
      onTheWayAt: input.executionContext.detail.onTheWayAt ?? occurredAt,
    };
    const workflow = {
      derivedStatus: 'unterwegs' as const,
      recordedStatus: 'unterwegs' as const,
      consistencyStatus: input.executionContext.consistencyStatus,
      inconsistencies: input.executionContext.inconsistencies,
      repairOptions: input.executionContext.repairOptions,
      canStartService: false,
      nextActionHint: null,
    };
    return {
      ok: true,
      data: {
        ...input.executionContext,
        assignmentStatus: 'unterwegs',
        derivedStatus: 'unterwegs',
        detail,
        liveContext: started.data.context,
        timeEvents,
        visitTimes,
        diagnostics: resolveAssistExecutionDiagnostics('unterwegs', visitTimes, workflow),
        allowedActions: resolveAllowedActions({ assignmentStatus: 'unterwegs', visitTimes, detail, derivedStatus: 'unterwegs', canStartService: false }),
      },
    };
  }

  return resolveAssistExecutionContext({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    employeeId: input.employeeId,
    profileId: input.profileId,
    roleKey: input.roleKey,
  });
}
