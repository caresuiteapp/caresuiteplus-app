import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import {
  auditFromThread,
  logOfficeMessageAuditEvent,
} from '@/lib/office/officemessageauditservice';
import { validateMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { fetchOfficeMessageThreadById, OFFICE_MESSAGING_SCHEMA_ERROR } from '@/lib/office/messagethreadservice';

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
  const lower = raw.trim().toLowerCase();
  return MIME_ALIASES[lower] ?? lower;
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

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, input.fileData, {
      contentType: normalizedMimeType,
      upsert: false,
    });

  if (uploadError) return { ok: false, error: toGermanSupabaseError(uploadError) };

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600);
  const fileUrl = signed.data?.signedUrl ?? publicData.publicUrl ?? null;

  const { data, error } = await supabase
    .from('message_attachments')
    .insert({
      id: attachmentId,
      tenant_id: input.tenantId,
      message_id: input.messageId,
      file_name: input.fileName,
      file_path: filePath,
      file_url: fileUrl,
      file_size_bytes: input.fileSizeBytes,
      mime_type: normalizedMimeType,
    })
    .select('*')
    .single();

  if (error) return officeMessagingError(toGermanSupabaseError(error));

  const threadResult = await fetchOfficeMessageThreadById(
    input.tenantId,
    input.threadId,
    input.actorRoleKey,
  );
  if (threadResult.ok && threadResult.data) {
    void logOfficeMessageAuditEvent({
      tenantId: input.tenantId,
      action: 'office_message_attachment_uploaded',
      summary: `Anhang „${input.fileName}" hochgeladen.`,
      actorName: input.actorName ?? 'Office',
      ...auditFromThread(threadResult.data),
    });
  }

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
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data?.signedUrl) return { ok: false, error: 'Download-Link konnte nicht erstellt werden.' };
  return { ok: true, data: data.signedUrl };
}

/** Liefert eine aktuelle Signed-URL; bevorzugt file_path gegenüber abgelaufener file_url. */
export async function resolveMessageAttachmentUrl(
  tenantId: string,
  attachment: MessageAttachment,
): Promise<ServiceResult<string>> {
  if (attachment.filePath.trim()) {
    const signed = await getMessageAttachmentSignedUrl(tenantId, attachment.filePath);
    if (signed.ok) return signed;
  }

  const storedUrl = attachment.fileUrl?.trim();
  if (storedUrl) return { ok: true, data: storedUrl };

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  if (attachment.filePath.trim()) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(attachment.filePath);
    if (data.publicUrl) return { ok: true, data: data.publicUrl };
  }

  return { ok: false, error: 'Anhang-Link nicht verfügbar.' };
}
