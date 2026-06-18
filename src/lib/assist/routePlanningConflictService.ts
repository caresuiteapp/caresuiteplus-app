import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import type {
  RoutePlanningConflict,
  RoutePlanningConflictCode,
  TravelTimeEstimate,
} from '@/types/modules/routePlanning';
import { TRAVEL_TIME_DISCLAIMER } from '@/types/modules/routePlanning';
import type { PlanningAbsenceBlock } from '@/lib/office/absenceStore';
import { detectEmployeeEligibilityConflicts } from './employeeAssignmentEligibilityService';
import { absenceTypeToConflictCode, conflictCodeToMessage } from '@/lib/office/absenceConflictService';
import { getEmployeePersonnelFileForAssignmentCheck } from '@/lib/assist/employeePersonnelFileService';
import { INACTIVE_EMPLOYMENT_STATUSES } from '@/lib/assist/employeepersonnelfieldrules';
import { isGeoLiveReady } from '@/lib/geo/geoModuleConfig';

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function extractRegionHint(address: string): string {
  const plzMatch = address.match(/\b(\d{5})\b/);
  if (plzMatch) return plzMatch[1]!.slice(0, 2);
  const lower = address.toLowerCase();
  if (lower.includes('berlin')) return 'berlin';
  if (lower.includes('hamburg')) return 'hamburg';
  if (lower.includes('münchen') || lower.includes('muenchen')) return 'muenchen';
  return lower.trim().slice(0, 8) || 'unknown';
}

export function extractPostalPrefix(address: string): string | null {
  const plzMatch = address.match(/\b(\d{5})\b/);
  return plzMatch ? plzMatch[1]!.slice(0, 2) : null;
}

export function estimateHeuristicTravelMinutes(fromAddress: string, toAddress: string): number {
  const fromRegion = extractRegionHint(fromAddress);
  const toRegion = extractRegionHint(toAddress);
  if (fromRegion === toRegion) return 15;
  if (fromRegion.slice(0, 2) === toRegion.slice(0, 2)) return 25;
  return 45;
}

export function buildHeuristicTravelEstimate(input: {
  tenantId: string;
  assignmentId?: string | null;
  fromAddress: string;
  toAddress: string;
}): Omit<TravelTimeEstimate, 'id' | 'createdAt' | 'updatedAt'> {
  const durationMinutes = estimateHeuristicTravelMinutes(input.fromAddress, input.toAddress);
  return {
    tenantId: input.tenantId,
    assignmentId: input.assignmentId ?? null,
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    durationMinutes,
    source: 'heuristic',
    providerKey: null,
    isPlausible: true,
    disclaimer: TRAVEL_TIME_DISCLAIMER,
    calculatedAt: new Date().toISOString(),
  };
}

export function checkRegionalProximity(
  employeeHomeAddress: string | null,
  assignmentAddress: string,
): 'same_region' | 'adjacent' | 'distant' | 'unknown' {
  if (!employeeHomeAddress?.trim() || !assignmentAddress.trim()) return 'unknown';
  const employeePrefix = extractPostalPrefix(employeeHomeAddress);
  const assignmentPrefix = extractPostalPrefix(assignmentAddress);
  if (!employeePrefix || !assignmentPrefix) {
    const employeeRegion = extractRegionHint(employeeHomeAddress);
    const assignmentRegion = extractRegionHint(assignmentAddress);
    if (employeeRegion === assignmentRegion) return 'same_region';
    return 'distant';
  }
  if (employeePrefix === assignmentPrefix) return 'same_region';
  const diff = Math.abs(Number(employeePrefix) - Number(assignmentPrefix));
  if (diff <= 2) return 'adjacent';
  return 'distant';
}

