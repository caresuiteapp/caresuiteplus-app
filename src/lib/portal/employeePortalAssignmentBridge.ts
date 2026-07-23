import type { AssignmentDetail, AssignmentTaskItem } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { assignmentStatusToRemote } from '@/lib/assist/assignmentStatusBridge';
import {
  getAllowedAssignmentTransitions,
} from '@/lib/assist/assignmentStatusMachine';
import { dedupeStatusTransitionButtons } from '@/lib/assist/visitTransitionButtons';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { WorkflowStatus } from '@/types/core/base';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import {
  confirmedOccurrenceWorkflowStatus,
  isVirtualRecurringOccurrenceId,
} from '@/lib/assist/visitRecurrenceExecution';

function assignmentStatusToWorkflowFilter(status: AssignmentStatus): WorkflowStatus {
  const map: Partial<Record<AssignmentStatus, WorkflowStatus>> = {
    geplant: 'entwurf',
    bestaetigt: 'aktiv',
    unterwegs: 'aktiv',
    angekommen: 'in_bearbeitung',
    gestartet: 'in_bearbeitung',
    pausiert: 'in_bearbeitung',
    beendet: 'in_bearbeitung',
    dokumentation_offen: 'in_bearbeitung',
    unterschrift_offen: 'in_bearbeitung',
    abgeschlossen: 'abgeschlossen',
    storniert: 'fehlerhaft',
    nicht_erschienen: 'fehlerhaft',
  };
  return map[status] ?? 'aktiv';
}

function mapVisitTasks(tasks: VisitDispositionDetail['tasks']): AssignmentTaskItem[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status === 'not_requested' ? 'not_done' : task.status,
    isRequired: task.isRequired,
    notDoneReason: task.notDoneReason,
    requiresNoteIfNotDone: task.status === 'not_done' || task.status === 'not_requested',
  }));
}

/** Map assist_visits detail to legacy assignments shape for employee portal execution. */
export function mapVisitDetailToAssignmentDetail(visit: VisitDispositionDetail): AssignmentDetail {
  const assignmentStatus = visit.assignmentStatus;
  const allowed = dedupeStatusTransitionButtons(getAllowedAssignmentTransitions(assignmentStatus));

  return {
    id: visit.id,
    tenantId: visit.tenantId,
    clientId: visit.clientId,
    employeeId: visit.employeeId ?? '',
    appointmentId: null,
    title: visit.title,
    scheduledStart: visit.scheduledStart,
    scheduledEnd: visit.scheduledEnd,
    status: assignmentStatusToWorkflowFilter(assignmentStatus),
    location: visit.location,
    notes: visit.notes,
    clientName: visit.clientName,
    employeeName: visit.employeeName,
    nextActionHint: ASSIGNMENT_STATUS_LABELS[assignmentStatus],
    allowedStatusActions: allowed.map(assignmentStatusToWorkflowFilter),
    allowedStatusTransitions: allowed,
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
    visibility: 'team',
    sensitivity: 'care',
    assignmentStatus,
    tasks: mapVisitTasks(visit.tasks),
    onTheWayAt: visit.onTheWayAt,
    arrivedAt: visit.arrivedAt,
    finishedAt: visit.finishedAt,
    documentationNotes: visit.documentationNotes ?? null,
    plannedStartAt: visit.scheduledStart,
    plannedEndAt: visit.scheduledEnd,
    actualStartAt: visit.actualStartAt,
    actualEndAt: visit.actualEndAt,
  };
}

/** Strip master execution state from a virtual recurring occurrence for portal execution. */
export function resetVirtualOccurrenceAssignmentDetail(
  detail: AssignmentDetail,
  occurrenceId: string,
): AssignmentDetail {
  if (!isVirtualRecurringOccurrenceId(occurrenceId)) return detail;

  const assignmentStatus: AssignmentStatus =
    detail.assignmentStatus === 'geplant' ? 'geplant' : 'bestaetigt';
  const allowed = dedupeStatusTransitionButtons(getAllowedAssignmentTransitions(assignmentStatus));

  return {
    ...detail,
    id: occurrenceId,
    assignmentStatus,
    status: confirmedOccurrenceWorkflowStatus(),
    allowedStatusActions: allowed.map(assignmentStatusToWorkflowFilter),
    allowedStatusTransitions: allowed,
    nextActionHint: ASSIGNMENT_STATUS_LABELS[assignmentStatus],
    tasks: detail.tasks.map((task) =>
      task.status === 'open'
        ? task
        : {
            ...task,
            status: 'open',
            notDoneReason: null,
          },
    ),
    onTheWayAt: null,
    arrivedAt: null,
    finishedAt: null,
    actualStartAt: null,
    actualEndAt: null,
    documentationNotes: null,
  };
}

export function visitMirrorInputFromDetail(visit: VisitDispositionDetail) {
  return {
    visitId: visit.id,
    tenantId: visit.tenantId,
    clientId: visit.clientId,
    employeeId: visit.employeeId,
    assignmentDate: visit.scheduledStart.slice(0, 10),
    plannedStartAt: visit.scheduledStart,
    plannedEndAt: visit.scheduledEnd,
    title: visit.title,
    description: visit.description,
    addressSnapshot: visit.location,
    internalNotes: visit.notes,
    clientVisibleNotes: null as string | null,
    canonicalStatus: assignmentStatusToRemote(visit.assignmentStatus),
    saveAsDraft: false,
  };
}
