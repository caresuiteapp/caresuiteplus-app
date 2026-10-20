import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import type {
  AssignmentPauseEvent,
  AssignmentStatusTimes,
  EmployeeMileageLogEntry,
  TravelTimeEntry,
  TravelTimeSource,
} from '@/types/modules/employeeTime';
import { getAssignmentWorkflow } from '@/lib/assist/assignmentWorkflowService';
import {
  peekEmployeePortalPauseEvents,
  peekEmployeePortalStatusHistory,
} from '@/lib/portal/employeePortalExecutionService';
import {
  extractStatusTimesFromHistory,
  normalizePauseEvents,
  periodDateFromIso,
} from './employeeTimeCalculationService';
import {
  getTenantWorkTimeSettings,
  nextMileageEntryId,
  nextPauseEventId,
  nextTravelEntryId,
  saveMileageEntry,
  savePauseEvent,
  saveTravelEntry,
} from './employeeTimeStore';

export function resolveAssignmentStatusTimes(
  tenantId: string,
  assignment: AssignmentWorkflowRecord,
): AssignmentStatusTimes {
  const history = peekEmployeePortalStatusHistory(tenantId, assignment.id);
  return extractStatusTimesFromHistory(
    history.map((h) => ({ toStatus: h.toStatus, createdAt: h.createdAt })),
    { actualStartAt: assignment.actualStartAt, actualEndAt: assignment.actualEndAt },
  );
}

export function syncAssignmentPauseEvents(
  tenantId: string,
  assignmentId: string,
): AssignmentPauseEvent[] {
  const portalPauses = peekEmployeePortalPauseEvents(tenantId, assignmentId);
  const normalized = normalizePauseEvents(tenantId, assignmentId, portalPauses);
  return normalized.map((pause) => {
    const saved = savePauseEvent({ ...pause, id: pause.id || nextPauseEventId() });
    return saved;
  });
}

export function buildTravelTimeSource(
  statusTimes: AssignmentStatusTimes,
  travel?: Partial<TravelTimeSource> | null,
): TravelTimeSource {
  return {
    routeStartedAt: travel?.routeStartedAt ?? statusTimes.onTheWayAt,
    routeFinishedAt: travel?.routeFinishedAt ?? statusTimes.arrivedAt,
    estimatedTravelMinutes: travel?.estimatedTravelMinutes ?? null,
    actualTravelMinutes: travel?.actualTravelMinutes ?? null,
    distanceKm: travel?.distanceKm ?? null,
    source: travel?.source ?? (statusTimes.onTheWayAt ? 'status_times' : 'manual'),
  };
}

export function persistTravelAndMileage(input: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  serviceType: string;
  travel: TravelTimeSource;
  startAddress?: string | null;
  endAddress?: string | null;
}): { travelEntry: TravelTimeEntry; mileageEntry: EmployeeMileageLogEntry | null } {
  const settings = getTenantWorkTimeSettings(input.tenantId);
  const kmBillable = settings.kmBillableByServiceType[input.serviceType] ?? false;
  const now = new Date().toISOString();
  const travelMinutes =
    input.travel.actualTravelMinutes ??
    input.travel.estimatedTravelMinutes ??
    (input.travel.routeStartedAt && input.travel.routeFinishedAt
      ? Math.round(
          (new Date(input.travel.routeFinishedAt).getTime() -
            new Date(input.travel.routeStartedAt).getTime()) /
            60_000,
        )
      : 0);

  const travelEntry = saveTravelEntry({
    id: nextTravelEntryId(),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    assignmentId: input.assignmentId,
    routeStartedAt: input.travel.routeStartedAt,
    routeFinishedAt: input.travel.routeFinishedAt,
    estimatedTravelMinutes: input.travel.estimatedTravelMinutes,
    actualTravelMinutes: input.travel.actualTravelMinutes ?? travelMinutes,
    distanceKm: input.travel.distanceKm,
    countsAsWorkTime: settings.countsTravelAsWorkTime,
    kmBillable,
    source: input.travel.source,
    traceReference: `assignment:${input.assignmentId}:travel`,
    createdAt: now,
    updatedAt: now,
  });

  let mileageEntry: EmployeeMileageLogEntry | null = null;
  if (input.travel.distanceKm != null && input.travel.distanceKm > 0) {
    mileageEntry = saveMileageEntry({
      id: nextMileageEntryId(),
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      assignmentId: input.assignmentId,
      travelTimeEntryId: travelEntry.id,
      tripDate: periodDateFromIso(input.travel.routeStartedAt ?? now),
      startAddress: input.startAddress ?? null,
      endAddress: input.endAddress ?? null,
      distanceKm: input.travel.distanceKm,
      purposeCategory: 'client_visit',
      serviceType: input.serviceType,
      kmBillable,
      gpsCaptured: false,
      routeProviderUsed: settings.routeProviderConfigured && input.travel.source === 'route_provider',
      source: input.travel.source === 'route_provider' ? 'route_calculation' : 'assignment_sync',
      status: 'prepared',
      createdAt: now,
      updatedAt: now,
    });
  }

  return { travelEntry, mileageEntry };
}

export function loadAssignmentTimeContext(tenantId: string, assignmentId: string) {
  const assignment = getAssignmentWorkflow(tenantId, assignmentId);
  if (!assignment) return null;

  const statusTimes = resolveAssignmentStatusTimes(tenantId, assignment);
  const pauseEvents = syncAssignmentPauseEvents(tenantId, assignmentId);

  return {
    assignment,
    statusTimes,
    pauseEvents,
    settings: getTenantWorkTimeSettings(tenantId),
  };
}
