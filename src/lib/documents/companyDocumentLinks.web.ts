import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { CentralDocumentStored } from '@/types/documents/centralCatalog';
import { enforcePermission } from '@/lib/permissions';
import { enforceWithActor } from '@/lib/permissions/actorPermissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { downloadCentralDocument } from './centralCatalogService';

export type CompanyDocumentLinkScope = {
  tenantId: string;
  roleKey: RoleKey | null;
  profile?: Profile | null;
  effectivePermissions?: readonly PermissionKey[];
};
export type CompanyDocumentChoice = { id: string; title: string; revision: number; state: 'draft' | 'issued'; createdAt: string; hasOriginal: boolean };
export const companyDocumentCatalogHref = () => '/office/document-catalog' as const;

async function guard<T>(scope: CompanyDocumentLinkScope): Promise<ServiceResult<T> | null> {
  const tenantBlock = guardServiceTenant(scope.tenantId);
  if (tenantBlock) return tenantBlock;
  const denied = scope.effectivePermissions
    ? enforcePermission<T>(scope.roleKey, 'office.documents.view', { effectivePermissions: scope.effectivePermissions })
    : await enforceWithActor<T>(scope.roleKey, scope.tenantId, scope.profile, 'office.documents.view');
  if (denied) return denied;
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Unternehmensunterlagen stehen nur mit einer aktiven Datenverbindung zur Verfügung.' };
  return null;
}

export async function loadCompanyDocumentChoices(scope: CompanyDocumentLinkScope, offset = 0): Promise<ServiceResult<CompanyDocumentChoice[]>> {
  const denied = await guard<CompanyDocumentChoice[]>(scope); if (denied) return denied;
  if (!Number.isSafeInteger(offset) || offset < 0) return { ok: false, error: 'Ungültige Dokumentseite.' };
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  try {
    const { data, error } = await fromUnknownTable(client, 'central_document_records')
      .select('id,title,revision,state,created_at,original_path').eq('tenant_id', scope.tenantId).eq('target', 'company').eq('entity_id', scope.tenantId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 99);
    if (error) return { ok: false, error: 'Die Unternehmensunterlagen konnten nicht geladen werden.' };
    return { ok: true, data: (data ?? []).map(row => ({ id: String(row.id), title: String(row.title), revision: Number(row.revision), state: row.state as 'draft' | 'issued', createdAt: String(row.created_at), hasOriginal: Boolean(row.original_path) })) };
  } catch { return { ok: false, error: 'Die Unternehmensunterlagen konnten nicht geladen werden.' }; }
}

/** Re-read by tenant and record id. Never trust a stored URL or a caller-supplied storage path. */
export async function downloadCompanyLinkedDocument(scope: CompanyDocumentLinkScope, id: string, original = false): Promise<ServiceResult<{ bytes: Uint8Array; fileName: string; mimeType: string }>> {
  const denied = await guard<{ bytes: Uint8Array; fileName: string; mimeType: string }>(scope); if (denied) return denied;
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { ok: false, error: 'Ungültige Dokumentzuordnung.' };
  try {
    const { data: row, error } = await fromUnknownTable(client, 'central_document_records')
      .select('id,tenant_id,target,entity_id,title,template_key,revision,snapshot_json,state,pdf_path,pdf_hash,original_path,original_hash,created_at')
      .eq('tenant_id', scope.tenantId).eq('target', 'company').eq('entity_id', scope.tenantId).eq('id', id).maybeSingle();
    if (error || !row || row.tenant_id !== scope.tenantId || row.target !== 'company' || row.entity_id !== scope.tenantId) return { ok: false, error: 'Die verknüpfte Unternehmensunterlage ist nicht verfügbar.' };
    const snapshot = row.snapshot_json as CentralDocumentStored['snapshot'];
    if (!snapshot?.definition || snapshot.context?.tenantId !== scope.tenantId || snapshot.context?.target !== 'company' || snapshot.context?.entityId !== scope.tenantId) return { ok: false, error: 'Die Unternehmenszuordnung der Unterlage stimmt nicht überein.' };
    const record: CentralDocumentStored = {
      id: String(row.id), tenantId: scope.tenantId, title: String(row.title), templateKey: String(row.template_key), revision: Number(row.revision), snapshot,
      state: row.state as 'draft' | 'issued', pdfPath: row.pdf_path as string | null, pdfHash: row.pdf_hash as string | null,
      originalPath: row.original_path as string | null, originalHash: row.original_hash as string | null, createdAt: String(row.created_at),
    };
    const result = await downloadCentralDocument(record, { roleKey: scope.roleKey, profile: scope.profile, effectivePermissions: scope.effectivePermissions }, original);
    if (!result.ok) return result;
    const suffix = original ? record.originalPath?.match(/\.(pdf|png|jpe?g)$/i)?.[1]?.toLowerCase() ?? 'bin' : 'pdf';
    const title = record.title.replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 90) || 'Unterlage';
    return { ok: true, data: { bytes: result.data, fileName: `${title}_v${record.revision}${original ? '_Original' : ''}.${suffix}`, mimeType: suffix === 'pdf' ? 'application/pdf' : suffix === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(suffix) ? 'image/jpeg' : 'application/octet-stream' } };
  } catch { return { ok: false, error: 'Die verknüpfte Unternehmensunterlage konnte nicht geladen werden.' }; }
}
