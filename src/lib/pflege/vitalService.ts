import type { RoleKey, ServiceResult } from '@/types';
import type { VitalReadingListItem, VitalReadingType } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  vitalSignSupabaseRepository,
  type VitalClientConfiguration,
  type RecordVitalMeasurementInput,
} from '@/lib/services/repositories/vitalSignRepository.supabase';

export async function fetchVitalReadings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalReadingListItem[]>> {
  const denied = enforcePermission<VitalReadingListItem[]>(actorRoleKey, 'pflege.vitals.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return vitalSignSupabaseRepository.listMapped(tenantId);
}

export async function fetchDueVitalReadings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalReadingListItem[]>> {
  const result = await fetchVitalReadings(tenantId, actorRoleKey);
  if (!result.ok) return result;
  return { ok: true, data: result.data.filter((reading) => reading.isDue || reading.isAlert) };
}

export async function fetchClientVitalConfiguration(
  tenantId: string,
  clientId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalClientConfiguration[]>> {
  const denied = enforcePermission<VitalClientConfiguration[]>(actorRoleKey, 'pflege.vitals.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return vitalSignSupabaseRepository.getClientConfiguration(clientId);
}

export async function setClientVitalConfiguration(
  tenantId: string,
  clientId: string,
  type: VitalReadingType,
  enabled: boolean,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalClientConfiguration>> {
  const denied = enforcePermission<VitalClientConfiguration>(actorRoleKey, 'pflege.vitals.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return vitalSignSupabaseRepository.setClientConfiguration(clientId, type, enabled);
}

export async function createVitalReading(
  tenantId: string,
  input: RecordVitalMeasurementInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalReadingListItem>> {
  const denied = enforcePermission<VitalReadingListItem>(actorRoleKey, 'pflege.vitals.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!input.clientId || !input.type || (Object.keys(input.values ?? {}).length === 0 && !input.value?.trim())) {
    return { ok: false, error: 'Klient:in, Messart und Messwert sind erforderlich.' };
  }
  return vitalSignSupabaseRepository.create(input);
}
