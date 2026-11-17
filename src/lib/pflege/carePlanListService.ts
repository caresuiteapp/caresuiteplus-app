import type { RoleKey, ServiceResult } from '@/types';
import type { CarePlanListItem } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import type { PermissionEnforcementContext } from '@/lib/permissions/enforce';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { carePlanLiveRepository, type LiveCarePlanInput } from './carePlanRepository.supabase';

export async function fetchCarePlanList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  permissions?: PermissionEnforcementContext,
  clientId?: string,
): Promise<ServiceResult<CarePlanListItem[]>> {
  const denied = enforcePermission<CarePlanListItem[]>(actorRoleKey, 'pflege.plans.view', permissions);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Pflegeplanung erfordert die Live-Datenbank.' };
  }
  return carePlanLiveRepository.list(tenantId, clientId);
}

export async function fetchActiveCarePlans(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanListItem[]>> {
  const result = await fetchCarePlanList(tenantId, actorRoleKey);
  if (!result.ok) return result;
  return { ok: true, data: result.data.filter((item) => item.status === 'aktiv') };
}

export async function fetchCarePlanAssessmentSources(
  tenantId: string, clientId: string, actorRoleKey?: RoleKey | null, permissions?: PermissionEnforcementContext,
): ReturnType<typeof carePlanLiveRepository.listAssessmentSources> {
  const denied = enforcePermission<{ id: string; version: number; approvedAt: string }[]>(actorRoleKey, 'pflege.plans.view', permissions);
  return denied ?? guardServiceTenant(tenantId) ?? carePlanLiveRepository.listAssessmentSources(tenantId, clientId);
}

export async function createCarePlan(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  input: Omit<LiveCarePlanInput, 'id'>,
  permissions?: PermissionEnforcementContext,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.manage', permissions);
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
  permissions?: PermissionEnforcementContext,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.manage', permissions);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Pflegeplan kann ausschließlich live fortgeschrieben werden.' };
  }
  return carePlanLiveRepository.save(tenantId, input);
}
