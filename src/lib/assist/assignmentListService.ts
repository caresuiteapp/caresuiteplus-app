import type { RoleKey, ServiceResult } from '@/types';
import type { AssistDashboardStats, AssignmentListItem } from '@/types/modules/assist';
import {
  getDemoAssignmentListItems,
  getDemoAssignmentSeeds,
  isAssignmentToday,
  isAssignmentUpcoming,
} from '@/data/demo/assistAssignments';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { fetchVisitDispositionList } from '@/lib/assist/visitService';
import { fetchTripLogList } from '@/lib/assist/tripLogService';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isSupabaseConfigured } from '@/lib/supabase/config';

function isOpenProofStatus(proofStatus?: string | null): boolean {
  return proofStatus === 'pending' || proofStatus === 'none';
}

function resolveAtRisk(item: AssignmentListItem): boolean {
  return item.isAtRisk ?? item.status === 'fehlerhaft';
}

function resolveIncomplete(item: AssignmentListItem): boolean {
  return item.isIncomplete ?? item.status === 'in_bearbeitung';
}

function isOpenProofReviewStatus(proofStatus?: string | null): boolean {
  return proofStatus === 'signed' || proofStatus === 'pending';
}

function isOpenPortalReleaseStatus(proofStatus?: string | null): boolean {
  return proofStatus === 'verified';
}

function buildDashboardStats(
  items: AssignmentListItem[],
  openTripsCount = 0,
): AssistDashboardStats {
  const todayItems = items.filter((item) => isAssignmentToday(item.scheduledStart));

  return {
    totalAssignments: items.length,
    todayCount: todayItems.length,
    activeCount: items.filter((item) => item.status === 'aktiv').length,
    inProgressCount: items.filter((item) => item.status === 'in_bearbeitung').length,
    completedTodayCount: todayItems.filter((item) => item.status === 'abgeschlossen').length,
    upcomingCount: items.filter((item) => isAssignmentUpcoming(item.scheduledStart)).length,
    atRiskCount: items.filter((item) => resolveAtRisk(item)).length,
    incompleteCount: items.filter((item) => resolveIncomplete(item)).length,
    openProofCount: items.filter((item) => isOpenProofStatus(item.proofStatus)).length,
    openProofReviewCount: items.filter((item) => isOpenProofReviewStatus(item.proofStatus)).length,
    openSignatureCount: items.filter(
      (item) =>
        isOpenProofStatus(item.proofStatus) &&
        (item.status === 'in_bearbeitung' || item.isIncomplete),
    ).length,
    openPortalReleaseCount: items.filter((item) =>
      isOpenPortalReleaseStatus(item.proofStatus),
    ).length,
    openTripsCount,
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

  let openTripsCount = 0;
  const tripsResult = await fetchTripLogList(tenantId, actorRoleKey);
  if (tripsResult.ok) {
    openTripsCount = tripsResult.data.filter((t) => !t.endedAt).length;
  }

  return { ok: true, data: buildDashboardStats(listResult.data, openTripsCount) };
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

export type FetchClientAssignmentsOptions = {
  userId?: string | null;
  employeeId?: string | null;
};

function dispositionToAssignmentListItem(item: VisitDispositionListItem): AssignmentListItem {
  return {
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
  };
}

function filterDemoAssignmentsForClient(clientId: string): AssignmentListItem[] {
  const assignmentIds = new Set(
    getDemoAssignmentSeeds()
      .filter((seed) => seed.clientId === clientId)
      .map((seed) => seed.id),
  );
  return getDemoAssignmentListItems().filter((item) => assignmentIds.has(item.id));
}

export async function fetchClientAssignments(
  tenantId: string,
  clientId: string,
  actorRoleKey?: RoleKey | null,
  _options?: FetchClientAssignmentsOptions,
): Promise<ServiceResult<AssignmentListItem[]>> {
  const denied = enforcePermission<AssignmentListItem[]>(actorRoleKey, 'office.clients.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!clientId?.trim()) {
    return { ok: false, error: 'Klient:in fehlt.' };
  }

  if (getServiceMode() === 'supabase' && isSupabaseConfigured()) {
    const visitResult = await visitSupabaseRepository.list(tenantId, { clientId });
    if (visitResult.ok) {
      return {
        ok: true,
        data: visitResult.data.map(dispositionToAssignmentListItem),
      };
    }
    return visitResult;
  }

  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: filterDemoAssignmentsForClient(clientId) };
}
