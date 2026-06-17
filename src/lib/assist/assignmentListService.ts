import type { RoleKey, ServiceResult } from '@/types';
import type { AssistDashboardStats, AssignmentListItem } from '@/types/modules/assist';
import {
  getDemoAssignmentListItems,
  isAssignmentToday,
  isAssignmentUpcoming,
} from '@/data/demo/assistAssignments';
import { buildWorkspaceAccessContext, canViewAssignment, filterAssignmentsForActor } from '@/lib/permissions';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { assignmentSupabaseRepository } from '@/lib/assist/repositories/assignmentRepository.supabase';

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
  workspaceContext?: { userId?: string | null; employeeId?: string | null; clientId?: string | null },
): Promise<ServiceResult<AssignmentListItem[]>> {
  const denied = enforcePermission<AssignmentListItem[]>(
    actorRoleKey,
    'assist.assignments.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const remote = await assignmentSupabaseRepository.list(tenantId);
    if (!remote.ok) return remote;
    const ctx = buildWorkspaceAccessContext({
      tenantId,
      roleKey: actorRoleKey ?? null,
      userId: workspaceContext?.userId ?? 'demo-user',
      employeeId: workspaceContext?.employeeId ?? null,
      clientId: workspaceContext?.clientId ?? null,
    });
    return { ok: true, data: filterAssignmentsForActor(remote.data, ctx) };
  }

  await new Promise((r) => setTimeout(r, 260));
  const ctx = buildWorkspaceAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    userId: workspaceContext?.userId ?? 'demo-user',
    employeeId: workspaceContext?.employeeId ?? null,
    clientId: workspaceContext?.clientId ?? null,
  });
  const filtered = filterAssignmentsForActor(getDemoAssignmentListItems(), ctx);
  return { ok: true, data: filtered };
}

export async function fetchAssistDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistDashboardStats>> {
  const denied = enforcePermission<AssistDashboardStats>(actorRoleKey, 'assist.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

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

export async function fetchClientAssignments(
  tenantId: string,
  clientId: string,
  actorRoleKey?: RoleKey | null,
  workspaceContext?: { userId?: string | null; employeeId?: string | null },
): Promise<ServiceResult<AssignmentListItem[]>> {
  const listResult = await fetchAssignmentList(tenantId, actorRoleKey, workspaceContext);
  if (!listResult.ok) return listResult;

  const items = listResult.data
    .filter((item) => item.clientId === clientId)
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  return { ok: true, data: items };
}
