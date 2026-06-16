import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentPlan } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types/core/base';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import {
  getDemoAssignmentSeedById,
  updateDemoAssignmentSeedStatus,
} from '@/data/demo/assistAssignments';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { buildWorkspaceAccessContext, canViewAssignment } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  getAllowedAssignmentTransitions,
  validateAssignmentTransition,
} from '@/lib/assist/assignmentStatusMachine';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import {
  assignmentSupabaseRepository,
  type AssignmentDetail,
} from '@/lib/assist/repositories/assignmentRepository.supabase';

function clientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function employeeName(employeeId: string): string {
  const employee = demoEmployees.find((e) => e.id === employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

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

function applyWorkflowMeta(seed: NonNullable<ReturnType<typeof getDemoAssignmentSeedById>>): AssignmentPlan {
  const assignmentStatus = remoteStatusToAssignment(seed.status);
  const allowed = getAllowedAssignmentTransitions(assignmentStatus);
  return {
    ...seed,
    clientName: clientName(seed.clientId),
    employeeName: employeeName(seed.employeeId),
    nextActionHint: ASSIGNMENT_STATUS_LABELS[assignmentStatus],
    allowedStatusActions: allowed.map(assignmentStatusToWorkflowFilter),
  };
}

function detailToPlan(detail: AssignmentDetail): AssignmentPlan {
  return {
    id: detail.id,
    tenantId: detail.tenantId,
    clientId: detail.clientId,
    employeeId: detail.employeeId,
    appointmentId: detail.appointmentId,
    title: detail.title,
    scheduledStart: detail.scheduledStart,
    scheduledEnd: detail.scheduledEnd,
    status: detail.status,
    location: detail.location,
    notes: detail.notes,
    clientName: detail.clientName,
    employeeName: detail.employeeName,
    nextActionHint: detail.nextActionHint,
    allowedStatusActions: detail.allowedStatusActions,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    visibility: detail.visibility,
    sensitivity: detail.sensitivity,
  };
}

export async function fetchAssignmentDetail(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null; clientId?: string | null },
): Promise<ServiceResult<AssignmentPlan>> {
  const denied = enforcePermission<AssignmentPlan>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await assignmentSupabaseRepository.getById(tenantId, assignmentId);
    if (!result.ok) return result;
    if (!result.data) return { ok: false, error: 'Einsatz nicht gefunden.' };
    const plan = detailToPlan(result.data);
    const access = canViewAssignment(
      buildWorkspaceAccessContext({
        tenantId,
        roleKey: actorRoleKey ?? null,
        userId: workspaceContext?.userId ?? 'demo-user',
        employeeId: workspaceContext?.employeeId ?? null,
        clientId: workspaceContext?.clientId ?? null,
      }),
      { tenantId: plan.tenantId, employeeId: plan.employeeId, clientId: plan.clientId },
    );
    if (!access.allowed) return { ok: false, error: access.message };
    return { ok: true, data: plan };
  }

  await new Promise((r) => setTimeout(r, 240));

  const seed = getDemoAssignmentSeedById(assignmentId);
  if (!seed) {
    return { ok: false, error: 'Einsatz nicht gefunden.' };
  }

  const access = canViewAssignment(
    buildWorkspaceAccessContext({
      tenantId,
      roleKey: actorRoleKey ?? null,
      userId: workspaceContext?.userId ?? 'demo-user',
      employeeId: workspaceContext?.employeeId ?? null,
      clientId: workspaceContext?.clientId ?? null,
    }),
    { tenantId: seed.tenantId, employeeId: seed.employeeId, clientId: seed.clientId },
  );
  if (!access.allowed) return { ok: false, error: access.message };

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

  if (getServiceMode() === 'supabase') {
    const existing = await assignmentSupabaseRepository.getById(tenantId, assignmentId);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    const targetStatus = remoteStatusToAssignment(newStatus);
    const validation = validateAssignmentTransition(existing.data.assignmentStatus, targetStatus);
    if (!validation.valid) {
      return { ok: false, error: validation.error ?? 'Statuswechsel nicht erlaubt.' };
    }

    const updated = await assignmentSupabaseRepository.updateStatus(
      tenantId,
      assignmentId,
      targetStatus,
    );
    if (!updated.ok) return updated;
    return { ok: true, data: detailToPlan(updated.data) };
  }

  const current = getDemoAssignmentSeedById(assignmentId);
  if (!current) {
    return { ok: false, error: 'Einsatz nicht gefunden.' };
  }

  const fromStatus = remoteStatusToAssignment(current.status);
  const toStatus = remoteStatusToAssignment(newStatus);
  const validation = validateAssignmentTransition(fromStatus, toStatus);
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

export async function fetchAssignmentDetailWithTasks(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentDetail>> {
  const denied = enforcePermission<AssignmentDetail>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return assignmentSupabaseRepository.getById(tenantId, assignmentId).then((result) => {
      if (!result.ok) return result;
      if (!result.data) return { ok: false, error: 'Einsatz nicht gefunden.' };
      return { ok: true, data: result.data };
    });
  }

  const seed = getDemoAssignmentSeedById(assignmentId);
  if (!seed) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const plan = applyWorkflowMeta(seed);
  const assignmentStatus = remoteStatusToAssignment(seed.status);
  return {
    ok: true,
    data: {
      ...plan,
      assignmentStatus,
      tasks: [],
      onTheWayAt: null,
      arrivedAt: null,
      finishedAt: null,
      documentationNotes: null,
      plannedStartAt: seed.scheduledStart,
      plannedEndAt: seed.scheduledEnd,
      actualStartAt: null,
      actualEndAt: null,
    },
  };
}
