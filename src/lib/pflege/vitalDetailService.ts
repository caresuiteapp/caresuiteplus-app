import type { RoleKey, ServiceResult } from '@/types';
import type { VitalReadingListItem } from '@/types/modules/pflege';
import { getDemoVitalReadings } from '@/data/demo/vitalReadings';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { vitalSignSupabaseRepository } from '@/lib/services/repositories/vitalSignRepository.supabase';

export async function fetchVitalReadingDetail(
  readingId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalReadingListItem>> {
  const denied = enforcePermission<VitalReadingListItem>(actorRoleKey, 'pflege.vitals.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return vitalSignSupabaseRepository.getDetailMapped(readingId, tenantId);
  }

  await new Promise((r) => setTimeout(r, 200));

  const reading = getDemoVitalReadings().find((r) => r.id === readingId);
  if (!reading) {
    return { ok: false, error: 'Vitalwert-Messung nicht gefunden.' };
  }

  return { ok: true, data: reading };
}
