import type { RoleKey, ServiceResult } from '@/types';
import type { CarePlanDetail } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { carePlanLiveRepository } from './carePlanRepository.supabase';

export async function fetchCarePlanDetail(
  planId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanDetail>> {
  const denied = enforcePermission<CarePlanDetail>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() !== 'supabase') {
    return { ok: false, error: 'Pflegeplandetails erfordern die Live-Datenbank.' };
  }
  const result = await carePlanLiveRepository.get(tenantId, planId);
  if (!result.ok) return result;
  if (!result.data) return { ok: false, error: 'Pflegeplan nicht gefunden.' };
  return { ok: true, data: result.data };
}
