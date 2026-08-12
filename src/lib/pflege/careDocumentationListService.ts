import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { CareDocumentationDetail, CareDocumentationListItem } from './careDocumentationTypes';
type Row = Record<string, unknown>; const text = (v: unknown) => v == null ? '' : String(v);
const map = (r: Row): CareDocumentationListItem => ({ id: text(r.id), tenantId: text(r.tenant_id), title: text(r.title), clientName: text(r.client_name) || '—', employeeName: text(r.recorded_by_name), recordedAt: text(r.recorded_at), status: text(r.signature_status) === 'signed' ? 'abgeschlossen' : 'entwurf', updatedAt: text(r.created_at), hasSignature: text(r.signature_status) === 'signed', pdfReady: text(r.signature_status) === 'signed', contentPreview: text(r.content).slice(0, 120) });

export async function fetchCareDocumentationList(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<CareDocumentationListItem[]>> {
  const denied = enforcePermission<CareDocumentationListItem[]>(role, 'pflege.documentation.view'); if (denied) return denied;
  const tenant = guardServiceTenant(tenantId); if (tenant) return tenant;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Pflegedokumentation ist ausschließlich live verfügbar.' };
  const supabase = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(supabase, 'clinical_documentation_entries').select('*').eq('tenant_id', tenantId).order('recorded_at', { ascending: false });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const rows = (data ?? []) as Row[];
  const { data: clients } = await fromUnknownTable(supabase, 'clients').select('id,first_name,last_name').eq('tenant_id', tenantId).in('id', [...new Set(rows.map((r) => text(r.client_id)))]);
  const names = new Map(((clients ?? []) as Row[]).map((r) => [text(r.id), `${text(r.first_name)} ${text(r.last_name)}`.trim()]));
  return { ok: true, data: rows.map((r) => map({ ...r, client_name: names.get(text(r.client_id)) ?? '—' })) };
}
export async function fetchCareDocumentationDetail(id: string, tenantId: string, role?: RoleKey | null): Promise<ServiceResult<CareDocumentationDetail>> {
  const denied = enforcePermission<CareDocumentationDetail>(role, 'pflege.documentation.view'); if (denied) return denied;
  const tenant = guardServiceTenant(tenantId); if (tenant) return tenant; const supabase = getSupabaseClient()!;
  const { data, error } = await fromUnknownTable(supabase, 'clinical_documentation_entries').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) }; if (!data) return { ok: false, error: 'Pflegedokumentation nicht gefunden.' };
  const r = data as Row;
  const { data: client } = await fromUnknownTable(supabase, 'clients').select('first_name,last_name').eq('tenant_id', tenantId).eq('id', text(r.client_id)).maybeSingle();
  const c = (client ?? {}) as Row; const name = `${text(c.first_name)} ${text(c.last_name)}`.trim() || '—';
  return { ok: true, data: { ...map({ ...r, client_name: name }), content: text(r.content), durationMinutes: null, location: null } };
}
export async function createCareDocumentation(tenantId: string, clientId: string, entryType: string, title: string, content: string, role?: RoleKey | null): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.documentation.create'); if (denied) return denied;
  const tenant = guardServiceTenant(tenantId); if (tenant) return tenant;
  const supabase = getSupabaseClient()! as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Row | null; error: Parameters<typeof toGermanSupabaseError>[0] }> };
  const { data, error } = await supabase.rpc('create_clinical_documentation', { p_client_id: clientId, p_entry_type: entryType, p_title: title, p_content: content, p_payload: {} });
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) }; const id = text(data.id); const readback = await fetchCareDocumentationDetail(id, tenantId, role);
  return readback.ok ? { ok: true, data: { id } } : readback;
}
