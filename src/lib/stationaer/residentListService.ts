import type { RoleKey, ServiceResult } from '@/types';
import {
  emptyStationaerDashboardStats,
  type ResidentListItem,
  type StationaerDashboardStats,
} from '@/types/modules/stationaer';
import { getDemoResidentListItems } from '@/data/demo/residents';
import { getDemoHandoverReports, getDemoLivingAreas } from '@/data/demo/stationaerExtended';
import {
  getDemoDailyStructure,
  getDemoMealPlans,
  getDemoResidentPlanning,
} from '@/data/demo/stationaerPlanning';
import { isNewAdmission, isResidentActive } from './residentUtils';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { stationaerSupabaseRepository } from '@/lib/services/repositories/stationaerRepository.supabase';
import { isMissingTableServiceError } from '@/lib/supabase/errors';
import {
  resolveMissingTableList,
  type PreviewAwareResult,
} from '@/lib/supabase/missingtablefallback';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isToday(iso: string): boolean {
  return new Date(iso).getTime() >= startOfToday().getTime();
}

function isThisWeek(iso: string): boolean {
  const weekAgo = Date.now() - 7 * 86_400_000;
  return new Date(iso).getTime() >= weekAgo;
}

function buildDashboardStats(
  items: ResidentListItem[],
  useDemoEnrichment: boolean,
): StationaerDashboardStats {
  const activeResidents = items.filter((item) => isResidentActive(item.status));
  const admissionsToday = items.filter((item) => isToday(item.admissionDate)).length;
  const admissionsThisWeek = items.filter((item) => isThisWeek(item.admissionDate)).length;
  const dischargesToday = items.filter(
    (item) => item.status === 'archiviert' && isToday(item.updatedAt),
  ).length;
  const dischargesThisWeek = items.filter(
    (item) => item.status === 'archiviert' && isThisWeek(item.updatedAt),
  ).length;
  const inProgressResidents = items.filter((item) => item.status === 'in_bearbeitung').length;

  let totalBeds = 0;
  let freeBeds = 0;
  let activeLivingAreas = 0;
  let openRoomAssignments = 0;
  let openDailyStructureCount = 0;
  let openMealPlanningCount = 0;
  let openHandoverReportsCount = 0;
  let openResidentPlanningCount = 0;
  let roomConflictCount = 0;

  if (useDemoEnrichment) {
    const areas = getDemoLivingAreas();
    totalBeds = areas.reduce((sum, area) => sum + area.capacity, 0);
    freeBeds = areas.reduce((sum, area) => sum + area.freeBeds, 0);
    activeLivingAreas = areas.filter((area) => area.status === 'aktiv').length;
    openRoomAssignments = areas.filter((area) => area.status === 'in_bearbeitung').length;
    roomConflictCount = areas.filter((area) => area.occupiedBeds > area.capacity).length;

    openDailyStructureCount = getDemoDailyStructure().filter(
      (item) => item.status === 'in_bearbeitung' || item.status === 'entwurf',
    ).length;
    openMealPlanningCount = getDemoMealPlans().filter(
      (item) => item.status === 'in_bearbeitung' || item.status === 'entwurf',
    ).length;
    openHandoverReportsCount = getDemoHandoverReports().filter(
      (item) => item.status === 'aktiv' || item.status === 'in_bearbeitung',
    ).length;
    openResidentPlanningCount = getDemoResidentPlanning().filter(
      (item) => item.status === 'in_bearbeitung' || item.status === 'entwurf',
    ).length;
  }

  const occupiedBeds = totalBeds > 0 ? totalBeds - freeBeds : activeResidents.length;
  const occupancyPercent =
    totalBeds > 0
      ? Math.round((occupiedBeds / totalBeds) * 100)
      : activeResidents.length > 0
        ? 100
        : 0;

  const alertsCount =
    inProgressResidents +
    openRoomAssignments +
    roomConflictCount +
    openHandoverReportsCount +
    openResidentPlanningCount;

  return {
    totalResidents: items.length,
    activeCount: activeResidents.length,
    newAdmissionsCount: items.filter((item) => isNewAdmission(item.admissionDate)).length,
    occupancyPercent,
    handoverPendingCount: inProgressResidents,
    freeBeds,
    totalBeds,
    admissionsToday,
    admissionsThisWeek,
    dischargesToday,
    dischargesThisWeek,
    openRoomAssignments,
    activeLivingAreas,
    openDailyStructureCount,
    openMealPlanningCount,
    openHandoversCount: inProgressResidents,
    openHandoverReportsCount,
    alertsCount,
    openResidentPlanningCount,
    roomConflictCount,
  };
}

type ResidentListLoadResult =
  | { ok: true; data: ResidentListItem[]; usedDemoFallback?: boolean; tableMissing?: boolean }
  | { ok: false; error: string };

async function loadResidentList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ResidentListLoadResult> {
  const denied = enforcePermission<ResidentListItem[]>(
    actorRoleKey,
    'stationaer.residents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await stationaerSupabaseRepository.listMapped(tenantId);
    if (!result.ok && isMissingTableServiceError(result.error)) {
      return resolveMissingTableList(result, tenantId, getDemoResidentListItems);
    }
    if (result.ok && result.tableMissing) {
      const resolved = resolveMissingTableList(result, tenantId, getDemoResidentListItems);
      if (!resolved.ok) return resolved;
      return {
        ok: true,
        data: resolved.data,
        usedDemoFallback: resolved.usedDemoFallback,
        tableMissing: !resolved.usedDemoFallback,
      };
    }
    if (!result.ok) return result;
    return { ok: true, data: result.data, usedDemoFallback: false };
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getDemoResidentListItems(), usedDemoFallback: true };
}

export async function fetchResidentList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ResidentListItem[]>> {
  const result = await loadResidentList(tenantId, actorRoleKey);
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

export async function fetchStationaerDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<StationaerDashboardStats>> {
  const denied = enforcePermission<StationaerDashboardStats>(
    actorRoleKey,
    'stationaer.access',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 220));
  const listResult = await loadResidentList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const useDemoEnrichment =
    getServiceMode() !== 'supabase' || listResult.usedDemoFallback === true;

  if (getServiceMode() === 'supabase' && !listResult.usedDemoFallback) {
    const base = buildDashboardStats(listResult.data, false);
    return {
      ok: true,
      data: {
        ...emptyStationaerDashboardStats(),
        totalResidents: base.totalResidents,
        activeCount: base.activeCount,
        newAdmissionsCount: base.newAdmissionsCount,
        admissionsToday: base.admissionsToday,
        admissionsThisWeek: base.admissionsThisWeek,
        dischargesToday: base.dischargesToday,
        dischargesThisWeek: base.dischargesThisWeek,
        handoverPendingCount: base.handoverPendingCount,
        openHandoversCount: base.openHandoversCount,
      },
      previewData: listResult.tableMissing === true,
      tableMissing: listResult.tableMissing,
    };
  }

  return {
    ok: true,
    data: buildDashboardStats(listResult.data, useDemoEnrichment),
    previewData: listResult.usedDemoFallback || listResult.tableMissing === true,
    tableMissing: listResult.tableMissing,
  };
}

export async function fetchActiveResidents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<ResidentListItem[]>> {
  const listResult = await loadResidentList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const active = listResult.data
    .filter((item) => isResidentActive(item.status))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
    .slice(0, 4);

  return {
    ok: true,
    data: active,
    previewData: listResult.usedDemoFallback || listResult.tableMissing === true,
    tableMissing: listResult.tableMissing,
  };
}
