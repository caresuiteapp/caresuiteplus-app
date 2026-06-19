import type { RoleKey, ServiceResult } from '@/types';
import type { AssistDashboardStats, AssignmentListItem } from '@/types/modules/assist';
import {
  getDemoAssignmentListItems,
  isAssignmentToday,
  isAssignmentUpcoming,
} from '@/data/demo/assistAssignments';
import { fetchVisitDispositionList } from '@/lib/assist/visitService';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

function buildDashboardStats(items: AssignmentListItem[]): AssistDashboardStats {
  const todayItems = items.filter((item) => isAssignmentToday(item.scheduledStart));

  return {
    totalAssignments: items.length,
    todayCount: todayItems.length,
    activeCount: items.filter((item) => item.status === 'aktiv').length,
    inProgressCount: items.filter((item) => item.status === 'in_bearbeitung').length,
    completedTodayCount: todayItems.filter((item) => item.status === 'abgeschlossen').length,
    upcomingCount: items.filter((item) => isAssignmentUpcoming(item.scheduledStart)).length,
  };
}

export async function fetchAssignmentList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentListItem[]>> {
  const denied = enforcePermission<AssignmentListItem[]>(
    actorRoleKey,
    'assist.assignments.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const visitResult = await fetchVisitDispositionList(tenantId, actorRoleKey);
    if (!visitResult.ok) return visitResult;
    return {
      ok: true,
      data: visitResult.data.map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        title: item.title,
        scheduledStart: item.scheduledStart,
        scheduledEnd: item.scheduledEnd,
        status: item.status,
        location: item.location,
        clientName: item.clientName,
        employeeName: item.employeeName,
        updatedAt: item.updatedAt,
        serviceName: item.serviceName,
        durationMinutes: item.durationMinutes,
        planningStatus: item.planningStatus,
        proofStatus: item.proofStatus,
        billingStatus: item.billingStatus,
        isAtRisk: item.isAtRisk,
        isIncomplete: item.isIncomplete,
      })),
    };
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getDemoAssignmentListItems() };
}

export async function fetchAssistDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistDashboardStats>> {
  const denied = enforcePermission<AssistDashboardStats>(actorRoleKey, 'assist.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 220));
  const listResult = await fetchAssignmentList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  return { ok: true, data: buildDashboardStats(listResult.data) };
}

export async function fetchTodayAssignments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssignmentListItem[]>> {
  const listResult = await fetchAssignmentList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const today = listResult.data
    .filter((item) => isAssignmentToday(item.scheduledStart))
    .sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
    );

  return { ok: true, data: today };
}
