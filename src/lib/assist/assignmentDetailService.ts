import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentPlan } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types/core/base';
import {
  getDemoAssignmentSeedById,
  updateDemoAssignmentSeedStatus,
} from '@/data/demo/assistAssignments';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  CLIENT_STATUS_HINTS,
  getAllowedStatusActions,
  validateTransition,
} from '@/lib/services';

function clientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function employeeName(employeeId: string): string {
  const employee = demoEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

function applyWorkflowMeta(seed: NonNullable<ReturnType<typeof getDemoAssignmentSeedById>>): AssignmentPlan {
  return {
    ...seed,
    clientName: clientName(seed.clientId),
    employeeName: employeeName(seed.employeeId),
    nextActionHint: CLIENT_STATUS_HINTS[seed.status],
    allowedStatusActions: getAllowedStatusActions(seed.status),
  };
}

export async function fetchAssignmentDetail(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentPlan>> {
  const denied = enforcePermission<AssignmentPlan>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 240));

  const seed = getDemoAssignmentSeedById(assignmentId);
  if (!seed) {
    return { ok: false, error: 'Einsatz nicht gefunden.' };
  }

  return { ok: true, data: applyWorkflowMeta(seed) };
}

export async function updateAssignmentStatus(
  assignmentId: string,
  tenantId: string,
  newStatus: WorkflowStatus,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentPlan>> {
  const denied = enforcePermission<AssignmentPlan>(
    actorRoleKey,
    'assist.assignments.manage',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const current = getDemoAssignmentSeedById(assignmentId);
  if (!current) {
    return { ok: false, error: 'Einsatz nicht gefunden.' };
  }

  const validation = validateTransition(current.status, newStatus);
  if (!validation.valid) {
    return { ok: false, error: validation.error ?? 'Statuswechsel nicht erlaubt.' };
  }

  await new Promise((r) => setTimeout(r, 300));

  const updated = updateDemoAssignmentSeedStatus(assignmentId, newStatus);
  if (!updated) {
    return { ok: false, error: 'Einsatz konnte nicht aktualisiert werden.' };
  }

  return { ok: true, data: applyWorkflowMeta(updated) };
}
