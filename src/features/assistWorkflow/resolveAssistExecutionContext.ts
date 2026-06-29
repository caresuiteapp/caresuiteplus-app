/**
 * ASSIST.WORKFLOW.1/3 — Resolve full execution context for employee portal workflow.
 */
import type { RoleKey, ServiceResult } from '@/types';
import { fetchEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionService';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { resolveEmployeeLiveContext } from '@/features/liveTracking/resolveEmployeeLiveContext';
import { getEmployeePortalLocationConsent } from '@/lib/portal/employeePortalVisitTrackingService';
import { calculateVisitTimes } from './calculateVisitTimes';
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
};

export async function resolveAssistExecutionContext(
  input: ResolveAssistExecutionContextInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  const { tenantId, assignmentId, employeeId, profileId, roleKey } = input;

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
    portalAccountId: profileId ?? employeeId,
    localConsent,
  });

  const liveContext = liveResult.ok ? liveResult.data : null;
  const assistVisitId = liveContext?.assistVisitId ?? assignmentId;

  let visitTimes = null;
  let timeEvents: AssistExecutionContext['timeEvents'] = [];
  if (liveContext?.assistVisitId) {
    const events = await fetchTimeEventsForVisit(tenantId, liveContext.assistVisitId, 100);
    if (events.ok) {
      timeEvents = events.data.map((e) => ({ eventType: e.eventType, occurredAt: e.occurredAt }));
      visitTimes = calculateVisitTimes(timeEvents, detailResult.data.status);
    }
  }

  const diagnostics = resolveAssistExecutionDiagnostics(detailResult.data.status, visitTimes);
  const allowedActions = resolveAllowedActions({
    assignmentStatus: detailResult.data.status,
    visitTimes,
    detail: detailResult.data,
  });

  return {
    ok: true,
    data: {
      tenantId,
      assignmentId,
      employeeId,
      profileId: profileId ?? null,
      roleKey: roleKey ?? null,
      assistVisitId,
      assignmentStatus: detailResult.data.status,
      detail: detailResult.data,
      liveContext,
      visitTimes,
      timeEvents,
      allowedActions,
      diagnostics,
    },
  };
}
