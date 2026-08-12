import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { MedicationDetail } from './medicationDetailStats';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);

export async function fetchMedicationDetail(
  medicationId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MedicationDetail>> {
  const denied = enforcePermission<MedicationDetail>(actorRoleKey, 'pflege.medications.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { data, error } = await fromUnknownTable(supabase, 'clinical_medication_orders')
    .select('*').eq('tenant_id', tenantId).eq('id', medicationId).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: false, error: 'Verordnung nicht gefunden.' };
  const row = data as Row;
  const { data: client } = await fromUnknownTable(supabase, 'clients')
    .select('first_name,last_name').eq('tenant_id', tenantId).eq('id', text(row.client_id)).maybeSingle();
  const clientRow = (client ?? {}) as Row;
  const schedule = row.schedule && typeof row.schedule === 'object'
    ? Object.values(row.schedule as Record<string, unknown>).join(' · ')
    : '';
  const { data: administrations } = await fromUnknownTable(supabase, 'clinical_medication_administrations')
    .select('administered_at').eq('tenant_id', tenantId).eq('medication_order_id', medicationId)
    .order('administered_at', { ascending: false }).limit(1);
  const latest = ((administrations ?? []) as Row[])[0];
  return { ok: true, data: {
    id: text(row.id), tenantId, clientId: text(row.client_id),
    clientName: `${text(clientRow.first_name)} ${text(clientRow.last_name)}`.trim() || '—',
    medicationName: text(row.medication_name), dosage: text(row.dosage), schedule: schedule || 'Individuell',
    route: text(row.route), status: text(row.status) === 'active' ? 'aktiv' : 'in_bearbeitung',
    prescribedBy: text(row.prescribing_physician), updatedAt: text(row.updated_at),
    instructions: text(row.instructions), interactions: text(row.interaction_notes).split('\n').filter(Boolean),
    lastAdministeredAt: latest ? text(latest.administered_at) : null,
    empSyncStatus: 'prepared', notes: text(row.indication),
  } };
}
