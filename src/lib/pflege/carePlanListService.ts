import type { RoleKey, ServiceResult } from '@/types';
import type { CarePlanListItem, PflegeDashboardStats } from '@/types/modules/pflege';
import { emptyPflegeDashboardStats } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { carePlanLiveRepository, type LiveCarePlanInput } from './carePlanRepository.supabase';

export async function fetchCarePlanList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanListItem[]>> {
  const denied = enforcePermission<CarePlanListItem[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Pflegeplanung erfordert die Live-Datenbank.' };
  }
  return carePlanLiveRepository.list(tenantId);
}

export async function fetchPflegeDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PflegeDashboardStats>> {
  const denied = enforcePermission<PflegeDashboardStats>(actorRoleKey, 'pflege.access');
  if (denied) return denied;
  const listResult = await fetchCarePlanList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;
  const now = Date.now();
  const active = listResult.data.filter((item) => item.status === 'aktiv');
  return {
    ok: true,
    data: {
      ...emptyPflegeDashboardStats(),
      totalPlans: listResult.data.length,
      activePlansCount: active.length,
      assignedClientsCount: new Set(active.map((item) => item.clientId)).size,
      dueMeasuresCount: listResult.data.reduce((sum, item) => sum + item.alertCount, 0),
      openReportsCount: listResult.data.filter((item) => item.status === 'entwurf').length,
      alertsCount: listResult.data.reduce((sum, item) => sum + item.alertCount, 0),
      openSisAssessmentCount: listResult.data.filter((item) =>
        item.validUntil ? Date.parse(item.validUntil) <= now : false,
      ).length,
    },
  };
}

export async function fetchActiveCarePlans(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanListItem[]>> {
  const result = await fetchCarePlanList(tenantId, actorRoleKey);
  if (!result.ok) return result;
  return { ok: true, data: result.data.filter((item) => item.status === 'aktiv') };
}

export async function createCarePlan(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  input: Omit<LiveCarePlanInput, 'id'>,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.manage');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!input.clientId || !input.title.trim() || !input.validFrom) {
    return { ok: false, error: 'Klient:in, Bezeichnung und Gültig-ab sind erforderlich.' };
  }
  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Pflegeplan kann ausschließlich live angelegt werden.' };
  }
  return carePlanLiveRepository.save(tenantId, input);
}

export async function updateCarePlan(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  input: LiveCarePlanInput & { id: string },
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.manage');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Pflegeplan kann ausschließlich live fortgeschrieben werden.' };
  }
  return carePlanLiveRepository.save(tenantId, input);
}
