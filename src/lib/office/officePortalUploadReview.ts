import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { PortalUpload } from '@/types/portal/uploads';
import { listPendingPortalUploads } from '@/lib/portal/assist/portalDocumentUploadService';
import { enforceWithActor } from '@/lib/permissions/actorPermissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { isTenantStoragePath } from '@/lib/storage/storagePaths';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type UploadReviewScope = { tenantId: string; role?: RoleKey | null; profile?: Profile | null };
export type OfficePortalUpload = PortalUpload & { clientName?: string | null };
async function permitted<T>(scope: UploadReviewScope) {
  return guardServiceTenant(scope.tenantId) ?? await enforceWithActor<T>(scope.role, scope.tenantId, scope.profile, 'office.documents.view');
}
export async function loadOfficePortalUploads(scope: UploadReviewScope, clientId?: string): Promise<ServiceResult<OfficePortalUpload[]>> {
  const denied = await permitted<OfficePortalUpload[]>(scope); if (denied) return denied;
  const list = await listPendingPortalUploads(scope.tenantId, { clientId }); if (!list.ok) return list;
  const canEmployees = !await enforceWithActor(scope.role, scope.tenantId, scope.profile, 'office.employees.view');
  const canClients = !await enforceWithActor(scope.role, scope.tenantId, scope.profile, 'office.clients.view');
  const visible = list.data.filter(item => item.uploadContext === 'mitarbeiter' || item.employeeId && !item.clientId ? canEmployees : canClients);
  const names = new Map<string,string>(); const client = getSupabaseClient();
  const ids = [...new Set(visible.map(item => item.clientId).filter(Boolean))];
  if (client) for (let offset = 0; offset < ids.length; offset += 100) {
    const { data } = await fromUnknownTable(client, 'clients').select('id,first_name,last_name').eq('tenant_id', scope.tenantId).in('id', ids.slice(offset, offset + 100));
    for (const row of data ?? []) names.set(String(row.id), [row.first_name, row.last_name].filter(Boolean).join(' '));
  }
  return { ok: true, data: visible.map(item => ({ ...item, clientName: names.get(item.clientId) ?? null })) };
}
async function find(scope: UploadReviewScope, id: string, write: boolean): Promise<ServiceResult<OfficePortalUpload>> {
  const list = await loadOfficePortalUploads(scope); if (!list.ok) return list;
  const upload = list.data.find(item => item.id === id && item.tenantId === scope.tenantId);
  if (!upload) return { ok: false, error: 'Dieser Eingang wurde bereits bearbeitet oder ist für Sie nicht verfügbar.' };
  const employee = upload.uploadContext === 'mitarbeiter' || Boolean(upload.employeeId && !upload.clientId);
  const denied = await enforceWithActor<OfficePortalUpload>(scope.role, scope.tenantId, scope.profile, employee ? write ? 'office.employees.edit' : 'office.employees.view' : write ? 'office.clients.edit' : 'office.clients.view');
  if (denied) return denied;
  if (!isTenantStoragePath(upload.storagePath, scope.tenantId)) return { ok: false, error: 'Die Datei ist nicht eindeutig diesem Unternehmen zugeordnet.' };
  return { ok: true, data: upload };
}
export async function openOfficePortalUpload(scope: UploadReviewScope, id: string): Promise<ServiceResult<{ blob: Blob; filename: string; mimeType: string }>> {
  try {
    const found = await find(scope, id, false); if (!found.ok) return found;
    const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Die Dokumentablage ist nicht erreichbar.' };
    const file = await client.storage.from('office-documents').download(found.data.storagePath);
    if (file.error || !file.data) return { ok: false, error: 'Die eingereichte Datei konnte nicht geladen werden.' };
    return { ok: true, data: { blob: file.data, filename: found.data.fileName, mimeType: found.data.mimeType } };
  } catch { return { ok: false, error: 'Die Datei konnte nicht geöffnet werden.' }; }
}
/** The server locks the upload and applies the decision and file assignment in one transaction. */
export async function reviewOfficePortalUpload(scope: UploadReviewScope, id: string, decision: 'approve' | 'reject', note?: string): Promise<ServiceResult<{ id: string }>> {
  const denied = await permitted<{ id: string }>(scope); if (denied) return denied;
  if (decision === 'reject' && !note?.trim()) return { ok: false, error: 'Bitte einen kurzen Grund für die Ablehnung angeben.' };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { ok: false, error: 'Der Dokumenteingang ist nicht eindeutig zugeordnet.' };
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Die Dokumentablage ist nicht erreichbar.' };
  try {
    const result = await client.rpc('office_review_portal_upload' as never, { p_tenant_id: scope.tenantId, p_upload_id: id, p_decision: decision, p_review_note: note?.trim() || null } as never);
    if (result.error) return { ok: false, error: result.error.code === 'PGRST202' ? 'Die sichere Eingangsprüfung ist noch nicht verfügbar. Bitte versuchen Sie es nach dem nächsten Neuladen erneut.' : toGermanSupabaseError(result.error) };
    const data = result.data as { id?: string; status?: string } | null;
    if (data?.id !== id || data.status !== (decision === 'approve' ? 'freigegeben' : 'abgelehnt')) return { ok: false, error: 'Die Entscheidung konnte nicht bestätigt werden. Bitte den Eingang erneut laden.' };
    return { ok: true, data: { id } };
  } catch { return { ok: false, error: 'Der Eingang konnte nicht bearbeitet werden. Bitte erneut versuchen.' }; }
}
