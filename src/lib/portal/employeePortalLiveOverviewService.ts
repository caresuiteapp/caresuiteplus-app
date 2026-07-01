import type { ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type {
  EmployeePortalAssignmentListItem,
  EmployeePortalOverview,
} from '@/types/modules/employeePortalExecution';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';
import type { WorkflowStatus } from '@/types/workflow/status';
import { remoteStatusToAssignment, assignmentStatusToRemote } from '@/lib/assist/assignmentStatusBridge';
import { fetchLivePortalAppointmentsForEmployee } from './portalAppointmentsLiveService';
import type { PortalAppointmentItem } from './appointmentService';

const ACTIVE_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  'bestaetigt',
  'unterwegs',
  'angekommen',
  'gestartet',
  'pausiert',
]);

const COMPLETED_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  'abgeschlossen',
  'storniert',
  'nicht_erschienen',
]);

function workflowStatusToAssignment(status: WorkflowStatus): AssignmentStatus {
  const map: Partial<Record<WorkflowStatus, AssignmentStatus>> = {
    entwurf: 'geplant',
    aktiv: 'bestaetigt',
    in_bearbeitung: 'gestartet',
    abgeschlossen: 'abgeschlossen',
    fehlerhaft: 'storniert',
    gesperrt: 'storniert',
    archiviert: 'abgeschlossen',
  };
  return map[status] ?? remoteStatusToAssignment(status);
}

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isSameWeek(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  const start = new Date(ref);
  start.setDate(ref.getDate() - ref.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

export function mapPortalAppointmentToListItem(
  item: PortalAppointmentItem,
): EmployeePortalAssignmentListItem {
  const status = item.assignmentStatus ?? workflowStatusToAssignment(item.status);
  return {
    assignmentId: item.id,
    title: item.title,
    clientName: item.clientName ?? 'Klient:in',
    clientId: item.clientId,
    plannedStartAt: item.startsAt,
    plannedEndAt: item.endsAt,
    locationAddress: item.location ?? '',
    status,
    canonicalStatus: assignmentStatusToRemote(status),
    documentationPending: status === 'dokumentation_offen',
    signaturePending: status === 'unterschrift_offen',
    isLocked: status === 'abgeschlossen' || status === 'storniert',
  };
}

export function buildEmployeePortalOverviewFromAppointments(
  items: PortalAppointmentItem[],
): EmployeePortalOverview {
  const assignments = items
    .map(mapPortalAppointmentToListItem)
    .sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt));
  const now = new Date();

  return {
    todayAssignments: assignments.filter((item) => isSameDay(item.plannedStartAt, now)),
    nextAssignments: assignments
      .filter((item) => new Date(item.plannedStartAt) > now && !item.isLocked)
      .slice(0, 5),
    weeklyPlan: assignments.filter((item) => isSameWeek(item.plannedStartAt, now)),
    openDocumentations: assignments.filter((item) => item.documentationPending).length,
    missingSignatures: assignments.filter((item) => item.signaturePending).length,
    adminMessageCount: 0,
    canReportProblem: true,
  };
}

export function buildEmployeePortalDashboardFromOverview(
  overview: EmployeePortalOverview,
): EmployeePortalDashboardProjection {
  return {
    todayAssignments: overview.todayAssignments,
    upcomingAssignments: overview.nextAssignments,
    openTasks: [],
    openDocumentationCount: overview.openDocumentations,
    missingSignatureCount: overview.missingSignatures,
    messageCount: overview.adminMessageCount,
  };
}

export function isActiveEmployeeAssignment(status: AssignmentStatus): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.has(status);
}

export function isCompletedEmployeeAssignment(status: AssignmentStatus): boolean {
  return COMPLETED_ASSIGNMENT_STATUSES.has(status);
}

/** Live GPS / tracking UI only while execution is in progress. */
export function isEmployeePortalVisitLiveTrackingActive(status: AssignmentStatus): boolean {
  return isActiveEmployeeAssignment(status);
}

export async function fetchLiveEmployeePortalOverview(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePortalOverview>> {
  const live = await fetchLivePortalAppointmentsForEmployee(tenantId, employeeId);
  if (!live.ok) return live;
  return { ok: true, data: buildEmployeePortalOverviewFromAppointments(live.data) };
}
