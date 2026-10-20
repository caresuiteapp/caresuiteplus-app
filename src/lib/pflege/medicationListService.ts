import type { RoleKey, ServiceResult } from '@/types';
import type { MedicationListItem } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fetchLiveMedicationList } from './medicationLiveService';

/** Produktive Medikationsliste. Demo-Daten sind in diesem Pfad bewusst ausgeschlossen. */
export async function fetchMedicationList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MedicationListItem[]>> {
  const denied = enforcePermission<MedicationListItem[]>(actorRoleKey, 'pflege.medications.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  return fetchLiveMedicationList(tenantId, actorRoleKey);
}
