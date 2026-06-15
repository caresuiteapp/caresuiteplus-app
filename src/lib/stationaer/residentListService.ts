import type { RoleKey, ServiceResult } from '@/types';
import type { ResidentListItem, StationaerDashboardStats } from '@/types/modules/stationaer';
import {
  getDemoResidentListItems,
  isNewAdmission,
  isResidentActive,
} from '@/data/demo/residents';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { stationaerSupabaseRepository } from '@/lib/services/repositories/stationaerRepository.supabase';

const TOTAL_ROOMS = 6;

function buildDashboardStats(items: ResidentListItem[]): StationaerDashboardStats {
  const activeResidents = items.filter((item) => isResidentActive(item.status));

  return {
    totalResidents: items.length,
    activeCount: activeResidents.length,
    newAdmissionsCount: items.filter((item) => isNewAdmission(item.admissionDate)).length,
    occupancyPercent: Math.round((activeResidents.length / TOTAL_ROOMS) * 100),
    handoverPendingCount: items.filter((item) => item.status === 'in_bearbeitung').length,
  };
}

export async function fetchResidentList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ResidentListItem[]>> {
  const denied = enforcePermission<ResidentListItem[]>(
    actorRoleKey,
    'stationaer.residents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return stationaerSupabaseRepository.listMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getDemoResidentListItems() };
}

export async function fetchStationaerDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<StationaerDashboardStats>> {
  const denied = enforcePermission<StationaerDashboardStats>(
    actorRoleKey,
    'stationaer.access',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 220));
  const listResult = await fetchResidentList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  return { ok: true, data: buildDashboardStats(listResult.data) };
}

export async function fetchActiveResidents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ResidentListItem[]>> {
  const listResult = await fetchResidentList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const active = listResult.data
    .filter((item) => isResidentActive(item.status))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
    .slice(0, 4);

  return { ok: true, data: active };
}
