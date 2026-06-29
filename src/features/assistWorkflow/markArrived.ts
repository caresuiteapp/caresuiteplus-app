/**
 * ASSIST.WORKFLOW.1 — Mark arrived at client location.
 */
import type { ServiceResult } from '@/types';
import type { GeofenceSoftCheckResult } from '@/lib/assist/geofenceSoftCheck';
import {
  applyEmployeePortalTrackingForStatus,
  peekEmployeePortalTrackingEntry,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { persistEmployeePortalStatusTransition } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';

export type MarkArrivedInput = {
  ctx: AssistExecutionContext;
  geofence?: GeofenceSoftCheckResult | null;
};

export async function markArrived(
  input: MarkArrivedInput,
): Promise<ServiceResult<AssistExecutionContext>> {
  const { ctx, geofence } = input;
  const fromStatus = ctx.assignmentStatus;

  applyEmployeePortalTrackingForStatus(ctx.tenantId, ctx.assignmentId, fromStatus, 'angekommen');
  const entry = peekEmployeePortalTrackingEntry(ctx.tenantId, ctx.assignmentId);

  await persistEmployeePortalStatusTransition(
    {
      tenantId: ctx.tenantId,
      assignmentId: ctx.assignmentId,
      employeeId: ctx.employeeId,
      profileId: ctx.profileId,
      locationAddress: ctx.detail.locationAddress,
    },
    fromStatus,
    'angekommen',
    geofence ?? entry.geofenceLastCheck,
  );

  return transitionAssistExecutionStatus(ctx, 'angekommen');
}
