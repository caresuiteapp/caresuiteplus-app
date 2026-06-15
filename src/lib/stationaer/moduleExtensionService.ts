import type { RoleKey, ServiceResult } from '@/types';
import type {
  HandoverReportListItem,
  LivingAreaListItem,
  StationaerModuleSettings,
  StationaerReportStats,
  LivingAreaDetail,
  HandoverDetail,
} from '@/types/modules/stationaer';
import {
  countHandoversThisWeek,
  getDemoHandoverReports,
  getDemoLivingAreas,
  getDemoLivingAreaDetail,
  getDemoHandoverDetail,
} from '@/data/demo/stationaerExtended';
import { getDemoResidentListItems } from '@/data/demo/residents';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { stationaerExtensionSupabaseRepository } from '@/lib/services/repositories/stationaerExtensionRepository.supabase';

let stationaerSettingsStore: StationaerModuleSettings = {
  occupancyAlerts: true,
  mealPlanningEnabled: true,
  activityPlanningEnabled: true,
  relativeCommunication: true,
  handoverRequired: true,
  riskDocumentation: true,
};

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function rejectLiveTenant<T>(tenantId: string): ServiceResult<T> | null {
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };
  }
  return null;
}

export async function fetchLivingAreas(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LivingAreaListItem[]>> {
  const denied = enforcePermission<LivingAreaListItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return stationaerExtensionSupabaseRepository.listLivingAreasMapped(tenantId);
  }

  const live = rejectLiveTenant<LivingAreaListItem[]>(tenantId);
  if (live) return live;

  await demoDelay();
  return { ok: true, data: getDemoLivingAreas() };
}

export async function fetchLivingAreaDetail(
  areaId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LivingAreaDetail>> {
  const denied = enforcePermission<LivingAreaDetail>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return stationaerExtensionSupabaseRepository.getLivingAreaDetailMapped(tenantId, areaId);
  }

  const live = rejectLiveTenant<LivingAreaDetail>(tenantId);
  if (live) return live;

  await demoDelay();
  const detail = getDemoLivingAreaDetail(areaId);
  if (!detail) return { ok: false, error: 'Wohnbereich nicht gefunden.' };
  return { ok: true, data: detail };
}

export async function fetchHandoverReports(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<HandoverReportListItem[]>> {
  const denied = enforcePermission<HandoverReportListItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return stationaerExtensionSupabaseRepository.listHandoversMapped(tenantId);
  }

  const live = rejectLiveTenant<HandoverReportListItem[]>(tenantId);
  if (live) return live;

  await demoDelay();
  return { ok: true, data: getDemoHandoverReports() };
}

export async function fetchHandoverDetail(
  handoverId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<HandoverDetail>> {
  const denied = enforcePermission<HandoverDetail>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return stationaerExtensionSupabaseRepository.getHandoverDetailMapped(tenantId, handoverId);
  }

  const live = rejectLiveTenant<HandoverDetail>(tenantId);
  if (live) return live;

  await demoDelay();
  const detail = getDemoHandoverDetail(handoverId);
  if (!detail) return { ok: false, error: 'Übergabebericht nicht gefunden.' };
  return { ok: true, data: detail };
}

export async function fetchStationaerModuleSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerModuleSettings>> {
  const denied = enforcePermission<StationaerModuleSettings>(actorRoleKey, 'stationaer.access');
  if (denied) return denied;
  const live = rejectLiveTenant<StationaerModuleSettings>(tenantId);
  if (live) return live;

  await demoDelay(180);
  return { ok: true, data: { ...stationaerSettingsStore } };
}

export async function updateStationaerModuleSettings(
  tenantId: string,
  patch: Partial<StationaerModuleSettings>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerModuleSettings>> {
  const denied = enforcePermission<StationaerModuleSettings>(actorRoleKey, 'stationaer.access');
  if (denied) return denied;
  const live = rejectLiveTenant<StationaerModuleSettings>(tenantId);
  if (live) return live;

  stationaerSettingsStore = { ...stationaerSettingsStore, ...patch };
  await demoDelay(120);
  return { ok: true, data: { ...stationaerSettingsStore } };
}

export async function fetchStationaerReportStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerReportStats>> {
  const denied = enforcePermission<StationaerReportStats>(actorRoleKey, 'stationaer.access');
  if (denied) return denied;
  const live = rejectLiveTenant<StationaerReportStats>(tenantId);
  if (live) return live;

  const residents = getDemoResidentListItems();
  const active = residents.filter((r) => r.status === 'aktiv').length;
  const totalBeds = getDemoLivingAreas().reduce((sum, a) => sum + a.capacity, 0);
  const occupied = getDemoLivingAreas().reduce((sum, a) => sum + a.occupiedBeds, 0);

  await demoDelay();
  return {
    ok: true,
    data: {
      occupancyPercent: totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0,
      activeResidents: active,
      handoversThisWeek: countHandoversThisWeek(),
      openRisks: 3,
      newAdmissionsMonth: residents.filter((r) => {
        const monthStart = new Date();
        monthStart.setDate(1);
        return new Date(r.admissionDate).getTime() >= monthStart.getTime();
      }).length,
    },
  };
}
