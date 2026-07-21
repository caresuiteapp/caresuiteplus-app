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
import {
  isEmployeePortalAssignmentLocked,
  resolveEmployeePortalAssignmentPendingFlags,
  shouldShowAssignmentInEmployeePortalList,
} from './employeePortalAssignmentCompletion';

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
  const weekStartDay = 1;
  const diff = (start.getDay() - weekStartDay + 7) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

export function mapPortalAppointmentToListItem(
  item: PortalAppointmentItem,
): EmployeePortalAssignmentListItem {
  const status = item.assignmentStatus ?? workflowStatusToAssignment(item.status);
  const pending = resolveEmployeePortalAssignmentPendingFlags({
    status,
    assignmentIncomplete: item.assignmentIncomplete,
  });
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
    documentationPending: pending.documentationPending,
    signaturePending: pending.signaturePending,
    isLocked: isEmployeePortalAssignmentLocked({
      status,
      assignmentIncomplete: item.assignmentIncomplete,
    }),
  };
}

export function filterEmployeePortalAppointments(
  items: PortalAppointmentItem[],
): PortalAppointmentItem[] {
  return items.filter((item) => {
    const status = item.assignmentStatus ?? workflowStatusToAssignment(item.status);
    return shouldShowAssignmentInEmployeePortalList({
      status,
      plannedStartAt: item.startsAt,
      assignmentIncomplete: item.assignmentIncomplete,
    });
  });
}

function normalizedAppointmentText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLocaleLowerCase('de-DE');
}

/**
 * Collapse duplicate technical rows for the same real-world employee appointment.
 *
 * Historic series repairs can leave more than one assist_visits row behind. The
 * employee portal must never turn those rows into duplicate cards, hours or KPI
 * counts. A separately planned appointment remains visible when its time differs.
 */
export function dedupeEmployeePortalAppointments(
  items: PortalAppointmentItem[],
): PortalAppointmentItem[] {
  const byOccurrence = new Map<string, PortalAppointmentItem>();

  for (const item of items) {
    const key = [
      item.employeeId ?? '',
      item.clientId,
      item.startsAt,
      item.endsAt,
      normalizedAppointmentText(item.title),
    ].join('|');
    const current = byOccurrence.get(key);
    if (!current) {
      byOccurrence.set(key, item);
      continue;
    }

    // Prefer the row with the more useful canonical state while preserving one
    // stable occurrence. This avoids a stale "geplant" duplicate shadowing the
    // actual current visit.
    const currentStatus = current.assignmentStatus ?? workflowStatusToAssignment(current.status);
    const nextStatus = item.assignmentStatus ?? workflowStatusToAssignment(item.status);
    const currentScore = ACTIVE_ASSIGNMENT_STATUSES.has(currentStatus) ? 2 : current.assignmentStatus ? 1 : 0;
    const nextScore = ACTIVE_ASSIGNMENT_STATUSES.has(nextStatus) ? 2 : item.assignmentStatus ? 1 : 0;
    if (nextScore > currentScore) byOccurrence.set(key, item);
  }

  return [...byOccurrence.values()];
}

export function buildEmployeePortalOverviewFromAppointments(
  items: PortalAppointmentItem[],
): EmployeePortalOverview {
  const assignments = filterEmployeePortalAppointments(dedupeEmployeePortalAppointments(items))
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
    openSignatureDocumentCount: 0,
    overdueSignatureDocumentCount: 0,
    messageCount: overview.adminMessageCount,
  };
}

export function isActiveEmployeeAssignment(status: AssignmentStatus): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.has(status);
}

export function isDocumentationPendingEmployeeAssignment(status: AssignmentStatus): boolean {
  return status === 'beendet' || status === 'dokumentation_offen';
}

export function isCompletedEmployeeAssignment(status: AssignmentStatus): boolean {
  return COMPLETED_ASSIGNMENT_STATUSES.has(status);
}

/** Prefer in-progress visit, then open documentation, then next startable slot today. */
export function resolveDashboardCurrentAssignment(
  todayAssignments: EmployeePortalAssignmentListItem[],
): EmployeePortalAssignmentListItem | null {
  const active = todayAssignments.find((item) => isActiveEmployeeAssignment(item.status));
  if (active) return active;

  const documentationPending = todayAssignments.find(
    (item) => item.documentationPending || isDocumentationPendingEmployeeAssignment(item.status),
  );
  if (documentationPending) return documentationPending;

  const startable = todayAssignments.find(
    (item) => item.status === 'bestaetigt' || item.status === 'geplant',
  );
  return startable ?? null;
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
