import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import {
  auditFromThread,
  logOfficeMessageAuditEvent,
} from '@/lib/office/officemessageauditservice';
import {
  normalizeAttachmentMimeType,
  validateMessageAttachment,
} from '@/lib/office/messageattachmentvalidation';
import { fetchOfficeMessageThreadById, OFFICE_MESSAGING_SCHEMA_ERROR } from '@/lib/office/messagethreadservice';
import {
  toUserFacingAttachmentError,
  toUserFacingSendError,
  VOICE_ATTACHMENT_INSERT_TIMEOUT_MS,
  VOICE_SIGNED_URL_TIMEOUT_MS,
  VOICE_STORAGE_DOWNLOAD_TIMEOUT_MS,
  VOICE_STORAGE_UPLOAD_TIMEOUT_MS,
  withMessagingTimeout,
} from '@/lib/office/voicemessageutils';

export type MessageAttachment = {
  id: string;
  tenantId: string;
  messageId: string;
  fileName: string;
  filePath: string;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: string;
};

const BUCKET = 'message-attachments';

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'application/x-pdf': 'application/pdf',
};

function normalizeMimeType(raw: string): string {
  const lower = normalizeAttachmentMimeType(raw);
  return MIME_ALIASES[lower] ?? lower;
}

function toStorageUploadPayload(
  fileData: Blob | ArrayBuffer | Uint8Array,
  mimeType: string,
): Blob | ArrayBuffer | Uint8Array {
  const normalizedMime = normalizeMimeType(mimeType);
  if (typeof Blob !== 'undefined') {
    if (fileData instanceof Blob) {
      return fileData.type ? fileData : new Blob([fileData], { type: normalizedMime });
    }
    const bytes = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
    return new Blob([bytes], { type: normalizedMime });
  }
  return fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
}

async function downloadAttachmentBlobUrl(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  filePath: string,
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await withMessagingTimeout(
      supabase.storage.from(BUCKET).download(filePath),
      VOICE_STORAGE_DOWNLOAD_TIMEOUT_MS,
      'Download timeout',
    );
    if (error || !data) {
      return { ok: false, error: toUserFacingAttachmentError() };
    }
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return { ok: true, data: URL.createObjectURL(data) };
    }
    return { ok: false, error: toUserFacingAttachmentError() };
  } catch {
    return { ok: false, error: toUserFacingAttachmentError() };
  }
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
};

function inferMimeTypeFromFileName(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? (EXT_TO_MIME[ext] ?? null) : null;
}

function officeMessagingError(error: string): ServiceResult<never> {
  if (isMissingTableServiceError(error)) {
    return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
  }
  return { ok: false, error };
}

function mapAttachmentRow(row: Record<string, unknown>): MessageAttachment {
  const fileName = String(row.file_name ?? 'Anhang');
  const rawMime = row.mime_type ? String(row.mime_type) : null;
  const mimeType = rawMime
    ? normalizeMimeType(rawMime)
    : inferMimeTypeFromFileName(fileName);

  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    messageId: String(row.message_id),
    fileName,
    filePath: String(row.file_path ?? ''),
    fileUrl: row.file_url ? String(row.file_url) : null,
    fileSizeBytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : null,
    mimeType,
    createdAt: String(row.created_at),
  };
}

export function buildMessageAttachmentPath(
  tenantId: string,
  threadId: string,
  attachmentId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `tenant/${tenantId}/threads/${threadId}/${attachmentId}/${safeName}`;
}

