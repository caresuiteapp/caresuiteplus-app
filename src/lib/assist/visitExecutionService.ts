import type { RoleKey, ServiceResult } from '@/types';
import type { VisitTaskStatus } from '@/lib/assist/visitTypes';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isUuid } from '@/lib/validation/uuid';
import { fetchVisitDispositionDetail } from '@/lib/assist/visitService';

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

  if (getServiceMode() === 'supabase' && isUuid(visitId)) {
    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, visitId);
    if (resolvedId) {
      return visitSupabaseRepository.updateTask(
        tenantId,
        resolvedId,
        taskId,
        status,
        notDoneReason,
      );
    }

    const legacy = await assignmentSupabaseRepository.updateTask(
      tenantId,
      visitId,
      taskId,
      status,
      notDoneReason ?? undefined,
    );
    if (!legacy.ok) return legacy;
    return fetchVisitDispositionDetail(visitId, tenantId, actorRoleKey);
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

  if (getServiceMode() === 'supabase' && isUuid(visitId)) {
    const resolvedId = await visitSupabaseRepository.resolveVisitId(tenantId, visitId);
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

  if (!input.hasSignature) {
    return { valid: false, error: 'Klient:innen-Unterschrift fehlt — bitte erfassen.' };
  }

  return { valid: true };
}
