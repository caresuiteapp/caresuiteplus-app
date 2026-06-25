import type { ServiceResult } from '@/types';
import type { ClientDocumentRecord } from '@/types/modules/client';
import type {
  ApprovePortalUploadInput,
  PortalDocumentUploadInput,
  PortalUpload,
  PortalUploadStatus,
  RejectPortalUploadInput,
} from '@/types/portal/uploads';
import { buildClientDocumentStoragePath } from '@/lib/clients/clientDocumentsService';
import { getClientExtendedRepository } from '@/lib/clients/clientBackend';
import { logPortalActivity } from '@/lib/portal/assist/portalActivityService';
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

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export function buildPortalUploadStoragePath(
  tenantId: string,
  clientId: string,
  uploadId: string,
  fileName: string,
): string {
  const storageFileName = buildStorageObjectFileName(uploadId, fileName);
  return buildTenantStoragePath(tenantId, 'clients', clientId, 'portal-uploads', uploadId, storageFileName);
}

function mapUploadRow(row: Record<string, unknown>): PortalUpload {
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: String(row.client_id ?? ''),
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
  };
}

function decodeBase64(contentBase64: string): Uint8Array {
  return Uint8Array.from(atob(contentBase64), (c) => c.charCodeAt(0));
}

/** Upload file from client portal → Storage + portal_uploads + portal_request. */
export async function uploadPortalDocument(
  input: PortalDocumentUploadInput,
): Promise<ServiceResult<PortalUpload>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    if (!input.contentBase64?.trim()) {
      return { ok: false, error: 'Dateiinhalt fehlt — bitte Dokument erneut auswählen.' };
    }

    const uploadId = crypto.randomUUID?.() ?? `upload-${Date.now()}`;
    const storagePath = buildPortalUploadStoragePath(
      input.tenantId,
      input.clientId,
      uploadId,
      input.fileName,
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
      clientId: input.clientId,
      portalUserId: input.portalUserId,
      moduleKey: input.moduleKey ?? 'assist',
      requestType: 'upload',
      title: `Dokument: ${input.fileName}`,
      description: input.message?.trim() || null,
      payload: {
        uploadId,
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
        client_id: input.clientId,
        portal_user_id: input.portalUserId ?? null,
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
        return { ok: false, error: 'Portal-Uploads sind noch nicht verfügbar (Migration ausstehend).' };
      }
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    const upload = mapUploadRow(data as Record<string, unknown>);

    await logPortalActivity({
      tenantId: input.tenantId,
      clientId: input.clientId,
      portalUserId: input.portalUserId,
      moduleKey: input.moduleKey ?? 'assist',
      activityType: 'document_uploaded',
      title: `Dokument hochgeladen: ${input.fileName}`,
      description: input.message ?? null,
      metadata: {
        uploadId: upload.id,
        requestId: requestResult.data.id,
        fileName: input.fileName,
      },
    });

    await tryLinkUploadMessageThread(input, upload, requestResult.data.id);

    return { ok: true, data: upload };
  }, { delayMs: 200 });
}

async function tryLinkUploadMessageThread(
  input: PortalDocumentUploadInput,
  upload: PortalUpload,
  requestId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: threads, error } = await supabase
    .from('message_threads')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('client_id', input.clientId)
    .eq('thread_type', 'client_office' as never)
    .not('status', 'in', '("closed","resolved","archived")')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error || !threads?.[0]?.id) return;

  const threadId = String(threads[0].id);
  const now = new Date().toISOString();
  const body = [
    `📎 Dokument hochgeladen: ${input.fileName}`,
    input.message?.trim() ? `\n${input.message.trim()}` : null,
  ]
    .filter(Boolean)
    .join('');

  const { error: messageError } = await supabase.from('messages').insert({
    tenant_id: input.tenantId,
    thread_id: threadId,
    body,
    sender_client_id: input.clientId,
    sent_at: now,
    status: 'sent',
    metadata: { portalUploadId: upload.id, portalRequestId: requestId } as never,
  });

  if (messageError && !isMissingTableError(messageError)) {
    console.warn('[tryLinkUploadMessageThread]', messageError.message);
  }
}

/** List portal uploads for client (own uploads). */
export async function listClientPortalUploads(
  tenantId: string,
  clientId: string,
  options?: { limit?: number },
): Promise<ServiceResult<PortalUpload[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'portal_uploads')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
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