export async function listMessageAttachments(
  tenantId: string,
  messageId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MessageAttachment[]>> {
  const isPortalRole =
    actorRoleKey === 'client_portal' ||
    actorRoleKey === 'family_portal' ||
    actorRoleKey === 'employee_portal';

  if (!isPortalRole) {
    const denied = enforcePermission<MessageAttachment[]>(actorRoleKey, 'office.messages.view');
    if (denied) return denied;
  } else {
    const permission =
      actorRoleKey === 'employee_portal'
        ? 'portal.employee.messages.view'
        : 'portal.client.messages.view';
    const denied = enforcePermission<MessageAttachment[]>(actorRoleKey, permission);
    if (denied) return denied;
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_attachments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('message_id', messageId)
    .order('created_at', { ascending: true });

  if (error) return officeMessagingError(toGermanSupabaseError(error));
  return {
    ok: true,
    data: (data ?? []).map((row) => mapAttachmentRow(row as Record<string, unknown>)),
  };
}

export async function uploadMessageAttachment(input: {
  tenantId: string;
  threadId: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileData: Blob | ArrayBuffer | Uint8Array;
  actorRoleKey?: RoleKey | null;
  profileId?: string | null;
  actorName?: string | null;
  skipPermissionCheck?: boolean;
}): Promise<ServiceResult<MessageAttachment>> {
  const validation = validateMessageAttachment({
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
  });
  if (!validation.ok) return validation;

  if (!input.skipPermissionCheck) {
    const denied = enforcePermission<MessageAttachment>(input.actorRoleKey, 'office.access');
    if (denied) return denied;
  }

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const normalizedMimeType = normalizeMimeType(input.mimeType);
  const uploadPayload = toStorageUploadPayload(input.fileData, normalizedMimeType);

  const attachmentId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `att-${Date.now()}`;
  const filePath = buildMessageAttachmentPath(
    input.tenantId,
    input.threadId,
    attachmentId,
    input.fileName,
  );

  try {
    const { error: uploadError } = await withMessagingTimeout(
      supabase.storage.from(BUCKET).upload(filePath, uploadPayload, {
        contentType: normalizedMimeType,
        upsert: false,
      }),
      VOICE_STORAGE_UPLOAD_TIMEOUT_MS,
      'Datei-Upload Zeitüberschreitung. Bitte erneut versuchen.',
    );

    if (uploadError) {
      return { ok: false, error: toUserFacingSendError(uploadError.message) };
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Datei-Upload fehlgeschlagen.';
    return { ok: false, error: toUserFacingSendError(message) };
  }

  let data: Record<string, unknown> | null = null;
  let insertError: { message?: string } | null = null;
  try {
    const insertResult = await withMessagingTimeout(
      supabase
        .from('message_attachments')
        .insert({
          id: attachmentId,
          tenant_id: input.tenantId,
          message_id: input.messageId,
          file_name: input.fileName,
          file_path: filePath,
          file_url: null,
          file_size_bytes: input.fileSizeBytes,
          mime_type: normalizedMimeType,
        })
        .select('*')
        .single(),
      VOICE_ATTACHMENT_INSERT_TIMEOUT_MS,
      'Attachment insert timeout',
    );
    data = insertResult.data as Record<string, unknown> | null;
    insertError = insertResult.error;
  } catch {
    insertError = { message: 'insert timeout' };
  }

  if (insertError || !data) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return { ok: false, error: toUserFacingSendError(insertError?.message) };
  }

  void fetchOfficeMessageThreadById(input.tenantId, input.threadId, input.actorRoleKey).then(
    (threadResult) => {
      if (threadResult.ok && threadResult.data) {
        void logOfficeMessageAuditEvent({
          tenantId: input.tenantId,
          action: 'office_message_attachment_uploaded',
          summary: `Anhang „${input.fileName}" hochgeladen.`,
          actorName: input.actorName ?? 'Office',
          ...auditFromThread(threadResult.data),
        });
      }
    },
  );

  return { ok: true, data: mapAttachmentRow(data as Record<string, unknown>) };
}

/** Portal-Anhang-Upload nach Nachrichtenerstellung. */
export async function uploadPortalMessageAttachment(input: {
  tenantId: string;
  threadId: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileData: Blob | ArrayBuffer | Uint8Array;
  actorRoleKey: RoleKey;
  profileId?: string | null;
  actorName?: string | null;
  audience: 'client' | 'employee';
}): Promise<ServiceResult<MessageAttachment>> {
  const permission =
    input.audience === 'client'
      ? 'portal.client.messages.reply'
      : 'portal.employee.messages.reply';
  const denied = enforcePermission<MessageAttachment>(input.actorRoleKey, permission);
  if (denied) return denied;

  return uploadMessageAttachment({
    tenantId: input.tenantId,
    threadId: input.threadId,
    messageId: input.messageId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    fileData: input.fileData,
    actorRoleKey: input.actorRoleKey,
    profileId: input.profileId,
    actorName: input.actorName,
    skipPermissionCheck: true,
  });
}

export async function getMessageAttachmentSignedUrl(
  tenantId: string,
  filePath: string,
): Promise<ServiceResult<string>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: toUserFacingAttachmentError() };

  try {
    const { data, error } = await withMessagingTimeout(
      supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600),
      VOICE_SIGNED_URL_TIMEOUT_MS,
      'Signed-URL timeout',
    );
    if (error || !data?.signedUrl) {
      return { ok: false, error: toUserFacingAttachmentError() };
    }
    return { ok: true, data: data.signedUrl };
  } catch {
    return { ok: false, error: toUserFacingAttachmentError() };
  }
}

/** Liefert abspielbare URL — authentifizierter Download zuerst (private Bucket), dann Signed-URL. */
export async function resolveMessageAttachmentUrl(
  tenantId: string,
  attachment: MessageAttachment,
): Promise<ServiceResult<string>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (attachment.tenantId !== tenantId) {
    return { ok: false, error: toUserFacingAttachmentError() };
  }

  const filePath = attachment.filePath.trim();
  if (!filePath) {
    return { ok: false, error: toUserFacingAttachmentError() };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: toUserFacingAttachmentError() };

  const downloaded = await downloadAttachmentBlobUrl(supabase, filePath);
  if (downloaded.ok) return downloaded;

  return getMessageAttachmentSignedUrl(tenantId, filePath);
}
