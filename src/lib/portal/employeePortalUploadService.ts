import type { ServiceResult } from '@/types';
import type { PortalUpload, PortalUploadStatus } from '@/types/portal/uploads';
import { createPortalRequest } from '@/lib/portal/assist/portalRequestService';
import {
  buildStorageObjectFileName,
  buildTenantStoragePath,
  toStorageUploadError,
} from '@/lib/storage/storagePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';

const STORAGE_BUCKET = 'office-documents';

export type EmployeePortalUploadContext = 'mitarbeiter' | 'klient';

export type EmployeePortalUploadInput = {
  tenantId: string;
  employeeId: string;
  uploadContext: EmployeePortalUploadContext;
  clientId?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  contentBase64: string;
  category?: string | null;
  message?: string | null;
};

export const EMPLOYEE_SELF_UPLOAD_CATEGORIES = [
  'krankmeldung',
  'fuehrerschein',
  'nachweis',
  'bescheinigung',
  'sonstiges',
] as const;

export const EMPLOYEE_CLIENT_UPLOAD_CATEGORIES = [
  'pflegekasse',
  'vollmacht',
  'bescheid',
  'rechnung',
  'foto_dokument',
  'sonstiges',
] as const;

export const EMPLOYEE_PORTAL_UPLOAD_STATUS_LABELS: Record<PortalUploadStatus, string> = {
  hochgeladen: 'Eingereicht',
  wird_geprueft: 'In Prüfung',
  freigegeben: 'Zugeordnet',
  abgelehnt: 'Abgelehnt / Rückfrage',
};

function mapUploadRow(row: Record<string, unknown>): PortalUpload & {
  uploadContext?: EmployeePortalUploadContext;
  employeeId?: string | null;
} {
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: row.client_id ? String(row.client_id) : '',
    portalUserId: row.portal_user_id ? String(row.portal_user_id) : null,
    portalRequestId: row.portal_request_id ? String(row.portal_request_id) : null,
    storagePath: String(row.storage_path ?? ''),
    fileName: String(row.file_name ?? ''),
    mimeType: String(row.mime_type ?? 'application/octet-stream'),
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    category: row.category ? String(row.category) : null,
    message: row.message ? String(row.message) : null,
    status: String(row.status ?? 'hochgeladen') as PortalUploadStatus,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewNote: row.review_note ? String(row.review_note) : null,
    clientDocumentId: row.client_document_id ? String(row.client_document_id) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    uploadContext: row.upload_context ? (String(row.upload_context) as EmployeePortalUploadContext) : undefined,
    employeeId: row.employee_id ? String(row.employee_id) : null,
  };
}

function decodeBase64(contentBase64: string): Uint8Array {
  return Uint8Array.from(atob(contentBase64), (c) => c.charCodeAt(0));
}

export function buildEmployeePortalUploadStoragePath(
  tenantId: string,
  employeeId: string,
  uploadId: string,
  fileName: string,
  clientId?: string | null,
): string {
  const storageFileName = buildStorageObjectFileName(uploadId, fileName);
  if (clientId) {
    return buildTenantStoragePath(tenantId, 'clients', clientId, 'portal-uploads', uploadId, storageFileName);
  }
  return buildTenantStoragePath(tenantId, 'employees', employeeId, 'portal-uploads', uploadId, storageFileName);
}

export async function uploadEmployeePortalDocument(
  input: EmployeePortalUploadInput,
): Promise<ServiceResult<PortalUpload>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    if (!input.contentBase64?.trim()) {
      return { ok: false, error: 'Dateiinhalt fehlt — bitte Dokument erneut auswählen.' };
    }

    if (input.uploadContext === 'klient' && !input.clientId?.trim()) {
      return { ok: false, error: 'Bitte Klient:in auswählen.' };
    }

    const uploadId = crypto.randomUUID?.() ?? `upload-${Date.now()}`;
    const storagePath = buildEmployeePortalUploadStoragePath(
      input.tenantId,
      input.employeeId,
      uploadId,
      input.fileName,
      input.uploadContext === 'klient' ? input.clientId : null,
    );
    const payload = decodeBase64(input.contentBase64);

    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, payload, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (uploadError) {
      return { ok: false, error: toStorageUploadError(uploadError.message) };
    }

    const requestResult = await createPortalRequest({
      tenantId: input.tenantId,
      clientId: input.clientId ?? input.employeeId,
      moduleKey: 'assist',
      requestType: 'upload',
      title:
        input.uploadContext === 'mitarbeiter'
          ? `Mitarbeiter-Dokument: ${input.fileName}`
          : `Klient-Dokument: ${input.fileName}`,
      description: input.message?.trim() || null,
      payload: {
        uploadId,
        uploadContext: input.uploadContext,
        employeeId: input.employeeId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes ?? payload.length,
        category: input.category ?? null,
      },
    });
    if (!requestResult.ok) return requestResult;

    const { data, error } = await fromUnknownTable(supabase, 'portal_uploads')
      .insert({
        id: uploadId,
        tenant_id: input.tenantId,
        client_id: input.uploadContext === 'klient' ? input.clientId : null,
        employee_id: input.employeeId,
        upload_context: input.uploadContext,
        portal_request_id: requestResult.data.id,
        storage_path: storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes ?? payload.length,
        category: input.category?.trim() || null,
        message: input.message?.trim() || null,
        status: 'hochgeladen',
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return { ok: false, error: 'Uploads sind noch nicht verfügbar (Migration ausstehend).' };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: mapUploadRow(data as Record<string, unknown>) };
  }, { delayMs: 200 });
}

export async function listEmployeePortalUploads(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<Array<PortalUpload & { uploadContext?: EmployeePortalUploadContext }>>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const { data, error } = await fromUnknownTable(supabase, 'portal_uploads')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return {
      ok: true,
      data: ((data ?? []) as Record<string, unknown>[]).map(mapUploadRow),
    };
  });
}
