import type { RoleKey, ServiceResult } from '@/types';
import type { ResidentDetail } from '@/types/modules/stationaer';
import { getDemoResidentById, getRoomLabel } from '@/data/demo/residents';
import { canUseDemoFallback } from '@/lib/environment';
import { enforcePermission } from '@/lib/permissions';
import { CLIENT_STATUS_HINTS } from '@/lib/services';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { stationaerSupabaseRepository } from '@/lib/services/repositories/stationaerRepository.supabase';
import { isTableMissingResult } from '@/lib/supabase/missingtablefallback';

function enrichResident(
  seed: NonNullable<ReturnType<typeof getDemoResidentById>>,
): ResidentDetail {
  return {
    ...seed,
    roomName: getRoomLabel(seed.roomId),
    nextActionHint: CLIENT_STATUS_HINTS[seed.status],
  };
}

export async function fetchResidentDetail(
  residentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ResidentDetail>> {
  const denied = enforcePermission<ResidentDetail>(
    actorRoleKey,
    'stationaer.residents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await stationaerSupabaseRepository.getDetailMapped(residentId, tenantId);
    if (isTableMissingResult(result) && canUseDemoFallback(tenantId)) {
      await new Promise((r) => setTimeout(r, 200));
      const seed = getDemoResidentById(residentId);
      if (!seed) {
        return { ok: false, error: 'Bewohner:in nicht gefunden.' };
      }
      return { ok: true, data: enrichResident(seed), usedDemoFallback: true };
    }
    return result;
  }

  await new Promise((r) => setTimeout(r, 240));

  const seed = getDemoResidentById(residentId);
  if (!seed) {
    return { ok: false, error: 'Bewohner:in nicht gefunden.' };
  }

  return { ok: true, data: enrichResident(seed) };
}
