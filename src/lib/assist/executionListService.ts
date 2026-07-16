import type { RoleKey, ServiceResult } from '@/types';
import type { ActiveExecutionItem } from '@/types/modules/assist';
import { visitSupabaseRepository } from './repositories/visitRepository.supabase';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import type { VisitDispositionListItem } from './visitTypes';

export function buildDueExecutionItems(visits: VisitDispositionListItem[], now = new Date()): ActiveExecutionItem[] {
  return visits
    .filter((visit) => {
      if (new Date(visit.scheduledEnd).getTime() > now.getTime()) return false;
      if (visit.planningStatus !== 'draft') return true;
      return visit.isAtRisk || visit.isIncomplete;
    })
    .map((visit): ActiveExecutionItem => ({
      assignmentId: visit.id, title: visit.title, clientName: visit.clientName, employeeName: visit.employeeName,
      serviceName: visit.serviceName, location: visit.location, scheduledStart: visit.scheduledStart, scheduledEnd: visit.scheduledEnd,
      phase: visit.assignmentStatus === 'abgeschlossen' ? 'completed'
        : visit.assignmentStatus === 'storniert' || visit.assignmentStatus === 'nicht_erschienen' ? 'cancelled'
        : visit.executionStatus === 'in_progress' || visit.executionStatus === 'paused' ? 'in_progress'
        : visit.executionStatus === 'arrived' || visit.executionStatus === 'on_way' ? 'checked_in' : 'pending',
      assignmentStatus: visit.status, executionStatus: visit.executionStatus, documentationStatus: visit.documentationStatus,
      proofStatus: visit.proofStatus, isIncomplete: visit.isIncomplete, hasError: visit.isAtRisk,
      requiresTimeCorrection: visit.executionStatus === 'completed' && (!visit.durationMinutes || visit.durationMinutes <= 0),
    }));
}

export async function fetchExecutionList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ActiveExecutionItem[]>> {
  const denied = enforcePermission<ActiveExecutionItem[]>(
    actorRoleKey,
    'assist.execution.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const now = new Date();
  const result = await visitSupabaseRepository.list(tenantId, { dateTo: now.toISOString() });
  if (!result.ok) return result;
  const data = buildDueExecutionItems(result.data, now);
  return { ok: true, data };
}
