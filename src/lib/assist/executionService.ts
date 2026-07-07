import type { RoleKey, ServiceResult } from '@/types';
import type { ActiveExecutionItem, AssignmentExecution } from '@/types/modules/assist';
import {
  checkInDemoAssignment,
  checkOutDemoAssignment,
  getActiveDemoExecutions,
  getDemoAssignmentExecution,
  startDemoAssignmentWork,
} from '@/data/demo/assignmentExecutions';
import { updateDemoAssignmentSeedStatus } from '@/data/demo/assistAssignments';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { executionSupabaseRepository } from '@/lib/services/repositories/executionRepository.supabase';
import { resolveExecutableVisitId } from '@/lib/assist/visitService';

function tenantDenied<T>(tenantId: string): ServiceResult<T> | null {
  const block = guardServiceTenant(tenantId);
  if (block) return block;
  return null;
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
    const result = await executionSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    const data: ActiveExecutionItem[] = result.data
      .filter((row) => row.status === 'in_bearbeitung' || row.status === 'aktiv')
      .map((row) => ({
        assignmentId: row.id,
        title: row.title,
        clientName: row.title,
        location: '—',
        scheduledStart: row.created_at,
        scheduledEnd: row.updated_at,
        phase: row.status === 'in_bearbeitung' ? 'in_progress' : 'checked_in',
        assignmentStatus: row.status as ActiveExecutionItem['assignmentStatus'],
      }));
    return { ok: true, data };
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
    const result = await executionSupabaseRepository.getById(tenantId, assignmentId);
    if (!result.ok) return result;
    if (!result.data) return { ok: false, error: 'Einsatz nicht gefunden.' };
    const row = result.data;
    const phase =
      row.status === 'abgeschlossen'
        ? 'completed'
        : row.status === 'in_bearbeitung'
          ? 'in_progress'
          : 'pending';
    return {
      ok: true,
      data: {
        assignmentId: row.id,
        tenantId: row.tenant_id,
        phase,
        checkedInAt: row.status !== 'entwurf' ? row.updated_at : null,
        checkedOutAt: row.status === 'abgeschlossen' ? row.updated_at : null,
        actualStartAt: row.status === 'in_bearbeitung' ? row.updated_at : null,
        actualEndAt: row.status === 'abgeschlossen' ? row.updated_at : null,
        durationMinutes: null,
        locationNote: null,
        activityNote: null,
        updatedAt: row.updated_at,
      },
    };
  }

  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: getDemoAssignmentExecution(assignmentId) };
}

export async function checkInAssignment(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  locationNote?: string,
): Promise<ServiceResult<AssignmentExecution>> {
  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;

  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const executable = await resolveExecutableVisitId(tenantId, assignmentId, actorRoleKey);
    if (!executable.ok) return executable;
    const executableAssignmentId = executable.data.visitId;

    const existing = await executionSupabaseRepository.getById(tenantId, executableAssignmentId);
    if (!existing.ok) return existing;
    if (!existing.data) {
      return { ok: false, error: 'Einsatz nicht gefunden.' };
    }
    const updated = await executionSupabaseRepository.updateStatus(
      tenantId,
      executableAssignmentId,
      'aktiv',
    );
    if (!updated.ok) return updated;
    return fetchAssignmentExecution(executableAssignmentId, tenantId, actorRoleKey);
  }

  await new Promise((r) => setTimeout(r, 350));

  const execution = checkInDemoAssignment(assignmentId, locationNote);
  if (!execution) {
    return { ok: false, error: 'Check-in fehlgeschlagen. Einsatz nicht gefunden.' };
  }

  updateDemoAssignmentSeedStatus(assignmentId, 'in_bearbeitung');
  return { ok: true, data: execution };
}

export async function startAssignmentWork(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentExecution>> {
  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;

  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const executable = await resolveExecutableVisitId(tenantId, assignmentId, actorRoleKey);
    if (!executable.ok) return executable;
    const executableAssignmentId = executable.data.visitId;

    const existing = await executionSupabaseRepository.getById(tenantId, executableAssignmentId);
    if (!existing.ok) return existing;
    if (!existing.data || existing.data.status === 'entwurf') {
      return { ok: false, error: 'Einsatz kann nur nach Check-in gestartet werden.' };
    }
    const updated = await executionSupabaseRepository.updateStatus(
      tenantId,
      executableAssignmentId,
      'in_bearbeitung',
    );
    if (!updated.ok) return updated;
    return fetchAssignmentExecution(executableAssignmentId, tenantId, actorRoleKey);
  }

  await new Promise((r) => setTimeout(r, 280));

  const execution = startDemoAssignmentWork(assignmentId);
  if (!execution) {
    return { ok: false, error: 'Einsatz kann nur nach Check-in gestartet werden.' };
  }

  return { ok: true, data: execution };
}

export async function checkOutAssignment(
  assignmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  activityNote?: string,
): Promise<ServiceResult<AssignmentExecution>> {
  const denied = enforcePermission<AssignmentExecution>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;

  const deniedTenant = tenantDenied<AssignmentExecution>(tenantId);
  if (deniedTenant) return deniedTenant;

  if (getServiceMode() === 'supabase') {
    const executable = await resolveExecutableVisitId(tenantId, assignmentId, actorRoleKey);
    if (!executable.ok) return executable;
    const executableAssignmentId = executable.data.visitId;

    const updated = await executionSupabaseRepository.updateStatus(
      tenantId,
      executableAssignmentId,
      'abgeschlossen',
    );
    if (!updated.ok) return updated;
    return fetchAssignmentExecution(executableAssignmentId, tenantId, actorRoleKey);
  }

  await new Promise((r) => setTimeout(r, 400));

  const execution = checkOutDemoAssignment(assignmentId, activityNote);
  if (!execution) {
    return { ok: false, error: 'Check-out fehlgeschlagen. Einsatz ist nicht aktiv.' };
  }

  updateDemoAssignmentSeedStatus(assignmentId, 'abgeschlossen');
  return { ok: true, data: execution };
}
