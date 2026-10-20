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
import { fetchVisitDispositionDetail } from '@/lib/assist/visitService';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';

function tenantDenied<T>(tenantId: string): ServiceResult<T> | null {
  const block = guardServiceTenant(tenantId);
  if (block) return block;
  return null;
}

/** Canonical visit fields are authoritative; updated_at is never a work timestamp. */
function mapVisitExecution(visit: VisitDispositionDetail): AssignmentExecution {
  const phase: AssignmentExecution['phase'] = visit.assignmentStatus === 'abgeschlossen' ? 'completed'
    : ['storniert', 'nicht_erschienen'].includes(visit.assignmentStatus) ? 'cancelled'
    : ['gestartet', 'pausiert', 'beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(visit.assignmentStatus) ? 'in_progress'
    : visit.assignmentStatus === 'angekommen' ? 'checked_in' : 'pending';
  return {
    assignmentId: visit.id, tenantId: visit.tenantId, status: visit.assignmentStatus, phase,
    plannedStartAt: visit.scheduledStart, plannedEndAt: visit.scheduledEnd,
    onTheWayAt: visit.onTheWayAt, arrivedAt: visit.arrivedAt,
    checkedInAt: visit.arrivedAt, checkedOutAt: visit.actualEndAt,
    actualStartAt: visit.actualStartAt, actualEndAt: visit.actualEndAt, finishedAt: visit.finishedAt,
    documentationNotes: visit.documentationNotes ?? null, activityNote: visit.documentationNotes ?? null,
    durationMinutes: visit.durationMinutes ?? null, locationNote: visit.locationNotes ?? null,
    tasks: visit.tasks.map(task => ({ id: task.id, title: task.title, status: task.status,
      isRequired: task.isRequired, notDoneReason: task.notDoneReason, requiresNoteIfNotDone: task.isRequired })),
    allowedTransitions: visit.allowedStatusTransitions, serviceRecordId: null, updatedAt: visit.updatedAt,
  };
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
      .filter((row) => ['on_the_way', 'arrived', 'started', 'paused'].includes(row.status))
      .map((row) => ({
        assignmentId: row.id,
        title: row.title,
        clientName: row.title,
        location: '—',
        scheduledStart: row.planned_start_at,
        scheduledEnd: row.planned_end_at,
        phase: row.status === 'started' || row.status === 'paused' ? 'in_progress' : row.status === 'arrived' ? 'checked_in' : 'pending',
        assignmentStatus: 'in_bearbeitung',
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
    const result = await fetchVisitDispositionDetail(assignmentId, tenantId, actorRoleKey);
    if (!result.ok) return result;
    if (result.data.tenantId !== tenantId) return { ok: false, error: 'Der Einsatz konnte diesem Mandanten nicht zugeordnet werden.' };
    return { ok: true, data: mapVisitExecution(result.data) };
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
    // The former direct assignment update skipped visit events, documentation,
    // signature and proof receipts. Live execution uses the guided visit route.
    return { ok: false, error: 'Bitte die eigene Einsatzdurchführung öffnen. Ankunft, Arbeitszeit, Dokumentation und Unterschrift werden dort gemeinsam bestätigt.' };
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
    // The former direct assignment update skipped visit events, documentation,
    // signature and proof receipts. Live execution uses the guided visit route.
    return { ok: false, error: 'Bitte die eigene Einsatzdurchführung öffnen. Ankunft, Arbeitszeit, Dokumentation und Unterschrift werden dort gemeinsam bestätigt.' };
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
    // The former direct assignment update skipped visit events, documentation,
    // signature and proof receipts. Live execution uses the guided visit route.
    return { ok: false, error: 'Bitte die eigene Einsatzdurchführung öffnen. Ankunft, Arbeitszeit, Dokumentation und Unterschrift werden dort gemeinsam bestätigt.' };
  }

  await new Promise((r) => setTimeout(r, 400));

  const execution = checkOutDemoAssignment(assignmentId, activityNote);
  if (!execution) {
    return { ok: false, error: 'Check-out fehlgeschlagen. Einsatz ist nicht aktiv.' };
  }

  updateDemoAssignmentSeedStatus(assignmentId, 'abgeschlossen');
  return { ok: true, data: execution };
}
