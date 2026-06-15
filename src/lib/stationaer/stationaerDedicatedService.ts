import type { RoleKey, ServiceResult } from '@/types';
import {
  getDemoActivityPlans,
  getDemoDailyStructure,
  getDemoMealPlans,
  getDemoResidentPlanning,
  type ActivityPlanItem,
  type DailyStructureItem,
  type MealPlanItem,
  type ResidentPlanningItem,
} from '@/data/demo/stationaerPlanning';
import { getDemoLivingAreas } from '@/data/demo/stationaerExtended';
import { getDemoResidentListItems } from '@/data/demo/residents';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function guardDemo(tenantId: string) {
  if (tenantId !== DEMO_TENANT_ID) return { ok: false as const, error: 'Kein Zugriff auf diesen Mandanten.' };
  return null;
}

export async function fetchDailyStructure(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DailyStructureItem[]>> {
  const denied = enforcePermission<DailyStructureItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoDailyStructure() };
}

export async function fetchMealPlans(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MealPlanItem[]>> {
  const denied = enforcePermission<MealPlanItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoMealPlans() };
}

export async function fetchActivityPlans(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ActivityPlanItem[]>> {
  const denied = enforcePermission<ActivityPlanItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoActivityPlans() };
}

export async function fetchResidentPlanning(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ResidentPlanningItem[]>> {
  const denied = enforcePermission<ResidentPlanningItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoResidentPlanning() };
}

export type RoomListItem = {
  id: string;
  roomNumber: string;
  wing: string;
  capacity: number;
  occupiedBeds: number;
  status: string;
};

export type OccupancyListItem = {
  id: string;
  wing: string;
  totalBeds: number;
  occupiedBeds: number;
  occupancyPercent: number;
  status: string;
};

export type StationaerRiskItem = {
  id: string;
  residentName: string;
  riskType: string;
  severity: string;
  lastReviewAt: string;
  status: string;
};

export async function fetchRoomList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RoomListItem[]>> {
  const denied = enforcePermission<RoomListItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return {
    ok: true,
    data: getDemoLivingAreas().map((area) => ({
      id: area.id,
      roomNumber: area.name.split('·')[0]?.trim() ?? area.name,
      wing: area.wing ?? '—',
      capacity: area.capacity,
      occupiedBeds: area.occupiedBeds,
      status: area.status,
    })),
  };
}

export async function fetchOccupancyList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OccupancyListItem[]>> {
  const denied = enforcePermission<OccupancyListItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  const wings = [...new Set(getDemoLivingAreas().map((a) => a.wing))];
  return {
    ok: true,
    data: wings.map((wing) => {
      const areas = getDemoLivingAreas().filter((a) => a.wing === wing);
      const totalBeds = areas.reduce((sum, a) => sum + a.capacity, 0);
      const occupiedBeds = areas.reduce((sum, a) => sum + a.occupiedBeds, 0);
      return {
        id: `occ-${wing ?? 'unknown'}`,
        wing: wing ?? '—',
        totalBeds,
        occupiedBeds,
        occupancyPercent: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        status: occupiedBeds >= totalBeds ? 'in_bearbeitung' : 'aktiv',
      };
    }),
  };
}

export async function fetchStationaerRisksList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerRiskItem[]>> {
  const denied = enforcePermission<StationaerRiskItem[]>(actorRoleKey, 'stationaer.residents.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  const riskTypes = ['Sturz', 'Dekubitus', 'Wandern', 'Ernährung', 'Medikation'];
  return {
    ok: true,
    data: getDemoResidentListItems().slice(0, 12).map((resident, index) => ({
      id: `risk-${index + 1}`,
      residentName: `${resident.firstName} ${resident.lastName}`,
      riskType: riskTypes[index % riskTypes.length]!,
      severity: index % 3 === 0 ? 'hoch' : index % 3 === 1 ? 'mittel' : 'niedrig',
      lastReviewAt: new Date(Date.now() - index * 86400000 * 3).toISOString(),
      status: index % 4 === 0 ? 'in_bearbeitung' : 'aktiv',
    })),
  };
}
