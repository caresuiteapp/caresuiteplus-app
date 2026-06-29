/**
 * ASSIST.WORKFLOW.1 — Start en-route tracking (delegates to LT.GMAPS startEmployeeLiveTracking).
 */
import type { RoleKey, ServiceResult } from '@/types';
import { startEmployeeLiveTracking, type EmployeeGpsSnapshot } from '@/features/liveTracking/startEmployeeLiveTracking';
import { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export type StartEnRouteInput = {
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  profileId?: string | null;
  roleKey?: RoleKey | null;
  consentGrantedAt: string;
  consentExplainedAt?: string | null;
  gpsSnapshot: EmployeeGpsSnapshot;
  localConsent?: {
    granted: boolean;
    grantedAt: string | null;
    explainedAt: string | null;
  };
};

export async function startEnRoute(
  input: StartEnRouteInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  if (!input.consentGrantedAt) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_CONSENT_REQUIRED', {
        tenantId: input.tenantId,
        assignmentId: input.assignmentId,
        employeeId: input.employeeId,
        operation: 'startEnRoute',
      }),
    );
  }

  const started = await startEmployeeLiveTracking({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    routeParamId: input.assignmentId,
    profileId: input.profileId,
    consentGrantedAt: input.consentGrantedAt,
    consentExplainedAt: input.consentExplainedAt,
    gpsSnapshot: input.gpsSnapshot,
    transitionToEnRoute: true,
    localConsent: input.localConsent,
  });

  if (!started.ok) {
    return { ok: false, error: started.error };
  }

  return resolveAssistExecutionContext({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    employeeId: input.employeeId,
    profileId: input.profileId,
    roleKey: input.roleKey,
  });
}
