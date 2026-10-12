import type { RoleKey, ServiceResult } from '@/types';
import type { PortalDocumentDetail, PortalDocumentListItem } from '@/types/portal/documents';
import { mapEmployeeDocumentsLiveRows, type EmployeeDocumentLiveRow } from '@/lib/office/employeePersonnelFileMapper';
import { buildPersonnelAccessContext, filterPersonnelDocumentsForViewer } from '@/lib/office/employeePersonnelAccess';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { fetchAllPortalRows } from './portalRowPagination';
import { isRoleAllowedForPortalAudience } from './portalAudience';
import { fetchPortalEmployeeIdForAuthUser } from './resolvePortalEmployeeLink';
import { isTenantStoragePath } from '@/lib/storage/storagePaths';

const SELECT = 'id, tenant_id, employee_id, category, title, file_name, storage_path, sensitive, released_to_portal, valid_until, created_at, updated_at';

function visibleRows(rows: EmployeeDocumentLiveRow[], tenantId: string, employeeId: string, roleKey: RoleKey | null) {
  const context = buildPersonnelAccessContext({ tenantId, employeeId, targetEmployeeId: employeeId, roleKey });
  return filterPersonnelDocumentsForViewer(context, mapEmployeeDocumentsLiveRows(rows)).filter(row =>
    row.tenantId === tenantId && row.employeeId === employeeId && row.releasedToPortal);
}
function mapItem(doc: ReturnType<typeof visibleRows>[number]): PortalDocumentDetail {
  const extension = doc.fileName.split('.').pop()?.toLowerCase();
  const mimeType = ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic' } as Record<string, string>)[extension ?? ''] ?? 'application/octet-stream';
  return {
    id: doc.id, title: doc.title, fileName: doc.fileName, displayFileName: doc.fileName, mimeType,
    category: doc.category === 'contract' || doc.category === 'agreement' ? 'contract' : doc.category === 'privacy' ? 'consent' : 'other',
    fileSizeBytes: 0, status: 'aktiv', visibility: 'shared', sensitivity: doc.sensitive ? 'restricted' : 'standard',
    createdAt: doc.createdAt, updatedAt: doc.updatedAt, description: null,
    documentSource: 'employee_document', downloadReady: isTenantStoragePath(doc.storagePath, doc.tenantId), viewReady: false,
  };
}
async function validScope(tenantId: string, employeeId: string, roleKey: RoleKey | null) {
  if (!tenantId.trim() || !employeeId.trim() || !isRoleAllowedForPortalAudience(roleKey, 'employee')) return false;
  const ownEmployeeId = await fetchPortalEmployeeIdForAuthUser(tenantId);
  return Boolean(ownEmployeeId && ownEmployeeId === employeeId);
}
export async function fetchEmployeePortalDocuments(tenantId: string, employeeId: string, roleKey: RoleKey | null): Promise<ServiceResult<PortalDocumentListItem[]>> {
  if (!await validScope(tenantId, employeeId, roleKey)) return { ok: false, error: 'Ihr Mitarbeitendenkonto ist nicht vollständig verknüpft oder dieses Dokument gehört zu einem anderen Profil.' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die Dokumente konnten gerade nicht geladen werden.' };
  const result = await fetchAllPortalRows<EmployeeDocumentLiveRow>((from, to) => fromUnknownTable(supabase, 'employee_documents')
    .select(SELECT, { count: 'exact' }).eq('tenant_id', tenantId).eq('employee_id', employeeId).eq('released_to_portal', true)
    .order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to));
  if (!result.ok) return result;
  return { ok: true, data: visibleRows(result.data, tenantId, employeeId, roleKey).map(mapItem) };
}
async function loadDocument(tenantId: string, employeeId: string, documentId: string, roleKey: RoleKey | null) {
  if (!documentId.trim() || !await validScope(tenantId, employeeId, roleKey)) return { ok: false as const, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false as const, error: 'Die Dokumente konnten gerade nicht geladen werden.' };
  const result = await fromUnknownTable(supabase, 'employee_documents').select(SELECT)
    .eq('tenant_id', tenantId).eq('employee_id', employeeId).eq('id', documentId).eq('released_to_portal', true).maybeSingle();
  if (result.error) return { ok: false as const, error: 'Das Dokument konnte gerade nicht geladen werden. Bitte erneut versuchen.' };
  const document = result.data ? visibleRows([result.data as EmployeeDocumentLiveRow], tenantId, employeeId, roleKey)[0] : null;
  if (!document) return { ok: false as const, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
  return { ok: true as const, data: document };
}
export async function fetchEmployeePortalDocumentDetail(tenantId: string, employeeId: string, documentId: string, roleKey: RoleKey | null): Promise<ServiceResult<PortalDocumentDetail>> {
  const document = await loadDocument(tenantId, employeeId, documentId, roleKey);
  return document.ok ? { ok: true, data: mapItem(document.data) } : document;
}
export async function downloadEmployeePortalDocument(tenantId: string, employeeId: string, documentId: string, roleKey: RoleKey | null): Promise<ServiceResult<{ fileName: string; mimeType: string; downloadUrl: string }>> {
  const document = await loadDocument(tenantId, employeeId, documentId, roleKey);
  if (!document.ok) return document;
  if (!document.data.storagePath?.trim()) return { ok: false, error: 'Die Datei ist noch nicht verfügbar.' };
  if (!isTenantStoragePath(document.data.storagePath, tenantId)) return { ok: false, error: 'Die Datei ist diesem Profil noch nicht korrekt zugeordnet. Bitte die Verwaltung informieren.' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Der Download konnte gerade nicht vorbereitet werden.' };
  const signed = await supabase.storage.from('office-documents').createSignedUrl(document.data.storagePath, 300);
  if (signed.error || !signed.data?.signedUrl) return { ok: false, error: 'Der Download konnte gerade nicht vorbereitet werden. Bitte erneut versuchen.' };
  const item = mapItem(document.data);
  return { ok: true, data: { fileName: item.fileName, mimeType: item.mimeType, downloadUrl: signed.data.signedUrl } };
}
