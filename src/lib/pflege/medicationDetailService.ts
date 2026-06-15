import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getDemoMedicationDetail, type MedicationDetail } from './medicationDetailStats';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** WP378 — Medikationsdetail (Demo / preparedOnly) */
export async function fetchMedicationDetail(
  medicationId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MedicationDetail>> {
  const denied = enforcePermission<MedicationDetail>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    // Demo-funktional fallback
  }

  await demoDelay();
  const detail = getDemoMedicationDetail(medicationId);
  if (!detail) {
    return { ok: false, error: 'Verordnung nicht gefunden.' };
  }
  return { ok: true, data: detail };
}
