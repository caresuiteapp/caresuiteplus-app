import type { RoleKey, ServiceResult } from '@/types';
import type {
  AbsenceScheduleEntry,
  EmployeeAbsence,
} from '@/types/modules/employeeAbsence';
import { ABSENCE_TYPE_LABELS } from '@/types/modules/employeeAbsence';
import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import type { ScheduleEntry } from '@/types/modules/assignmentWorkflow';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  listAssignmentWorkflows,
  listScheduleEntries,
} from '@/lib/assist/assignmentWorkflowService';
import { listAbsencesForTenant } from './absenceStore';

const ACTIVE_ABSENCE_STATUSES = new Set(['approved', 'active', 'requires_review']);

export function buildAbsenceScheduleEntry(absence: EmployeeAbsence): AbsenceScheduleEntry {
  return {
    id: `sched-abs-${absence.id}`,
    tenantId: absence.tenantId,
    absenceId: absence.id,
    employeeId: absence.employeeId,
    startsAt: absence.startsAt,
    endsAt: absence.endsAt,
    entryType: 'absence',
    absenceType: absence.absenceType,
    title: ABSENCE_TYPE_LABELS[absence.absenceType],
    source: 'absence_sync',
    updatedAt: absence.updatedAt,
  };
}

export function listAbsenceScheduleEntries(tenantId: string): AbsenceScheduleEntry[] {
  return listAbsencesForTenant(tenantId)
    .filter((a) => ACTIVE_ABSENCE_STATUSES.has(a.status))
    .map(buildAbsenceScheduleEntry);
}

export type CombinedScheduleEntry =
  | (ScheduleEntry & { kind: 'assignment' })
  | (AbsenceScheduleEntry & { kind: 'absence' });

export function listCombinedScheduleEntries(tenantId: string): CombinedScheduleEntry[] {
  const assignments = listScheduleEntries(tenantId).map((e) => ({ ...e, kind: 'assignment' as const }));
  const absences = listAbsenceScheduleEntries(tenantId).map((e) => ({ ...e, kind: 'absence' as const }));
  return [...assignments, ...absences].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function listAbsenceConflictsForMonth(
  tenantId: string,
  monthKey: string,
): Array<{ absence: EmployeeAbsence; assignment: AssignmentWorkflowRecord }> {
  const absences = listAbsencesForTenant(tenantId).filter(
    (a) => ACTIVE_ABSENCE_STATUSES.has(a.status) && a.replacementRequired,
  );
  const assignments = listAssignmentWorkflows(tenantId);

  const conflicts: Array<{ absence: EmployeeAbsence; assignment: AssignmentWorkflowRecord }> = [];
  for (const absence of absences) {
    if (!absence.startsAt.startsWith(monthKey.slice(0, 7))) continue;
    for (const assignment of assignments) {
      if (
        assignment.employeeId === absence.employeeId &&
        assignment.canonicalStatus !== 'cancelled' &&
        new Date(assignment.plannedStartAt) < new Date(absence.endsAt) &&
        new Date(absence.startsAt) < new Date(assignment.plannedEndAt)
      ) {
        conflicts.push({ absence, assignment });
      }
    }
  }
  return conflicts;
}

export function fetchAbsenceCalendar(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<CombinedScheduleEntry[]> {
  const denied = enforcePermission<CombinedScheduleEntry[]>(actorRoleKey, 'office.employees.absences.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return { ok: true, data: listCombinedScheduleEntries(tenantId) };
}
