import type { WfmAbsence, WfmAbsenceType } from '@/types/modules/wfm';
import type { AbsenceConflict } from '@/types/modules/employeeAbsence';
import {
  absenceTypeToConflictCode,
  conflictCodeToMessage,
  detectAbsenceAssignmentConflicts,
  findAssignmentsOverlappingAbsence,
} from '@/lib/office/absenceConflictService';
import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import type { AbsenceType } from '@/types/modules/employeeAbsence';

export type WfmAbsenceConflictWarning = {
  code: string;
  message: string;
  severity: 'warning' | 'error';
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function mapWfmTypeToAbsenceType(type: WfmAbsenceType): AbsenceType {
  if (type === 'vacation') return 'vacation';
  if (type === 'sick_leave' || type === 'child_sick_leave') return 'sick_leave';
  if (type === 'training') return 'training';
  if (type === 'blocked_time') return 'blocked_time';
  return 'other';
}

export function detectWfmAbsenceOverlapConflicts(
  candidate: Pick<WfmAbsence, 'id' | 'employeeId' | 'startsAt' | 'endsAt' | 'status'>,
  existing: WfmAbsence[],
): WfmAbsenceConflictWarning[] {
  const warnings: WfmAbsenceConflictWarning[] = [];
  const blockingStatuses = new Set(['requested', 'approved', 'active']);

  for (const other of existing) {
    if (other.id === candidate.id) continue;
    if (other.employeeId !== candidate.employeeId) continue;
    if (!blockingStatuses.has(other.status)) continue;
    if (!overlaps(candidate.startsAt, candidate.endsAt, other.startsAt, other.endsAt)) continue;

    const label = other.status === 'requested' ? 'Überlappender Antrag' : 'Genehmigte Abwesenheit';
    warnings.push({
      code: 'overlap',
      message: `${label}: ${other.absenceType} (${other.startsAt.slice(0, 10)} – ${other.endsAt.slice(0, 10)})`,
      severity: other.status === 'approved' || other.status === 'active' ? 'error' : 'warning',
    });
  }

  return warnings;
}

export function detectWfmAssignmentConflicts(
  absence: Pick<WfmAbsence, 'employeeId' | 'startsAt' | 'endsAt' | 'absenceType'>,
  assignments: AssignmentWorkflowRecord[],
): AbsenceConflict[] {
  const overlapping = findAssignmentsOverlappingAbsence(absence, assignments);
  if (overlapping.length === 0) return [];

  const absenceType = mapWfmTypeToAbsenceType(absence.absenceType);
  const code = absenceTypeToConflictCode(absenceType);
  return overlapping.map((assignment) => ({
    code: 'assignment_needs_replacement',
    message: `Einsatz am ${assignment.plannedStartAt.slice(0, 10)} benötigt ggf. Vertretung.`,
    severity: 'warning' as const,
    assignmentId: assignment.id,
  }));
}

export function detectWfmVacationBalanceWarning(input: {
  absenceType: WfmAbsenceType;
  requestedDays: number | null;
  remainingDays: number | null;
}): WfmAbsenceConflictWarning | null {
  if (input.absenceType !== 'vacation') return null;
  if (input.remainingDays == null || input.requestedDays == null) return null;
  if (input.requestedDays <= input.remainingDays) return null;

  return {
    code: 'vacation_balance',
    message: `Urlaubsanspruch überschritten (${input.requestedDays} Tage beantragt, ${input.remainingDays} verbleibend).`,
    severity: 'warning',
  };
}

export function mergeWfmConflictWarnings(
  overlap: WfmAbsenceConflictWarning[],
  assignments: AbsenceConflict[],
  balance: WfmAbsenceConflictWarning | null,
): WfmAbsenceConflictWarning[] {
  const merged: WfmAbsenceConflictWarning[] = [...overlap];
  for (const conflict of assignments) {
    merged.push({
      code: conflict.code,
      message: conflict.message,
      severity: conflict.severity,
    });
  }
  if (balance) merged.push(balance);
  return merged;
}
