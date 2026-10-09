import type { ServiceResult } from '@/types/core/base';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from './platformSupabaseClient';
import type { DossierPage, TenantDossier } from './tenantDossierModel';

const unavailable = 'Die vollständige Mandantenakte benötigt den Echtbetrieb. Für diese Ansicht werden keine Beispieldaten ergänzt.';
const tenantPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getTenantDossier(tenantId: string): Promise<ServiceResult<TenantDossier>> {
  if (getServiceMode() === 'demo') return { ok: false, error: unavailable };
  const { data, error } = await platformRpc<TenantDossier>('platform_read_tenant_dossier', { p_tenant_id: tenantId, p_section: 'summary' });
  if (error || !data) return { ok: false, error: error?.message ?? 'Die vollständige Mandantenakte ist nicht verfügbar.' };
  if (data.tenantId !== tenantId) return { ok: false, error: 'Die zurückgegebenen Daten gehören nicht zum geöffneten Unternehmen.' };
  return { ok: true, data };
}

export type DossierQuery = { section: string; parentId?: string | null; recordId?: string | null; search?: string; status?: string; offset?: number; limit?: number; includeDeleted?: boolean };
export async function getTenantDossierPage(tenantId: string, query: DossierQuery): Promise<ServiceResult<DossierPage>> {
  if (getServiceMode() === 'demo') return { ok: false, error: unavailable };
  const { data, error } = await platformRpc<DossierPage>('platform_read_tenant_dossier', {
    p_tenant_id: tenantId, p_section: query.section, p_parent_id: query.parentId ?? null,
    p_record_id: query.recordId ?? null, p_search: query.search?.trim() || null, p_status: query.status || null,
    p_offset: query.offset ?? 0, p_limit: query.limit ?? 50, p_include_deleted: query.includeDeleted ?? false,
  });
  if (error || !data) return { ok: false, error: error?.message ?? 'Die Daten konnten nicht geladen werden.' };
  if (data.tenantId !== tenantId || data.section !== query.section) return { ok: false, error: 'Die Datenzuordnung stimmt nicht mit der geöffneten Akte überein.' };
  return { ok: true, data };
}

export async function getTenantDossierSummaries(tenantIds: string[]): Promise<ServiceResult<TenantDossier[]>> {
  if (getServiceMode() === 'demo') return { ok: false, error: unavailable };
  const ids = [...new Set(tenantIds.filter(id => tenantPattern.test(id)))];
  if (!ids.length) return { ok: true, data: [] };
  if (ids.length > 50) return { ok: false, error: 'Bitte höchstens 50 Unternehmen je Seite laden.' };
  const { data, error } = await platformRpc<{ items: TenantDossier[] }>('platform_list_tenant_dossier_summaries', { p_tenant_ids: ids });
  if (error || !data) return { ok: false, error: error?.message ?? 'Einrichtungsstände sind nicht verfügbar.' };
  if (data.items.some(item => !ids.includes(item.tenantId))) return { ok: false, error: 'Die Einrichtungsdaten gehören nicht zur angezeigten Unternehmensliste.' };
  return { ok: true, data: data.items };
}
