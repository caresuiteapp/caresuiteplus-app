import type { RoleKey, ServiceResult } from '@/types';
import type { VitalReadingListItem } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
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
  return vitalSignSupabaseRepository.getDetailMapped(readingId, tenantId);
}