/** Office: list pending portal uploads for tenant. */
export async function listPendingPortalUploads(
  tenantId: string,
  options?: { clientId?: string; limit?: number },
): Promise<ServiceResult<PortalUpload[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    let query = fromUnknownTable(supabase, 'portal_uploads')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['hochgeladen', 'wird_geprueft'])
      .order('created_at', { ascending: false });

    if (options?.clientId) query = query.eq('client_id', options.clientId);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
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

/** Office: approve upload → copy to client_documents with portal_visible. */
export async function approvePortalUpload(
  input: ApprovePortalUploadInput,
): Promise<ServiceResult<PortalUpload>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data: row, error: fetchError } = await fromUnknownTable(supabase, 'portal_uploads')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.uploadId)
      .single();

    if (fetchError || !row) {
      return { ok: false, error: 'Portal-Upload nicht gefunden.' };
    }

    const upload = mapUploadRow(row as Record<string, unknown>);
    if (upload.status === 'freigegeben' || upload.status === 'abgelehnt') {
      return { ok: false, error: 'Upload wurde bereits bearbeitet.' };
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(upload.storagePath);
    if (downloadError || !blob) {
      return { ok: false, error: toStorageUploadError(downloadError?.message) };
    }

    const docId = crypto.randomUUID?.() ?? `doc-${Date.now()}`;
    const targetPath = buildClientDocumentStoragePath(
      upload.tenantId,
      upload.clientId,
      docId,
      upload.fileName,
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const { error: copyUploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(targetPath, bytes, {
      contentType: upload.mimeType,
      upsert: false,
    });
    if (copyUploadError) {
      return { ok: false, error: toStorageUploadError(copyUploadError.message) };
    }

    const title =
      input.title?.trim() ||
      upload.fileName.replace(/\.[^.]+$/, '') ||
      upload.fileName;
    const category = input.category ?? upload.category ?? 'sonstige';

    const docResult = await getClientExtendedRepository().insertDocument(upload.tenantId, upload.clientId, {
      title,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      category: category as ClientDocumentRecord['category'],
      storagePath: targetPath,
      sizeBytes: upload.sizeBytes ?? bytes.length,
      uploadedBy: input.reviewedBy,
    });
    if (!docResult.ok) return docResult;

    const portalVisible = input.portalVisible !== false;
    if (portalVisible) {
      await fromUnknownTable(supabase, 'client_documents')
        .update({ portal_visible: true })
        .eq('id', docResult.data.id)
        .eq('tenant_id', upload.tenantId);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await fromUnknownTable(supabase, 'portal_uploads')
      .update({
        status: 'freigegeben',
        reviewed_by: input.reviewedBy,
        reviewed_at: now,
        client_document_id: docResult.data.id,
        updated_at: now,
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.uploadId)
      .select('*')
      .single();

    if (updateError) {
      return { ok: false, error: toGermanSupabaseError(updateError) };
    }

    if (upload.portalRequestId) {
      await fromUnknownTable(supabase, 'portal_requests')
        .update({ status: 'erledigt', updated_at: now })
        .eq('id', upload.portalRequestId)
        .eq('tenant_id', input.tenantId);
    }

    return { ok: true, data: mapUploadRow(updated as Record<string, unknown>) };
  }, { delayMs: 300 });
}

/** Office: reject portal upload. */
export async function rejectPortalUpload(
  input: RejectPortalUploadInput,
): Promise<ServiceResult<PortalUpload>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const now = new Date().toISOString();
    const { data, error } = await fromUnknownTable(supabase, 'portal_uploads')
      .update({
        status: 'abgelehnt',
        reviewed_by: input.reviewedBy,
        reviewed_at: now,
        review_note: input.reviewNote?.trim() || null,
        updated_at: now,
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.uploadId)
      .in('status', ['hochgeladen', 'wird_geprueft'])
      .select('*')
      .single();

    if (error || !data) {
      return { ok: false, error: 'Portal-Upload konnte nicht abgelehnt werden.' };
    }

    const upload = mapUploadRow(data as Record<string, unknown>);
    if (upload.portalRequestId) {
      await fromUnknownTable(supabase, 'portal_requests')
        .update({ status: 'abgelehnt', updated_at: now })
        .eq('id', upload.portalRequestId)
        .eq('tenant_id', input.tenantId);
    }

    return { ok: true, data: upload };
  });
}
