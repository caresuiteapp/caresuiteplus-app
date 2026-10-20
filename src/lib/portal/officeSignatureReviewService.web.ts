import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { PortalSignatureDocumentDetail } from '@/types/portal/documentSignatures';
import { enforceWithActor } from '@/lib/permissions/actorPermissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isTenantStoragePath } from '@/lib/storage/storagePaths';
import {
  mapPortalSignatureAuditRow, mapPortalSignatureCaptureRow, mapPortalSignatureDocumentRow,
  PORTAL_SIGNATURE_STORAGE_BUCKET, PORTAL_SIGNATURE_TABLES,
} from './portalDocumentSignatureHelpers';

export type OfficeSignatureReview = { document: PortalSignatureDocumentDetail; employeeName: string | null; pdfUrl: string | null; fileError: string | null };

/** Office review uses the authenticated client's tenant-scoped RLS, never the employee-only download endpoint. */
export async function fetchOfficeSignatureReview(tenantId: string, documentId: string, roleKey?: RoleKey | null, profile?: Profile | null): Promise<ServiceResult<OfficeSignatureReview>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const denied = await enforceWithActor<OfficeSignatureReview>(roleKey, tenantId, profile, 'office.documents.signatures.view');
  if (denied) return denied;
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die Verbindung zu den Dokumenten ist nicht verfügbar.' };
  const result = await fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.documents).select('*').eq('tenant_id', tenantId).eq('id', documentId).maybeSingle();
  if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
  if (!result.data) return { ok: false, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
  const document = mapPortalSignatureDocumentRow(result.data as Record<string, unknown>);
  const [captures, audit] = await Promise.all([
    fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.captures).select('*').eq('tenant_id', tenantId).eq('document_id', documentId).order('signed_at', { ascending: true }),
    fromUnknownTable(supabase, PORTAL_SIGNATURE_TABLES.audit).select('*').eq('tenant_id', tenantId).eq('document_id', documentId).order('created_at', { ascending: false }),
  ]);
  if (captures.error || audit.error) return { ok: false, error: toGermanSupabaseError(captures.error ?? audit.error) };
  let employeeName: string | null = null;
  if (document.employeeId && !await enforceWithActor(roleKey, tenantId, profile, 'office.employees.view')) {
    const employee = await fromUnknownTable(supabase, 'employees').select('first_name,last_name').eq('tenant_id', tenantId).eq('id', document.employeeId).maybeSingle();
    if (!employee.error && employee.data) employeeName = [employee.data.first_name, employee.data.last_name].filter(Boolean).join(' ').trim() || null;
  }
  let pdfUrl: string | null = null;
  let fileError: string | null = null;
  const path = document.status === 'completed' && document.previewPdfUrl
    ? document.previewPdfUrl : document.documentSourceType === 'pdf_upload' ? document.storagePath : null;
  if (path) {
    if (!isTenantStoragePath(path, tenantId)) fileError = 'Die Datei konnte diesem Unternehmen nicht sicher zugeordnet werden.';
    else {
      const signed = await supabase.storage.from(PORTAL_SIGNATURE_STORAGE_BUCKET).createSignedUrl(path, 300);
      if (signed.error || !signed.data?.signedUrl) fileError = 'Die PDF konnte nicht geladen werden. Bitte erneut laden.';
      else pdfUrl = signed.data.signedUrl;
    }
  }
  return { ok: true, data: { document: { ...document,
    captures: (captures.data ?? []).map((row) => mapPortalSignatureCaptureRow(row as Record<string, unknown>)),
    auditTrail: (audit.data ?? []).map((row) => mapPortalSignatureAuditRow(row as Record<string, unknown>)),
  }, employeeName, pdfUrl, fileError } };
}
