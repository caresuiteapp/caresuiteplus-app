/**
 * ASSIST.WORKFLOW.2 — Mark arrived at client location (stops travel timer).
 */
import type { ServiceResult } from '@/types';
import type { GeofenceSoftCheckResult } from '@/lib/assist/geofenceSoftCheck';
import type { EmployeePortalGpsSnapshot } from '@/types/modules/employeePortalTracking';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import {
  applyEmployeePortalTrackingForStatus,
  peekEmployeePortalTrackingEntry,
  setEmployeePortalArrivalProof,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { persistEmployeePortalStatusTransition } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { upsertAssistVisitExecutionState } from './assistVisitExecutionStatePersistence';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import { ensureVisitTimeEvent } from './saveVisitTimeEvent';
import { hasTravelEnded } from './getVisitTimeSegments';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import { resolveAllowedActions } from './resolveAllowedActions';
import { logAssistWorkflowError, createAssistWorkflowError, assistWorkflowErrorToResult } from './assistWorkflowErrors';
import { getServiceMode } from '@/lib/services/mode';
import { mirrorAssistVisitStatusFromAssignment } from '@/lib/portal/employeePortalExecutionLiveService';
import type { AssistExecutionContext } from './types';

export type ArrivalMode = 'gps' | 'without_gps' | 'manual';

export type MarkArrivedInput = {
  ctx: AssistExecutionContext;
  geofence?: GeofenceSoftCheckResult | null;
  arrivalMode?: ArrivalMode;
  gpsSnapshot?: EmployeePortalGpsSnapshot | null;
  manualReason?: string | null;
};

export type MarkArrivedResult = ServiceResult<AssistExecutionContext> & {
  arrivalWarning?: string | null;
};

export const ARRIVED_WITHOUT_GPS_WARNING =
  'Ankunft ohne GPS-Nachweis gespeichert — Standortberechtigung fehlt oder Signal nicht verfügbar.';

export const ARRIVED_MANUAL_WARNING =
  'Ankunft manuell bestätigt — Geofence-Hinweis wurde überschrieben.';

async function backfillTravelEndEvents(ctx: AssistExecutionContext): Promise<string[]> {
  const warnings: string[] = [];
  const events = await fetchTimeEventsForVisit(ctx.tenantId, ctx.assistVisitId, 50);
  const existing = events.ok ? events.data.map((e) => ({ eventType: e.eventType })) : [];

  if (!hasTravelEnded(existing)) {
    const now = new Date().toISOString();
    const arrive = await ensureVisitTimeEvent(
      {
        tenantId: ctx.tenantId,
        visitId: ctx.assistVisitId,
        eventType: 'arrive',
        occurredAt: now,
        recordedBy: ctx.profileId ?? ctx.employeeId,
        employeeId: ctx.employeeId,
        profileId: ctx.profileId,
      },
      existing,
    );
    if (!arrive.ok) warnings.push(arrive.error ?? 'arrive event failed');

    const driveEnd = await ensureVisitTimeEvent(
      {
        tenantId: ctx.tenantId,
        visitId: ctx.assistVisitId,
        eventType: 'drive_end',
        occurredAt: now,
        recordedBy: ctx.profileId ?? ctx.employeeId,
        employeeId: ctx.employeeId,
        profileId: ctx.profileId,
      },
      existing,
    );
    if (!driveEnd.ok) warnings.push(driveEnd.error ?? 'drive_end event failed');
  }

  return warnings;
}

export async function markArrived(input: MarkArrivedInput): Promise<MarkArrivedResult> {
  const { ctx, geofence, manualReason } = input;
  const fromStatus = ctx.assignmentStatus;

  if (fromStatus === 'angekommen') {
    const backfillWarnings = await backfillTravelEndEvents(ctx);
    if (backfillWarnings.length) {
      logAssistWorkflowError(
        createAssistWorkflowError('WORKFLOW_TIME_EVENT_FAILED', {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          operation: 'markArrived.backfill',
          supabaseMessage: backfillWarnings.join('; '),
        }),
      );
    }
    const refreshed = await resolveAssistExecutionContext({
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      roleKey: ctx.roleKey as import('@/types').RoleKey | null,
    });
    return refreshed.ok
      ? { ok: true, data: refreshed.data, arrivalWarning: null }
      : { ok: false, error: refreshed.error };
  }

  const entry = peekEmployeePortalTrackingEntry(ctx.tenantId, ctx.assignmentId);
  let arrivalMode: ArrivalMode = input.arrivalMode ?? 'without_gps';

  if (input.gpsSnapshot) {
    entry.lastPosition = input.gpsSnapshot;
    arrivalMode = 'gps';
  } else if (manualReason?.trim() || entry.geofenceOverrideReason) {
    arrivalMode = 'manual';
  } else if (arrivalMode === 'gps' && !entry.lastPosition) {
    arrivalMode = 'without_gps';
  }

  setEmployeePortalArrivalProof(ctx.tenantId, ctx.assignmentId, arrivalMode);
  applyEmployeePortalTrackingForStatus(ctx.tenantId, ctx.assignmentId, fromStatus, 'angekommen');
  const updatedEntry = peekEmployeePortalTrackingEntry(ctx.tenantId, ctx.assignmentId);

  const transition = await transitionAssistExecutionStatus(ctx, 'angekommen', {
    skipStatusPersistence: true,
    hasTravelEnded: true,
  });
  if (!transition.ok) return transition;

  const persistResult = await persistEmployeePortalStatusTransition(
    {
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      locationAddress: ctx.detail.locationAddress,
    },
    fromStatus,
    'angekommen',
    geofence ?? updatedEntry.geofenceLastCheck,
    { arrivalMode, manualReason: manualReason ?? updatedEntry.geofenceOverrideReason },
  );

  const timeEventWarnings = persistResult.warnings.filter(
    (w) => w.includes('time') || w.includes('Event') || w.includes('Zeit'),
  );

  if (timeEventWarnings.length) {
    const backfillWarnings = await backfillTravelEndEvents(ctx);
    if (backfillWarnings.length) {
      return assistWorkflowErrorToResult(
        createAssistWorkflowError('WORKFLOW_TIME_EVENT_FAILED', {
          tenantId: ctx.tenantId,
          assignmentId: ctx.assignmentId,
          employeeId: ctx.employeeId,
          operation: 'markArrived.persist',
          supabaseMessage: [...persistResult.warnings, ...backfillWarnings].join('; '),
        }),
      ) as MarkArrivedResult;
    }
  } else if (persistResult.warnings.length) {
    logAssistWorkflowError(
      createAssistWorkflowError('AWF_DATABASE_ERROR', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        employeeId: ctx.employeeId,
        operation: 'markArrived.persist',
        supabaseMessage: persistResult.warnings.join('; '),
      }),
    );
  }

  void upsertAssistVisitExecutionState(ctx.tenantId, ctx.assignmentId, 'angekommen', {
    employeeId: ctx.employeeId,
    visitTimes: transition.data.visitTimes,
  });

  if (getServiceMode() === 'supabase') {
    void mirrorAssistVisitStatusFromAssignment(
      ctx.tenantId,
      ctx.assignmentId,
      'angekommen',
      ctx.profileId ?? null,
    );
  }

  let arrivalWarning: string | null = null;
  if (arrivalMode === 'without_gps') arrivalWarning = ARRIVED_WITHOUT_GPS_WARNING;
  if (arrivalMode === 'manual') arrivalWarning = ARRIVED_MANUAL_WARNING;

  const arrivedAt =
    transition.data.visitTimes?.arrivedAt ??
    transition.data.detail.arrivedAt ??
    new Date().toISOString();
  const visitTimes = transition.data.visitTimes
    ? { ...transition.data.visitTimes, arrivedAt }
    : transition.data.visitTimes;
  const detail = {
    ...transition.data.detail,
    status: 'angekommen' as const,
    arrivedAt: transition.data.detail.arrivedAt ?? arrivedAt,
  };
  const arrivedContext: AssistExecutionContext =
    transition.data.derivedStatus === 'angekommen'
      ? { ...transition.data, detail, visitTimes }
      : {
          ...transition.data,
          assignmentStatus: 'angekommen',
          derivedStatus: 'angekommen',
          detail,
          visitTimes,
          allowedActions: resolveAllowedActions({
            assignmentStatus: 'angekommen',
            visitTimes,
            detail,
            derivedStatus: 'angekommen',
            canStartService: true,
          }),
        };

  return {
    ok: true,
    data: arrivedContext,
    arrivalWarning,
  };
}
