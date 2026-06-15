import type { RoleKey, ServiceResult } from '@/types';
import type { ActiveExecutionItem, AssignmentExecution } from '@/types/modules/assist';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import {
  checkInDemoAssignment,
  checkOutDemoAssignment,
  getActiveDemoExecutions,
  getDemoAssignmentExecution,
  markDemoArrived,
  markDemoFinished,
  markDemoOnTheWay,
  markDemoPaused,
  submitDemoDocumentation,
} from '@/data/demo/assignmentExecutions';
import { updateDemoAssignmentSeedStatus } from '@/data/demo/assistAssignments';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { mapAssignmentDetailToExecution } from '@/lib/assist/assignmentExecutionMapper';
import type { AssignmentMutationContext } from '@/lib/assist/assignmentAuditHelper';
import {
  assignmentSupabaseRepository,
  type AssignmentDetail,
} from '@/lib/assist/repositories/assignmentRepository.supabase';
import { getSupabaseClient } from '@/lib/supabase/client';

function tenantDenied<T>(tenantId: string): ServiceResult<T> | null {
  const block = guardServiceTenant(tenantId);
  if (block) return block;
  return null;
}

function workflowStatusFromAssignment(status: AssignmentStatus): ActiveExecutionItem['assignmentStatus'] {
  const map: Partial<Record<AssignmentStatus, ActiveExecutionItem['assignmentStatus']>> = {
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

async function loadExecution(
  tenantId: string,
  assignmentId: string,
): Promise<ServiceResult<AssignmentExecution>> {
  const detail = await assignmentSupabaseRepository.getById(tenantId, assignmentId);
  if (!detail.ok) return detail;
  if (!detail.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

  let serviceRecordId: string | null = null;
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from('service_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('assignment_id', assignmentId)
      .maybeSingle();
    serviceRecordId = data?.id ?? null;
  }

  return { ok: true, data: mapAssignmentDetailToExecution(detail.data, serviceRecordId) };
}

async function transitionLive(
  tenantId: string,
  assignmentId: string,
  toStatus: AssignmentStatus,
  actorRoleKey?: RoleKey | null,
  note?: string,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentExecution>> {
  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;

  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  const updated = await assignmentSupabaseRepository.updateStatus(
    tenantId,
    assignmentId,
    toStatus,
    context,
    note,
  );
  if (!updated.ok) return updated;
  return loadExecution(tenantId, assignmentId);
}

export async function fetchActiveExecutions(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ActiveExecutionItem[]>> {
  const denied = enforcePermission<ActiveExecutionItem[]>(
    actorRoleKey,
    'assist.execution.view',
  );
  if (denied) return denied;

  const deniedTenant = tenantDenied<ActiveExecutionItem[]>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const result = await assignmentSupabaseRepository.list(tenantId);
    if (!result.ok) return result;

    const active = result.data.filter((row) =>
      ['aktiv', 'in_bearbeitung', 'entwurf'].includes(row.status),
    );

    const items: ActiveExecutionItem[] = active.map((row) => ({
      assignmentId: row.id,
      title: row.title,
      clientName: row.clientName,
      location: row.location,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      phase:
        row.status === 'in_bearbeitung'
          ? 'in_progress'
          : row.status === 'aktiv'
            ? 'checked_in'
            : 'pending',
      assignmentStatus: row.status,
    }));

    return { ok: true, data: items };
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getActiveDemoExecutions() };
}

export async function fetchAssignmentExecution(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentExecution>> {
  const denied = enforcePermission<AssignmentExecution>(actorRoleKey, 'assist.execution.view');
  if (denied) return denied;

  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    return loadExecution(tenantId, assignmentId);
  }

  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: getDemoAssignmentExecution(assignmentId) };
}

export async function markOnTheWay(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentExecution>> {
  if (getServiceMode() === 'supabase') {
    return transitionLive(tenantId, assignmentId, 'unterwegs', actorRoleKey, undefined, context);
  }

  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;
  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  await new Promise((r) => setTimeout(r, 300));
  const execution = markDemoOnTheWay(assignmentId);
  if (!execution) return { ok: false, error: 'Unterwegs-Meldung fehlgeschlagen.' };
  updateDemoAssignmentSeedStatus(assignmentId, 'aktiv');
  return { ok: true, data: execution };
}

export async function markArrived(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentExecution>> {
  if (getServiceMode() === 'supabase') {
    return transitionLive(tenantId, assignmentId, 'angekommen', actorRoleKey, undefined, context);
  }

  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;
  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  await new Promise((r) => setTimeout(r, 280));
  const execution = markDemoArrived(assignmentId);
  if (!execution) return { ok: false, error: 'Ankunft konnte nicht gemeldet werden.' };
  return { ok: true, data: execution };
}

export async function markStarted(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentExecution>> {
  if (getServiceMode() === 'supabase') {
    return transitionLive(tenantId, assignmentId, 'gestartet', actorRoleKey, undefined, context);
  }

  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;
  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  await new Promise((r) => setTimeout(r, 280));
  const execution = checkInDemoAssignment(assignmentId);
  if (!execution) return { ok: false, error: 'Einsatz kann erst nach Ankunft gestartet werden.' };
  updateDemoAssignmentSeedStatus(assignmentId, 'in_bearbeitung');
  return { ok: true, data: getDemoAssignmentExecution(assignmentId) };
}

export async function markPaused(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentExecution>> {
  if (getServiceMode() === 'supabase') {
    return transitionLive(tenantId, assignmentId, 'pausiert', actorRoleKey, undefined, context);
  }

  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;
  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  await new Promise((r) => setTimeout(r, 260));
  const execution = markDemoPaused(assignmentId);
  if (!execution) return { ok: false, error: 'Pause nicht möglich.' };
  return { ok: true, data: execution };
}

export async function markFinished(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentExecution>> {
  if (getServiceMode() === 'supabase') {
    return transitionLive(tenantId, assignmentId, 'beendet', actorRoleKey, undefined, context);
  }

  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;
  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  await new Promise((r) => setTimeout(r, 320));
  const execution = markDemoFinished(assignmentId);
  if (!execution) return { ok: false, error: 'Einsatz kann nicht beendet werden.' };
  return { ok: true, data: execution };
}

export async function submitDocumentation(
  assignmentId: string,
  tenantId: string,
  documentationNotes: string,
  actorRoleKey?: RoleKey | null,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentExecution>> {
  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;

  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (!documentationNotes.trim()) {
    return { ok: false, error: 'Dokumentation ist erforderlich.' };
  }

  if (getServiceMode() === 'supabase') {
    const result = await assignmentSupabaseRepository.completeWithDocumentation(
      tenantId,
      assignmentId,
      documentationNotes,
      context,
    );
    if (!result.ok) return result;
    return loadExecution(tenantId, assignmentId);
  }

  await new Promise((r) => setTimeout(r, 350));
  const execution = submitDemoDocumentation(assignmentId, documentationNotes);
  if (!execution) return { ok: false, error: 'Dokumentation konnte nicht gespeichert werden.' };
  return { ok: true, data: execution };
}

export async function completeAssignment(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentExecution>> {
  if (getServiceMode() === 'supabase') {
    const existing = await assignmentSupabaseRepository.getById(tenantId, assignmentId);
    if (!existing.ok) return existing;
    if (!existing.data) return { ok: false, error: 'Einsatz nicht gefunden.' };

    if (!existing.data.documentationNotes?.trim()) {
      return { ok: false, error: 'Dokumentation ist vor Abschluss erforderlich.' };
    }

    const updated = await assignmentSupabaseRepository.updateStatus(
      tenantId,
      assignmentId,
      'abgeschlossen',
      context,
    );
    if (!updated.ok) return updated;

    await assignmentSupabaseRepository.prepareServiceRecord(tenantId, assignmentId, context);
    return loadExecution(tenantId, assignmentId);
  }

  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;
  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  await new Promise((r) => setTimeout(r, 400));
  const execution = checkOutDemoAssignment(assignmentId);
  if (!execution) return { ok: false, error: 'Abschluss fehlgeschlagen.' };
  updateDemoAssignmentSeedStatus(assignmentId, 'abgeschlossen');
  return { ok: true, data: execution };
}

export async function updateAssignmentTask(
  assignmentId: string,
  taskId: string,
  tenantId: string,
  status: AssignmentExecution['tasks'][number]['status'],
  notDoneReason: string | undefined,
  actorRoleKey?: RoleKey | null,
  context?: AssignmentMutationContext,
): Promise<ServiceResult<AssignmentDetail>> {
  const denied = enforcePermission<AssignmentDetail>(actorRoleKey, 'assist.execution.manage');
  if (denied) return denied;

  const deniedTenant = tenantDenied<AssignmentDetail>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    return assignmentSupabaseRepository.updateTask(
      tenantId,
      assignmentId,
      taskId,
      status,
      notDoneReason,
      context,
    );
  }

  return { ok: false, error: 'Aufgabenaktualisierung nur im Live-Modus verfügbar.' };
}

/** @deprecated Use markOnTheWay */
export async function checkInAssignment(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  locationNote?: string,
): Promise<ServiceResult<AssignmentExecution>> {
  return markOnTheWay(assignmentId, tenantId, actorRoleKey);
}

/** @deprecated Use markStarted */
export async function startAssignmentWork(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentExecution>> {
  return markStarted(assignmentId, tenantId, actorRoleKey);
}

/** @deprecated Use completeAssignment */
export async function checkOutAssignment(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  activityNote?: string,
): Promise<ServiceResult<AssignmentExecution>> {
  if (activityNote?.trim()) {
    const docResult = await submitDocumentation(
      assignmentId,
      tenantId,
      activityNote,
      actorRoleKey,
    );
    if (!docResult.ok) return docResult;
  }
  return completeAssignment(assignmentId, tenantId, actorRoleKey);
}

export { ASSIGNMENT_STATUS_LABELS, workflowStatusFromAssignment };
