import type { ServiceResult } from '@/types';
import {
  ASSIST_EXECUTION_STORAGE_BUCKET,
  buildAssistVisitAttachmentStoragePath,
} from '@/lib/assist/assistStoragePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toStorageUploadError } from '@/lib/storage/storagePaths';
import { buildTenantStoragePath } from '@/lib/storage/storagePaths';
import { isDemoMode } from '@/lib/supabase/config';
import {
  normalizeEmployeePortalPickedMedia,
  validateEmployeePortalPickedMedia,
} from '@/lib/portal/employeePortalMediaValidation';

export type VisitAttachmentUploadInput = {
  tenantId: string;
  visitId: string;
  employeeId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

type VisitAttachmentUploadResult = {
  storagePath: string;
  metadataPersisted: boolean;
};

export type EmployeePortalVisitAttachment = {
  id: string;
  tenantId: string;
  visitId: string;
  employeeId: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  mediaKind: 'image' | 'video' | 'audio' | 'document';
  createdAt: string;
  recovered: boolean;
};

function resolveMediaKind(mimeType: string): EmployeePortalVisitAttachment['mediaKind'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

function createAttachmentId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function mapAttachmentRow(row: Record<string, unknown>): EmployeePortalVisitAttachment {
  const mimeType = String(row.mime_type ?? 'application/octet-stream');
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    visitId: String(row.visit_id ?? ''),
    employeeId: row.employee_id ? String(row.employee_id) : null,
    storagePath: String(row.storage_path ?? ''),
    fileName: String(row.file_name ?? 'Einsatzdatei'),
    mimeType,
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    mediaKind: resolveMediaKind(String(row.media_kind ?? mimeType)),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    recovered: row.upload_source === 'recovered',
  };
}

function visitAttachmentFolder(tenantId: string, visitId: string): string {
  return buildTenantStoragePath(tenantId, 'assist', 'visits', visitId, 'attachments');
}

export async function uploadEmployeePortalVisitAttachment(
  input: VisitAttachmentUploadInput,
): Promise<ServiceResult<VisitAttachmentUploadResult>> {
  if (!input.visitId?.trim()) {
    return { ok: false, error: 'Einsatz konnte nicht zugeordnet werden.' };
  }
  if (!input.employeeId?.trim()) {
    return { ok: false, error: 'Mitarbeitendenkonto konnte nicht zugeordnet werden.' };
  }

  const media = normalizeEmployeePortalPickedMedia({
    uri: 'memory://employee-portal-upload',
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.length,
  });
  const validation = validateEmployeePortalPickedMedia(media, 'visit');
  if (!validation.ok) return validation;

  if (isDemoMode()) {
    const demoPath = buildAssistVisitAttachmentStoragePath(
      input.tenantId,
      input.visitId,
      `demo-${Date.now()}`,
      input.fileName,
    );
    return { ok: true, data: { storagePath: demoPath, metadataPersisted: true } };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Speicher ist derzeit nicht verfügbar.' };
  }

  const attachmentId = createAttachmentId();
  const storagePath = buildAssistVisitAttachmentStoragePath(
    input.tenantId,
    input.visitId,
    attachmentId,
    input.fileName,
  );

  const { error } = await supabase.storage
    .from(ASSIST_EXECUTION_STORAGE_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) {
    return { ok: false, error: toStorageUploadError(error.message) };
  }

  const now = new Date().toISOString();
  const mediaKind = resolveMediaKind(input.mimeType);
  const { data: attachmentRow, error: metadataError } = await fromUnknownTable(
    supabase,
    'assist_visit_attachments',
  )
    .insert({
      id: attachmentId,
      tenant_id: input.tenantId,
      visit_id: input.visitId,
      employee_id: input.employeeId,
      storage_path: storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.bytes.length,
      media_kind: mediaKind,
      upload_source: 'employee_portal',
      created_at: now,
    })
    .select('*')
    .single();

  if (metadataError) {
    // The storage object is already durable and can be rediscovered by the
    // folder scan below. Never delete a successfully uploaded photo merely
    // because its secondary metadata row could not be written.
    return {
      ok: true,
      data: { storagePath, metadataPersisted: false },
    };
  }

  return {
    ok: true,
    data: {
      storagePath: mapAttachmentRow(attachmentRow as Record<string, unknown>).storagePath,
      metadataPersisted: true,
    },
  };
}

/**
 * Loads durable metadata and also scans the visit folder. The storage scan
 * recovers files uploaded by the older implementation that were left without
 * a database row when the browser tab/session was closed.
 */
export async function listEmployeePortalVisitAttachments(
  tenantId: string,
  visitId: string,
  employeeId?: string | null,
): Promise<ServiceResult<EmployeePortalVisitAttachment[]>> {
  if (isDemoMode()) return { ok: true, data: [] };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Speicher ist derzeit nicht verfügbar.' };

  const folder = visitAttachmentFolder(tenantId, visitId);
  const [metadataResult, storageResult, documentationResult] = await Promise.all([
    fromUnknownTable(supabase, 'assist_visit_attachments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .order('created_at', { ascending: false }),
    supabase.storage.from(ASSIST_EXECUTION_STORAGE_BUCKET).list(folder, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    }),
    fromUnknownTable(supabase, 'assist_visit_documentation')
      .select('photo_references')
      .eq('tenant_id', tenantId)
      .eq('visit_id', visitId)
      .maybeSingle(),
  ]);

  const metadataMissing = metadataResult.error && isMissingTableError(metadataResult.error);
  if (metadataResult.error && !metadataMissing && storageResult.error) {
    return { ok: false, error: toGermanSupabaseError(metadataResult.error) };
  }

  const attachments = new Map<string, EmployeePortalVisitAttachment>();
  for (const row of (metadataResult.data ?? []) as Record<string, unknown>[]) {
    const attachment = mapAttachmentRow(row);
    if (attachment.storagePath) attachments.set(attachment.storagePath, attachment);
  }

  if (!storageResult.error) {
    for (const object of storageResult.data ?? []) {
      if (!object.name || object.name === '.emptyFolderPlaceholder') continue;
      const storagePath = `${folder}/${object.name}`;
      if (attachments.has(storagePath)) continue;
      const metadata = (object.metadata ?? {}) as Record<string, unknown>;
      const mimeType = String(metadata.mimetype ?? metadata.contentType ?? 'application/octet-stream');
      attachments.set(storagePath, {
        id: object.id ?? `recovered-${object.name}`,
        tenantId,
        visitId,
        employeeId: null,
        storagePath,
        fileName: object.name,
        mimeType,
        sizeBytes: metadata.size == null ? null : Number(metadata.size),
        mediaKind: resolveMediaKind(mimeType),
        createdAt: object.created_at ?? object.updated_at ?? new Date().toISOString(),
        recovered: true,
      });
    }
  }

  if (!documentationResult.error) {
    const row = documentationResult.data as Record<string, unknown> | null;
    const references = Array.isArray(row?.photo_references) ? row.photo_references : [];
    for (const reference of references) {
      const storagePath = String(reference ?? '').trim();
      if (!storagePath || attachments.has(storagePath)) continue;
      const fileName = storagePath.split('/').at(-1) ?? 'Einsatzdatei';
      attachments.set(storagePath, {
        id: `documentation-${fileName}`,
        tenantId,
        visitId,
        employeeId: null,
        storagePath,
        fileName,
        mimeType: 'application/octet-stream',
        sizeBytes: null,
        mediaKind: 'document',
        createdAt: new Date().toISOString(),
        recovered: true,
      });
    }
  }

  // Older app versions uploaded the object but kept its reference only in
  // sessionStorage. Backfill those objects so future loads no longer depend on
  // a storage-folder scan. Recovery is best-effort and must never hide a file.
  const recoveredAttachments = [...attachments.values()].filter(
    (attachment) => attachment.recovered && attachment.storagePath.startsWith(`${folder}/`),
  );
  if (!metadataMissing && employeeId && recoveredAttachments.length > 0) {
    await fromUnknownTable(supabase, 'assist_visit_attachments').upsert(
      recoveredAttachments.map((attachment) => ({
        id: createAttachmentId(),
        tenant_id: tenantId,
        visit_id: visitId,
        employee_id: employeeId,
        storage_path: attachment.storagePath,
        file_name: attachment.fileName,
        mime_type: attachment.mimeType,
        size_bytes: attachment.sizeBytes,
        media_kind: attachment.mediaKind,
        upload_source: 'recovered',
        created_at: attachment.createdAt,
      })),
      { onConflict: 'tenant_id,storage_path', ignoreDuplicates: true },
    );
  }

  return {
    ok: true,
    data: [...attachments.values()].sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    ),
  };
}
