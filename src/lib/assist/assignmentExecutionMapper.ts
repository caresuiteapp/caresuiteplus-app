import type { AssignmentExecution, ExecutionPhase } from '@/types/modules/assist';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { getAllowedAssignmentTransitions } from '@/lib/assist/assignmentStatusMachine';
import type { AssignmentDetail } from '@/lib/assist/repositories/assignmentRepository.supabase';

function phaseFromStatus(status: AssignmentStatus): ExecutionPhase {
  switch (status) {
    case 'geplant':
    case 'bestaetigt':
      return 'pending';
    case 'unterwegs':
      return 'checked_in';
    case 'angekommen':
      return 'checked_in';
    case 'gestartet':
    case 'pausiert':
    case 'beendet':
    case 'dokumentation_offen':
    case 'unterschrift_offen':
      return 'in_progress';
    case 'abgeschlossen':
      return 'completed';
    case 'storniert':
    case 'nicht_erschienen':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function durationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return null;
  return Math.max(1, Math.round(diff / 60_000));
}

export function mapAssignmentDetailToExecution(
  detail: AssignmentDetail,
  serviceRecordId?: string | null,
): AssignmentExecution {
  const phase = phaseFromStatus(detail.assignmentStatus);
  const checkedInAt = detail.onTheWayAt ?? detail.arrivedAt;
  const checkedOutAt = detail.finishedAt ?? detail.actualEndAt;

  return {
    assignmentId: detail.id,
    tenantId: detail.tenantId,
    status: detail.assignmentStatus,
    phase,
    plannedStartAt: detail.plannedStartAt,
    plannedEndAt: detail.plannedEndAt,
    onTheWayAt: detail.onTheWayAt,
    arrivedAt: detail.arrivedAt,
    actualStartAt: detail.actualStartAt,
    actualEndAt: detail.actualEndAt,
    finishedAt: detail.finishedAt,
    documentationNotes: detail.documentationNotes,
    durationMinutes: durationMinutes(detail.actualStartAt, detail.actualEndAt ?? detail.finishedAt),
    locationNote: detail.location !== '—' ? detail.location : null,
    activityNote: detail.documentationNotes,
    tasks: detail.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      isRequired: task.isRequired,
      notDoneReason: task.notDoneReason,
      requiresNoteIfNotDone: task.requiresNoteIfNotDone,
    })),
    allowedTransitions: getAllowedAssignmentTransitions(detail.assignmentStatus),
    serviceRecordId: serviceRecordId ?? null,
    updatedAt: detail.updatedAt,
    checkedInAt,
    checkedOutAt,
  };
}