export function detectRoutePlanningConflictsForAssignment(input: {
  assignment: Pick<
    AssignmentWorkflowRecord,
    | 'id'
    | 'tenantId'
    | 'employeeId'
    | 'plannedStartAt'
    | 'plannedEndAt'
    | 'locationAddress'
    | 'serviceType'
  >;
  existing: AssignmentWorkflowRecord[];
  employeeAbsences?: PlanningAbsenceBlock[];
  employeeAvailability?: Array<{ employeeId: string; startsAt: string; endsAt: string }>;
  actorRoleKey?: string | null;
  requireProvider?: boolean;
  previousAssignmentAddress?: string | null;
  previousAssignmentEndAt?: string | null;
}): RoutePlanningConflict[] {
  const conflicts: RoutePlanningConflict[] = [];
  const { assignment } = input;

  if (!assignment.locationAddress?.trim()) {
    conflicts.push({
      code: 'missing_address',
      message: 'Einsatz ohne Adresse — Tourenplanung eingeschränkt.',
      severity: 'error',
      assignmentId: assignment.id,
    });
  }

  if (input.requireProvider && !isGeoLiveReady()) {
    conflicts.push({
      code: 'missing_provider',
      message: 'Externer Kartenprovider nicht freigegeben — nur Heuristik verfügbar.',
      severity: 'warning',
      assignmentId: assignment.id,
    });
  }

  if (assignment.employeeId) {
    const file = getEmployeePersonnelFileForAssignmentCheck(assignment.tenantId, assignment.employeeId);
    if (file && INACTIVE_EMPLOYMENT_STATUSES.has(file.employment.employmentStatus)) {
      conflicts.push({
        code: 'employee_inactive',
        message: 'Mitarbeitende:r ist nicht einsatzfähig.',
        severity: 'error',
        assignmentId: assignment.id,
        employeeId: assignment.employeeId,
      });
    }

    const absent = input.employeeAbsences?.some(
      (absence) =>
        absence.employeeId === assignment.employeeId &&
        overlaps(assignment.plannedStartAt, assignment.plannedEndAt, absence.startsAt, absence.endsAt),
    );

    if (absent) {
      const absence = input.employeeAbsences!.find(
        (a) =>
          a.employeeId === assignment.employeeId &&
          overlaps(assignment.plannedStartAt, assignment.plannedEndAt, a.startsAt, a.endsAt),
      );
      const code: RoutePlanningConflictCode = absence
        ? mapAbsenceToPlanningConflict(absence.absenceType)
        : 'absence';
      conflicts.push({
        code,
        message: absence
          ? conflictCodeToMessage(absenceTypeToConflictCode(absence.absenceType), absence.absenceType)
          : 'Mitarbeitende:r ist abwesend.',
        severity: 'error',
        assignmentId: assignment.id,
        employeeId: assignment.employeeId,
      });
    }

    const availabilityOk =
      !input.employeeAvailability?.length ||
      input.employeeAvailability.some(
        (slot) =>
          slot.employeeId === assignment.employeeId &&
          new Date(slot.startsAt) <= new Date(assignment.plannedStartAt) &&
          new Date(slot.endsAt) >= new Date(assignment.plannedEndAt),
      );

    const eligibility = detectEmployeeEligibilityConflicts({
      tenantId: assignment.tenantId,
      employeeId: assignment.employeeId,
      actorRoleKey: input.actorRoleKey as never,
      absent,
      availabilityOk,
    });

    for (const issue of eligibility) {
      if (issue.code === 'qualification_missing' || issue.code === 'employee_inactive') {
        conflicts.push({
          code: issue.code === 'employee_inactive' ? 'employee_inactive' : 'qualification_missing',
          message: issue.message,
          severity: issue.severity,
          assignmentId: assignment.id,
          employeeId: assignment.employeeId,
        });
      }
    }
  }

  for (const other of input.existing) {
    if (other.id === assignment.id || other.tenantId !== assignment.tenantId) continue;
    if (other.canonicalStatus === 'cancelled') continue;

    if (
      assignment.employeeId &&
      other.employeeId === assignment.employeeId &&
      overlaps(assignment.plannedStartAt, assignment.plannedEndAt, other.plannedStartAt, other.plannedEndAt)
    ) {
      conflicts.push({
        code: 'overlapping_assignment',
        message: `Überlappender Einsatz (${other.title}).`,
        severity: 'error',
        assignmentId: assignment.id,
        employeeId: assignment.employeeId,
      });
    }
  }

  if (
    input.previousAssignmentAddress &&
    input.previousAssignmentEndAt &&
    assignment.locationAddress?.trim()
  ) {
    const travelMinutes = estimateHeuristicTravelMinutes(
      input.previousAssignmentAddress,
      assignment.locationAddress,
    );
    const gapMinutes =
      (new Date(assignment.plannedStartAt).getTime() - new Date(input.previousAssignmentEndAt).getTime()) /
      60_000;

    if (gapMinutes > 0 && travelMinutes > gapMinutes) {
      conflicts.push({
        code: 'travel_time_unrealistic',
        message: `Fahrzeit (~${travelMinutes} Min.) nicht plausibel für Puffer (~${Math.round(gapMinutes)} Min.).`,
        severity: 'warning',
        assignmentId: assignment.id,
        employeeId: assignment.employeeId ?? undefined,
      });
    }
  }

  const durationHours =
    (new Date(assignment.plannedEndAt).getTime() - new Date(assignment.plannedStartAt).getTime()) / 3_600_000;
  if (durationHours > 10) {
    conflicts.push({
      code: 'max_working_time_warning',
      message: 'Einsatz überschreitet 10 Stunden.',
      severity: 'warning',
      assignmentId: assignment.id,
      employeeId: assignment.employeeId ?? undefined,
    });
  }

  return conflicts;
}

function mapAbsenceToPlanningConflict(absenceType: PlanningAbsenceBlock['absenceType']): RoutePlanningConflictCode {
  if (absenceType === 'sick_leave' || absenceType === 'child_sick_leave') return 'absence';
  if (absenceType === 'vacation') return 'absence';
  return 'absence';
}

export function hasBlockingPlanningConflicts(conflicts: RoutePlanningConflict[]): boolean {
  return conflicts.some((c) => c.severity === 'error');
}

export function sumDailyWorkMinutes(
  assignments: AssignmentWorkflowRecord[],
  employeeId: string,
  dateKey: string,
): number {
  return assignments
    .filter(
      (a) =>
        a.employeeId === employeeId &&
        a.canonicalStatus !== 'cancelled' &&
        a.plannedStartAt.slice(0, 10) === dateKey,
    )
    .reduce((sum, a) => {
      const minutes =
        (new Date(a.plannedEndAt).getTime() - new Date(a.plannedStartAt).getTime()) / 60_000;
      return sum + minutes;
    }, 0);
}

export function checkMaxWorkingTimeWarning(
  assignments: AssignmentWorkflowRecord[],
  employeeId: string,
  dateKey: string,
  maxHours = 10,
): RoutePlanningConflict | null {
  const totalMinutes = sumDailyWorkMinutes(assignments, employeeId, dateKey);
  if (totalMinutes / 60 <= maxHours) return null;
  return {
    code: 'max_working_time_warning',
    message: `Tagesarbeitszeit ~${(totalMinutes / 60).toFixed(1)} h überschreitet ${maxHours} h.`,
    severity: 'warning',
    employeeId,
  };
}
