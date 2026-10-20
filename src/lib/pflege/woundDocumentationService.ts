import type { RoleKey, ServiceResult } from '@/types';
import type { WoundDocumentation } from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
type Row = Record<string, unknown>; const text = (v: unknown) => v == null ? '' : String(v);

export async function fetchWoundDocumentationList(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<WoundDocumentation[]>> {
  const denied = enforcePermission<WoundDocumentation[]>(role, 'pflege.wounds.view'); if (denied) return denied;
  const tenant = guardServiceTenant(tenantId); if (tenant) return tenant;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Wunddokumentation ist ausschließlich live verfügbar.' };
  const supabase = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(supabase, 'clinical_wound_cases').select('*').eq('tenant_id', tenantId).neq('status', 'archived').order('updated_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[];
  const { data: clients } = await fromUnknownTable(supabase, 'clients').select('id,first_name,last_name').eq('tenant_id', tenantId).in('id', [...new Set(rows.map((r) => text(r.client_id)))]);
  const names = new Map(((clients ?? []) as Row[]).map((r) => [text(r.id), `${text(r.first_name)} ${text(r.last_name)}`.trim()]));
  return { ok: true, data: rows.map((r) => ({
    id: text(r.id), tenantId: text(r.tenant_id), clientId: text(r.client_id), bodyLocation: text(r.body_location),
    clientName: names.get(text(r.client_id)) ?? '—',
    description: `${text(r.wound_type)} · ${text(r.treatment_plan)}`, documentedAt: text(r.updated_at),
    status: text(r.status) === 'healed' ? 'abgeschlossen' : 'aktiv', sensitivity: 'health', visibility: 'team',
    createdAt: text(r.created_at), updatedAt: text(r.updated_at),
  })) };
}

export async function createWoundDocumentation(tenantId: string, input: { clientId: string; bodyLocation: string; description: string; woundType?: string; woundSize?: string }, role?: RoleKey | null): Promise<ServiceResult<WoundDocumentation>> {
  const denied = enforcePermission<WoundDocumentation>(role, 'pflege.wounds.manage'); if (denied) return denied;
  const tenant = guardServiceTenant(tenantId); if (tenant) return tenant;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Wunddokumentation ist ausschließlich live verfügbar.' };
  const supabase = getSupabaseClient()! as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }> };
  const { data, error } = await supabase.rpc('create_clinical_wound_case', { p_client_id: input.clientId, p_payload: {
    bodyLocation: input.bodyLocation, woundType: input.woundType || 'Nicht klassifiziert', description: input.description,
    treatmentPlan: input.description, initialSize: input.woundSize || '', nextReviewAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  } });
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  const list = await fetchWoundDocumentationList(tenantId, role); const saved = list.ok ? list.data.find((x) => x.id === text(data.id)) : null;
  return saved ? { ok: true, data: saved } : { ok: false, error: 'Wundfall wurde nicht zurückgelesen.' };
}
