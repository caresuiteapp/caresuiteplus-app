import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import type { MedicationDetail } from '@/types/modules/pflege';
import { fetchLiveMedicationDetail } from './medicationLiveService';

/** Produktives Medikationsdetail inklusive tatsächlicher Gaben und Abweichungen. */
export async function fetchMedicationDetail(
  medicationId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MedicationDetail>> {
  const denied = enforcePermission<MedicationDetail>(actorRoleKey, 'pflege.medications.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return fetchLiveMedicationDetail(medicationId, tenantId, actorRoleKey);
}
