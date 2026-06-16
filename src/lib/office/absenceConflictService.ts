import type { AbsenceConflict, AbsenceConflictCode, AbsenceType } from '@/types/modules/employeeAbsence';
import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import type { PlanningAbsenceBlock } from './absenceStore';

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function absenceTypeToConflictCode(absenceType: AbsenceType): AbsenceConflictCode {
  switch (absenceType) {
    case 'sick_leave':
    case 'child_sick_leave':
      return 'employee_sick';
    case 'vacation':
      return 'employee_on_vacation';
    case 'training':
      return 'employee_training';
    case 'no_availability':
    case 'blocked_time':
    case 'appointment':
      return 'unavailable_time';
    default:
      return 'employee_absent';
  }
}

export function conflictCodeToMessage(code: AbsenceConflictCode, absenceType: AbsenceType): string {
  switch (code) {
    case 'employee_sick':
      return 'Mitarbeitende:r ist krankgemeldet.';
    case 'employee_on_vacation':
      return 'Mitarbeitende:r ist im Urlaub.';
    case 'employee_training':
      return 'Mitarbeitende:r ist in Fortbildung.';
    case 'unavailable_time':
      return 'Mitarbeitende:r ist in diesem Zeitraum nicht verfügbar.';
    case 'assignment_needs_replacement':
      return 'Einsatz benötigt Vertretung.';
    default:
      return `Mitarbeitende:r ist abwesend (${absenceType}).`;
  }
}

export function detectAbsenceAssignmentConflicts(input: {
  employeeId: string;
  startsAt: string;
  endsAt: string;
  absences: PlanningAbsenceBlock[];
}): AbsenceConflict[] {
  const conflicts: AbsenceConflict[] = [];
  for (const absence of input.absences) {
    if (
      absence.employeeId === input.employeeId &&
      overlaps(input.startsAt, input.endsAt, absence.startsAt, absence.endsAt)
    ) {
      const code = absenceTypeToConflictCode(absence.absenceType);
      conflicts.push({
        code,
        message: conflictCodeToMessage(code, absence.absenceType),
        severity: 'error',
        absenceId: absence.absenceId,
      });
    }
  }
  return conflicts;
}

export function findAssignmentsOverlappingAbsence(
  absence: { employeeId: string; startsAt: string; endsAt: string },
  assignments: AssignmentWorkflowRecord[],
): AssignmentWorkflowRecord[] {
  return assignments.filter(
    (a) =>
      a.employeeId === absence.employeeId &&
      a.canonicalStatus !== 'cancelled' &&
      overlaps(absence.startsAt, absence.endsAt, a.plannedStartAt, a.plannedEndAt),
  );
}

export function hasBlockingAbsenceConflicts(conflicts: AbsenceConflict[]): boolean {
  return conflicts.some((c) => c.severity === 'error');
}

export function countRequestedDays(startsAt: string, endsAt: string, halfDayStart = false, halfDayEnd = false): number {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const msPerDay = 86_400_000;
  const rawDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));
  let days = rawDays;
  if (halfDayStart) days -= 0.5;
  if (halfDayEnd) days -= 0.5;
  return Math.max(0.5, days);
}
