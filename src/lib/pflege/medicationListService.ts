import type { RoleKey, ServiceResult } from '@/types';
import type { MedicationListItem } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);

async function names(tenantId: string, ids: string[]): Promise<Map<string, string>> {
  const supabase = getSupabaseClient()!;
  if (!ids.length) return new Map();
  const { data } = await fromUnknownTable(supabase, 'clients').select('id,first_name,last_name')
    .eq('tenant_id', tenantId).in('id', [...new Set(ids)]);
  return new Map(((data ?? []) as Row[]).map((r) => [text(r.id), `${text(r.first_name)} ${text(r.last_name)}`.trim()]));
}

export async function fetchMedicationList(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<MedicationListItem[]>> {
  const denied = enforcePermission<MedicationListItem[]>(role, 'pflege.medications.view');
  if (denied) return denied;
  const tenant = guardServiceTenant(tenantId); if (tenant) return tenant;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Medikation ist ausschließlich live verfügbar.' };
  const supabase = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(supabase, 'clinical_medication_orders').select('*')
    .eq('tenant_id', tenantId).neq('status', 'archived').order('updated_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[]; const clientNames = await names(tenantId, rows.map((r) => text(r.client_id)));
  return { ok: true, data: rows.map((r) => ({
    id: text(r.id), tenantId: text(r.tenant_id), clientId: text(r.client_id),
    clientName: clientNames.get(text(r.client_id)) ?? '—', medicationName: text(r.medication_name),
    dosage: text(r.dosage), schedule: Object.values((r.schedule ?? {}) as Record<string, unknown>).join('-') || 'Individuell',
    route: text(r.route), status: text(r.status) === 'active' ? 'aktiv' : text(r.status) === 'completed' ? 'abgeschlossen' : 'in_bearbeitung',
    prescribedBy: text(r.prescribing_physician), updatedAt: text(r.updated_at),
  })) };
}

export async function createMedicationOrder(tenantId: string, clientId: string, payload: Record<string, unknown>, role?: RoleKey | null): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.medications.manage'); if (denied) return denied;
  const tenant = guardServiceTenant(tenantId); if (tenant) return tenant;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Medikation ist ausschließlich live verfügbar.' };
  const supabase = getSupabaseClient()! as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }> };
  const { data, error } = await supabase.rpc('create_clinical_medication_order', { p_client_id: clientId, p_payload: payload });
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  const id = text(data.id); const list = await fetchMedicationList(tenantId, role);
  return list.ok && list.data.some((x) => x.id === id) ? { ok: true, data: { id } } : { ok: false, error: 'Medikationsverordnung wurde nicht zurückgelesen.' };
}
