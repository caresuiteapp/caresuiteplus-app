import type { RoleKey, ServiceResult } from '@/types';
import type { VitalReadingListItem } from '@/types/modules/pflege';
import { getDemoVitalReadings, createDemoVitalReading } from '@/data/demo/vitalReadings';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { vitalSignSupabaseRepository } from '@/lib/services/repositories/vitalSignRepository.supabase';

export async function fetchVitalReadings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalReadingListItem[]>> {
  const denied = enforcePermission<VitalReadingListItem[]>(actorRoleKey, 'pflege.vitals.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return vitalSignSupabaseRepository.listMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 240));

  const readings = getDemoVitalReadings().sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  );

  return { ok: true, data: readings };
}

export async function fetchDueVitalReadings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalReadingListItem[]>> {
  const result = await fetchVitalReadings(tenantId, actorRoleKey);
  if (!result.ok) return result;

  const due = result.data.filter((reading) => reading.isDue || reading.isAlert);
  return { ok: true, data: due };
}

export async function createVitalReading(
  tenantId: string,
  input: {
    clientId: string;
    type: 'blood_pressure' | 'pulse' | 'temperature' | 'weight' | 'oxygen';
    value: string;
    carePlanId?: string;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalReadingListItem>> {
  const denied = enforcePermission<VitalReadingListItem>(actorRoleKey, 'pflege.vitals.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 180));
  const reading = createDemoVitalReading(input);
  return { ok: true, data: reading };
}
