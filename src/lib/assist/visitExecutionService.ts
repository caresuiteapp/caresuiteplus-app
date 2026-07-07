import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentTaskStatus } from '@/types/modules/assignmentStatus';
import type { VisitTaskStatus } from '@/lib/assist/visitTypes';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isResolvableVisitId, resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { fetchVisitDispositionDetail, resolveExecutableVisitId } from '@/lib/assist/visitService';

const VISIT_TASK_REASON_STATUSES: VisitTaskStatus[] = [
  'partial',
  'not_requested',
  'not_possible',
  'cancelled',
  'deferred',
];

function mapVisitTaskStatusToAssignmentStatus(status: VisitTaskStatus): AssignmentTaskStatus {
  switch (status) {
    case 'done':
      return 'done';
    case 'open':
      return 'open';
    case 'not_requested':
      return 'not_requested';
    case 'cancelled':
      return 'cancelled';
    case 'partial':
    case 'not_possible':
    case 'deferred':
      return 'not_done';
    default:
      return 'not_done';
  }
}

export async function updateVisitTaskStatus(
  visitId: string,
  taskId: string,
  tenantId: string,
  status: VisitTaskStatus,
  actorRoleKey?: RoleKey | null,
  notDoneReason?: string | null,
): Promise<ServiceResult<VisitDispositionDetail>> {
  const denied = enforcePermission<VisitDispositionDetail>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase' && isResolvableVisitId(visitId)) {
    const executable = await resolveExecutableVisitId(tenantId, visitId, actorRoleKey);
    if (!executable.ok) return executable;
    const executableVisitId = executable.data.visitId;

    const masterAssignmentId = resolveVisitMasterId(executableVisitId);
    const resolvedVisitId = await visitSupabaseRepository.resolveVisitId(tenantId, executableVisitId);

    if (resolvedVisitId) {
      const visitUpdate = await visitSupabaseRepository.updateTask(
        tenantId,
        resolvedVisitId,
        taskId,
        status,
        notDoneReason,
      );
      if (visitUpdate.ok) {
        return fetchVisitDispositionDetail(executableVisitId, tenantId, actorRoleKey);
      }
      if (visitUpdate.error !== 'Aufgabe nicht gefunden.') {
        return visitUpdate;
      }
    }

    const assignmentStatus = mapVisitTaskStatusToAssignmentStatus(status);
    const legacy = await assignmentSupabaseRepository.updateTask(
      tenantId,
      masterAssignmentId,
      taskId,
      assignmentStatus,
      VISIT_TASK_REASON_STATUSES.includes(status) || assignmentStatus === 'not_done'
        ? (notDoneReason ?? undefined)
        : undefined,
    );
    if (!legacy.ok) return legacy;
    return fetchVisitDispositionDetail(executableVisitId, tenantId, actorRoleKey);
  }

  await new Promise((r) => setTimeout(r, 200));
  const detail = await fetchVisitDispositionDetail(visitId, tenantId, actorRoleKey);
  if (!detail.ok || !detail.data) return detail;

  const reasonStatuses: VisitTaskStatus[] = [
    'partial',
    'not_requested',
    'not_possible',
    'cancelled',
    'deferred',
  ];

  const tasks = detail.data.tasks.map((t) =>
    t.id === taskId
      ? {
          ...t,
          status,
          notDoneReason: reasonStatuses.includes(status)
              ? (notDoneReason?.trim() ?? null)
              : null,
        }
      : t,
  );

  return { ok: true, data: { ...detail.data, tasks } };
}

export async function updateVisitDocumentation(
  visitId: string,
  tenantId: string,
  employeeNotes: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VisitDispositionDetail>> {
  const denied = enforcePermission<VisitDispositionDetail>(
    actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!employeeNotes.trim()) {
    return { ok: false, error: 'Dokumentation darf nicht leer sein.' };
  }

  if (getServiceMode() === 'supabase' && isResolvableVisitId(visitId)) {
    const executable = await resolveExecutableVisitId(tenantId, visitId, actorRoleKey);
    if (!executable.ok) return executable;
    const executableVisitId = executable.data.visitId;

    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, executableVisitId);
    if (resolvedId) {
      return visitSupabaseRepository.updateDocumentation(tenantId, resolvedId, employeeNotes);
    }
  }

  await new Promise((r) => setTimeout(r, 200));
  const detail = await fetchVisitDispositionDetail(visitId, tenantId, actorRoleKey);
  if (!detail.ok || !detail.data) return detail;

  return {
    ok: true,
    data: {
      ...detail.data,
      employeeNotes: employeeNotes.trim(),
      documentationStatus: 'complete',
    },
  };
}

/**
 * Validate tasks + documentation + signature before closing visit.
 * GAP (Phase 3): after 0156 apply, also verify assist_visit_signatures row exists (not session-only).
 */
export function validateVisitCloseReadiness(input: {
  tasks: VisitDispositionDetail['tasks'];
  documentationNote: string | null;
  hasSignature: boolean;
  /** When true, signature may be deferred to Klient:innenportal. */
  allowDeferredSignature?: boolean;
}): { valid: true } | { valid: false; error: string } {
  const openRequired = input.tasks.filter((t) => t.isRequired && t.status === 'open');
  if (openRequired.length > 0) {
    return {
      valid: false,
      error: `${openRequired.length} Pflichtaufgabe(n) noch offen — bitte erledigen oder begründen.`,
    };
  }

  if (!input.documentationNote?.trim()) {
    return { valid: false, error: 'Dokumentation ist vor Abschluss erforderlich.' };
  }

  if (!input.hasSignature && !input.allowDeferredSignature) {
    return { valid: false, error: 'Klient:innen-Unterschrift fehlt — bitte erfassen.' };
  }

  return { valid: true };
}
