/**
 * ASSIST.PERMISSIONS.1 — Mark arrived at client location.
 * Allows arrival without GPS proof — records arrived_without_gps / arrived_manual audit events.
 */
import type { ServiceResult } from '@/types';
import type { GeofenceSoftCheckResult } from '@/lib/assist/geofenceSoftCheck';
import type { EmployeePortalGpsSnapshot } from '@/types/modules/employeePortalTracking';
import {
  applyEmployeePortalTrackingForStatus,
  peekEmployeePortalTrackingEntry,
  setEmployeePortalArrivalProof,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { persistEmployeePortalStatusTransition } from '@/lib/portal/employeePortalVisitTrackingPersistence';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
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

export async function markArrived(input: MarkArrivedInput): Promise<MarkArrivedResult> {
  const { ctx, geofence, manualReason } = input;
  const fromStatus = ctx.assignmentStatus;

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
    geofence ?? updatedEntry.geofenceLastCheck,
    { arrivalMode, manualReason: manualReason ?? updatedEntry.geofenceOverrideReason },
  );

  const transition = await transitionAssistExecutionStatus(ctx, 'angekommen');
  if (!transition.ok) return transition;

  let arrivalWarning: string | null = null;
  if (arrivalMode === 'without_gps') arrivalWarning = ARRIVED_WITHOUT_GPS_WARNING;
  if (arrivalMode === 'manual') arrivalWarning = ARRIVED_MANUAL_WARNING;

  return { ...transition, arrivalWarning };
}
