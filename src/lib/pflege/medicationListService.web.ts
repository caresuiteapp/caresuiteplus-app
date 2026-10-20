import type { RoleKey, ServiceResult } from '@/types';
import type { MedicationListItem } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { decodeMedicationListNative } from './medicationListNative.web';

const MEDICATION_SELECT = [
  'id', 'tenant_id', 'client_id', 'name', 'active_ingredient', 'strength', 'form',
  'dosage', 'schedule', 'status', 'is_prn', 'prescribed_by', 'start_date', 'end_date',
  'morning_dose', 'noon_dose', 'evening_dose', 'night_dose', 'prn_reason', 'indication',
  'notes', 'interaction_notes', 'side_effect_notes', 'storage_notes', 'updated_at',
  'route', 'is_high_alert', 'is_controlled_substance', 'intensive_care_relevant',
  'infusion_rate', 'dilution', 'pump_required',
  'clients!medications_client_id_fkey(first_name,last_name,full_name,allergies)',
].join(',');

/** Same Web list read and exported contract; validates only the entire returned native pool, without synthesizing status, flags or a version. */
export async function fetchMedicationList(tenantId: string, actorRoleKey?: RoleKey | null): Promise<ServiceResult<MedicationListItem[]>> {
  const denied = enforcePermission<MedicationListItem[]>(actorRoleKey, 'pflege.medications.view') ?? guardServiceTenant(tenantId);
  if (denied) return denied;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Die produktive Medikationsdatenbank ist nicht verbunden.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die produktive Medikationsdatenbank ist nicht verbunden.' };
  try {
    const { data, error } = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client, 'medications')
      .select(MEDICATION_SELECT).eq('tenant_id', tenantId).order('updated_at', { ascending: false })), 'Medikationsplan');
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: decodeMedicationListNative(data, tenantId) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Medikationsplan konnte nicht geladen werden.' }; }
}
