/**
 * ASSIST.STABILIZE.1 — Enhance resolveAssistExecutionContext with derived status + auto-repair.
 */
import type { RoleKey, ServiceResult } from '@/types';
import { fetchEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionService';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { resolveEmployeeLiveContext } from '@/features/liveTracking/resolveEmployeeLiveContext';
import { resolveLiveVisitId } from '@/features/liveTracking/resolveLiveAssignment';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { getEmployeePortalLocationConsent } from '@/lib/portal/employeePortalVisitTrackingService';
import { calculateVisitTimes, type VisitTimesSummary } from './calculateVisitTimes';
import type { AssignmentDetail } from '@/lib/assist/repositories/assignmentRepository.supabase';

function mergeVisitTimesFromAssignment(
  visitTimes: VisitTimesSummary | null,
  detail: AssignmentDetail,
): VisitTimesSummary | null {
  const hasAssignmentTimes =
    Boolean(detail.onTheWayAt) ||
    Boolean(detail.arrivedAt) ||
    Boolean(detail.actualStartAt) ||
    Boolean(detail.actualEndAt);
  if (!visitTimes && !hasAssignmentTimes) return null;

  const base: VisitTimesSummary =
    visitTimes ??
    ({
      driveSeconds: null,
      serviceSeconds: null,
      pauseSeconds: null,
      totalSeconds: null,
      driveStartedAt: null,
      serviceStartedAt: null,
      pauseStartedAt: null,
      arrivedAt: null,
      serviceEndedAt: null,
      activeTimer: null,
    } satisfies VisitTimesSummary);

  return {
    ...base,
    driveStartedAt: base.driveStartedAt ?? detail.onTheWayAt ?? null,
    arrivedAt: base.arrivedAt ?? detail.arrivedAt ?? null,
    serviceStartedAt: base.serviceStartedAt ?? detail.actualStartAt ?? null,
    serviceEndedAt: base.serviceEndedAt ?? detail.actualEndAt ?? null,
  };
}
import { deriveWorkflowStatus } from './deriveWorkflowStatus';
import { repairWorkflowState } from './repairWorkflowState';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';
import {
  resolveAllowedActions,
  resolveAssistExecutionDiagnostics,
} from './resolveAllowedActions';

export type ResolveAssistExecutionContextInput = {
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  profileId?: string | null;
  roleKey?: RoleKey | null;
  /** When true (default), attempt auto-repair for unambiguous inconsistencies. */
  autoRepair?: boolean;
};

export async function resolveAssistExecutionContext(
  input: ResolveAssistExecutionContextInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  const { tenantId, assignmentId, employeeId, profileId, roleKey, autoRepair = true } = input;

  if (!tenantId || !assignmentId || !employeeId) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_CONTEXT_MISSING', {
        tenantId,
        assignmentId,
        employeeId,
        operation: 'resolveAssistExecutionContext',
      }),
    );
  }

  const detailResult = await fetchEmployeePortalAssignmentDetail(
    tenantId,
    assignmentId,
    employeeId,
    roleKey ?? null,
  );
  if (!detailResult.ok) {
    return { ok: false, error: detailResult.error };
  }

  const localConsent = getEmployeePortalLocationConsent(tenantId, assignmentId);
  const liveResult = await resolveEmployeeLiveContext({
    tenantId,
    employeeId,
    routeParamId: assignmentId,
    portalAccountId: profileId ?? null,
    localConsent,
  });

  const liveContext = liveResult.ok ? liveResult.data : null;
  const resolvedVisitId =
    liveContext?.assistVisitId ??
    (await resolveLiveVisitId(tenantId, assignmentId)) ??
    resolveVisitMasterId(assignmentId);
  const assistVisitId = resolvedVisitId;

  let visitTimes = null;
  let timeEvents: AssistExecutionContext['timeEvents'] = [];
  if (assistVisitId) {
    const events = await fetchTimeEventsForVisit(tenantId, assistVisitId, 100);
    if (events.ok) {
      timeEvents = events.data.map((e) => ({ eventType: e.eventType, occurredAt: e.occurredAt }));
      const preliminaryTimes = calculateVisitTimes(timeEvents, detailResult.data.status);
      const workflowPreview = deriveWorkflowStatus(detailResult.data.status, preliminaryTimes);
      // ASSIST.STABILIZE.3 — timers follow derived status so pause freezes service display.
      visitTimes = calculateVisitTimes(timeEvents, workflowPreview.derivedStatus);
      visitTimes = mergeVisitTimesFromAssignment(visitTimes, detailResult.data);
    }
  }

  if (!visitTimes) {
    visitTimes = mergeVisitTimesFromAssignment(null, detailResult.data);
  }

  const workflow = deriveWorkflowStatus(detailResult.data.status, visitTimes);
  const diagnostics = resolveAssistExecutionDiagnostics(
    detailResult.data.status,
    visitTimes,
    workflow,
  );
  const allowedActions = resolveAllowedActions({
    assignmentStatus: detailResult.data.status,
    visitTimes,
    detail: detailResult.data,
    derivedStatus: workflow.derivedStatus,
    canStartService: workflow.canStartService,
  });

  let ctx: AssistExecutionContext = {
    tenantId,
    assignmentId,
    employeeId,
    profileId: profileId ?? null,
    roleKey: roleKey ?? null,
    assistVisitId,
    assignmentStatus: detailResult.data.status,
    derivedStatus: workflow.derivedStatus,
    consistencyStatus: workflow.consistencyStatus,
    inconsistencies: workflow.inconsistencies,
    repairOptions: workflow.repairOptions,
    detail: detailResult.data,
    liveContext,
    visitTimes,
    timeEvents,
    allowedActions,
    diagnostics,
  };

  const statusDrift = workflow.derivedStatus !== detailResult.data.status;
  const canForwardRepair =
    statusDrift &&
    (workflow.consistencyStatus === 'repairable' ||
      workflow.derivedStatus === 'beendet' ||
      workflow.derivedStatus === 'gestartet');

  if (autoRepair && canForwardRepair) {
    const repaired = await repairWorkflowState(ctx, { autoOnly: true });
    if (repaired.ok && repaired.data.repaired) {
      ctx = repaired.data.ctx;
    }
  }

  if (
    autoRepair &&
    ctx.detail.documentationStatus === 'submitted' &&
    ctx.assignmentStatus === 'beendet'
  ) {
    const transitioned = await transitionAssistExecutionStatus(ctx, 'dokumentation_offen', {
      hasDocumentation: true,
      hasServiceStarted: Boolean(ctx.visitTimes?.serviceStartedAt),
    });
    if (transitioned.ok) {
      ctx = transitioned.data;
    }
  }

  return { ok: true, data: ctx };
}
