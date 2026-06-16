import type {
  AssignmentConflict,
  AssignmentWorkflowRecord,
} from '@/types/modules/assignmentWorkflow';
import type { RoleKey } from '@/types/core/auth';
import { detectEmployeeEligibilityConflicts } from './employeeAssignmentEligibilityService';
import type { PlanningAbsenceBlock } from '@/lib/office/absenceStore';
import {
  absenceTypeToConflictCode,
  conflictCodeToMessage,
} from '@/lib/office/absenceConflictService';

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function detectAssignmentConflicts(input: {
  assignment: Pick<
    AssignmentWorkflowRecord,
    | 'id'
    | 'tenantId'
    | 'clientId'
    | 'employeeId'
    | 'plannedStartAt'
    | 'plannedEndAt'
    | 'locationAddress'
    | 'tasks'
    | 'serviceType'
  >;
  existing: AssignmentWorkflowRecord[];
  employeeAbsences?: PlanningAbsenceBlock[];
  employeeAvailability?: Array<{ employeeId: string; startsAt: string; endsAt: string }>;
  actorRoleKey?: RoleKey | null;
}): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];
  const { assignment, existing } = input;

  if (!assignment.locationAddress?.trim()) {
    conflicts.push({
      code: 'missing_address',
      message: 'Einsatz ohne Adresse.',
      severity: 'error',
    });
  }

  if (!assignment.serviceType?.trim()) {
    conflicts.push({
      code: 'no_service_type',
      message: 'Einsatz ohne Leistungsart.',
      severity: 'error',
    });
  }

  if (!assignment.employeeId && assignment.tasks.length > 0) {
    conflicts.push({
      code: 'no_employee',
      message: 'Offener Einsatz ohne zugewiesene:n Mitarbeitende:n.',
      severity: 'warning',
    });
  }

  if (assignment.tasks.length === 0) {
    conflicts.push({
      code: 'missing_tasks',
      message: 'Einsatz ohne Aufgaben.',
      severity: 'error',
    });
  }

  for (const other of existing) {
    if (other.id === assignment.id || other.tenantId !== assignment.tenantId) continue;
    if (other.canonicalStatus === 'cancelled') continue;

    if (
      assignment.employeeId &&
      other.employeeId === assignment.employeeId &&
      overlaps(assignment.plannedStartAt, assignment.plannedEndAt, other.plannedStartAt, other.plannedEndAt)
    ) {
      conflicts.push({
        code: 'employee_double_booked',
        message: `Mitarbeitende:r doppelt verplant (${other.title}).`,
        severity: 'error',
      });
    }

    if (
      other.clientId === assignment.clientId &&
      overlaps(assignment.plannedStartAt, assignment.plannedEndAt, other.plannedStartAt, other.plannedEndAt)
    ) {
      conflicts.push({
        code: 'client_double_booked',
        message: `Klient:in doppelt geplant (${other.title}).`,
        severity: 'warning',
      });
    }
  }

  if (assignment.employeeId && input.employeeAbsences) {
    for (const absence of input.employeeAbsences) {
      if (
        absence.employeeId === assignment.employeeId &&
        overlaps(assignment.plannedStartAt, assignment.plannedEndAt, absence.startsAt, absence.endsAt)
      ) {
        const code = absenceTypeToConflictCode(absence.absenceType);
        conflicts.push({
          code,
          message: conflictCodeToMessage(code, absence.absenceType),
          severity: 'error',
        });
      }
    }
  }

  if (assignment.employeeId && input.employeeAvailability?.length) {
    const available = input.employeeAvailability.some(
      (slot) =>
        slot.employeeId === assignment.employeeId &&
        new Date(slot.startsAt) <= new Date(assignment.plannedStartAt) &&
        new Date(slot.endsAt) >= new Date(assignment.plannedEndAt),
    );
    if (!available && input.employeeAvailability.length > 0) {
      conflicts.push({
        code: 'outside_availability',
        message: 'Einsatz außerhalb hinterlegter Verfügbarkeit.',
        severity: 'warning',
      });
    }
  }

  if (assignment.employeeId) {
    const absent = input.employeeAbsences?.some(
      (absence) =>
        absence.employeeId === assignment.employeeId &&
        overlaps(assignment.plannedStartAt, assignment.plannedEndAt, absence.startsAt, absence.endsAt),
    );
    const availabilityOk =
      !input.employeeAvailability?.length ||
      input.employeeAvailability.some(
        (slot) =>
          slot.employeeId === assignment.employeeId &&
          new Date(slot.startsAt) <= new Date(assignment.plannedStartAt) &&
          new Date(slot.endsAt) >= new Date(assignment.plannedEndAt),
      );

    conflicts.push(
      ...detectEmployeeEligibilityConflicts({
        tenantId: assignment.tenantId,
        employeeId: assignment.employeeId,
        actorRoleKey: input.actorRoleKey,
        absent,
        availabilityOk,
      }),
    );
  }

  const durationHours =
    (new Date(assignment.plannedEndAt).getTime() - new Date(assignment.plannedStartAt).getTime()) /
    3_600_000;
  if (durationHours > 10) {
    conflicts.push({
      code: 'max_hours_exceeded',
      message: 'Einsatz überschreitet 10 Stunden (Regel vorbereitet).',
      severity: 'warning',
    });
  }

  if (assignment.locationAddress.includes('Fern') && durationHours < 0.5) {
    conflicts.push({
      code: 'travel_time_implausible',
      message: 'Fahrzeit nicht plausibel für kurzen Einsatz.',
      severity: 'warning',
    });
  }

  return conflicts;
}

export function hasBlockingConflicts(conflicts: AssignmentConflict[]): boolean {
  return conflicts.some((c) => c.severity === 'error');
}
