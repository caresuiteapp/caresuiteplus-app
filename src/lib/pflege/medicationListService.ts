import type { RoleKey, ServiceResult } from '@/types';
import { getDemoMedicationListItems, type MedicationListItem } from '@/data/demo/medications';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** WP374 — Medikationsliste (Demo / preparedOnly) */
export async function fetchMedicationList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MedicationListItem[]>> {
  const denied = enforcePermission<MedicationListItem[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    // Demo-funktional fallback until client_medications live repo ships
  }

  await demoDelay();
  return { ok: true, data: getDemoMedicationListItems() };
}
