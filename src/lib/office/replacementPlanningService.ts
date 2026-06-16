import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeeAbsence, ReplacementRequest } from '@/types/modules/employeeAbsence';
import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  assignEmployeeToWorkflow,
  listAssignmentWorkflows,
} from '@/lib/assist/assignmentWorkflowService';
import { writeMonitorAuditEvent } from '@/lib/assist/monitorAuditService';
import { createMonitorNotification } from '@/lib/assist/monitorNotificationService';
import {
  ABSENCE_STORE,
  filterByTenant,
  getPlanningBlockAbsences,
  nextReplacementRequestId,
} from './absenceStore';
import { detectAbsenceAssignmentConflicts } from './absenceConflictService';

/** Demo-Qualifikations-Mapping für Vertretungsvorschläge */
const EMPLOYEE_QUALIFICATIONS: Record<string, string> = {
  'employee-001': 'pflege',
  'employee-002': 'pflege',
  'employee-003': 'betreuung',
  'employee-004': 'verwaltung',
  'employee-005': 'ausbildung',
  'employee-006': 'pflege',
};

export function createReplacementRequestsForAbsence(
  absence: EmployeeAbsence,
  overlappingAssignments: AssignmentWorkflowRecord[],
): ReplacementRequest[] {
  const created: ReplacementRequest[] = [];
  for (const assignment of overlappingAssignments) {
    const existing = ABSENCE_STORE.replacementRequests.find(
      (r) =>
        r.tenantId === absence.tenantId &&
        r.assignmentId === assignment.id &&
        r.status !== 'cancelled' &&
        r.status !== 'completed',
    );
    if (existing) {
      created.push(existing);
      continue;
    }

    const request: ReplacementRequest = {
      id: nextReplacementRequestId(),
      tenantId: absence.tenantId,
      assignmentId: assignment.id,
      originalEmployeeId: absence.employeeId,
      absenceId: absence.id,
      suggestedEmployeeId: null,
      assignedEmployeeId: null,
      status: 'open',
      travelTimeMinutes: null,
      qualificationMatch: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
    };
    ABSENCE_STORE.replacementRequests.push(request);
    created.push(request);
  }
  return created;
}

export function suggestReplacementEmployees(
  tenantId: string,
  assignmentId: string,
  options?: { includeTravelTime?: boolean },
): Array<{ employeeId: string; qualificationMatch: boolean; travelTimeMinutes: number | null }> {
  const assignment = listAssignmentWorkflows(tenantId).find((a) => a.id === assignmentId);
  if (!assignment) return [];

  const requiredQual = assignment.serviceType.toLowerCase().includes('pflege') ? 'pflege' : 'betreuung';
  const absences = getPlanningBlockAbsences(tenantId);
  const candidates = Object.keys(EMPLOYEE_QUALIFICATIONS).filter((id) => id !== assignment.employeeId);

  return candidates
    .map((employeeId) => {
      const conflicts = detectAbsenceAssignmentConflicts({
        employeeId,
        startsAt: assignment.plannedStartAt,
        endsAt: assignment.plannedEndAt,
        absences,
      });
      if (conflicts.length > 0) return null;

      const doubleBooked = listAssignmentWorkflows(tenantId).some(
        (a) =>
          a.id !== assignmentId &&
          a.employeeId === employeeId &&
          a.canonicalStatus !== 'cancelled' &&
          new Date(a.plannedStartAt) < new Date(assignment.plannedEndAt) &&
          new Date(assignment.plannedStartAt) < new Date(a.plannedEndAt),
      );
      if (doubleBooked) return null;

      const qualificationMatch = EMPLOYEE_QUALIFICATIONS[employeeId] === requiredQual;
      return {
        employeeId,
        qualificationMatch,
        travelTimeMinutes: options?.includeTravelTime ? 15 : null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => Number(b.qualificationMatch) - Number(a.qualificationMatch));
}

export async function reassignForReplacement(
  tenantId: string,
  replacementRequestId: string,
  newEmployeeId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<ReplacementRequest>> {
  const denied = enforcePermission<ReplacementRequest>(actorRoleKey, 'office.employees.absences.manage');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<ReplacementRequest>(tenantId, 'Vertretungsplanung');
  if (liveBlock) return liveBlock;

  const request = ABSENCE_STORE.replacementRequests.find(
    (r) => r.id === replacementRequestId && r.tenantId === tenantId,
  );
  if (!request) return { ok: false, error: 'Vertretungsanfrage nicht gefunden.' };

  const assignResult = assignEmployeeToWorkflow(
    tenantId,
    request.assignmentId,
    newEmployeeId,
    actorRoleKey,
    actorProfileId,
  );
  if (!assignResult.ok) return { ok: false, error: assignResult.error };

  const now = new Date().toISOString();
  request.assignedEmployeeId = newEmployeeId;
  request.suggestedEmployeeId = newEmployeeId;
  request.status = 'assigned';
  request.updatedAt = now;
  request.resolvedAt = now;

  writeMonitorAuditEvent({
    tenantId,
    assignmentId: request.assignmentId,
    clientId: assignResult.data.clientId,
    documentId: null,
    action: 'replacement_assigned',
    actorUserId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    beforeState: { employeeId: request.originalEmployeeId },
    afterState: { employeeId: newEmployeeId },
    source: 'administration',
    reason: `Vertretung für Abwesenheit ${request.absenceId ?? '—'}`,
  });

  createMonitorNotification({
    tenantId,
    assignmentId: request.assignmentId,
    recipientType: 'employee',
    recipientId: newEmployeeId,
    eventType: 'replacement_assigned',
    title: 'Vertretungseinsatz',
    body: 'Ihnen wurde ein Vertretungseinsatz zugewiesen.',
  });

  return { ok: true, data: request };
}

export function listReplacementRequests(
  tenantId: string,
  filter?: { status?: ReplacementRequest['status']; absenceId?: string },
): ReplacementRequest[] {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return [];

  return filterByTenant(ABSENCE_STORE.replacementRequests, tenantId).filter((r) => {
    if (filter?.status && r.status !== filter.status) return false;
    if (filter?.absenceId && r.absenceId !== filter.absenceId) return false;
    return true;
  });
}

export function listReplacementRequired(tenantId: string): ReplacementRequest[] {
  return listReplacementRequests(tenantId, { status: 'open' });
}
