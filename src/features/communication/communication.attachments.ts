import type { RoleKey, ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { runService } from '@/lib/services/serviceRunner';
import { appendDemoAttachment, getDemoAttachments } from './communication.demoStore';
import { appendCommunicationAudit } from './communication.audit';
import { enforceCommunicationPermission } from './communication.permissions';
import { ATTACHMENT_STORAGE_PATH } from './communication.constants';
import { attachmentsSupabaseRepository } from './repositories/attachments.supabase';
import type { AttachmentType, CommunicationAttachment } from './communication.types';

export type PrepareAttachmentInput = {
  tenantId: string;
  threadId: string;
  messageId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  attachmentType: AttachmentType;
};

const PREPARED_ONLY_MESSAGE =
  'Anhänge im Live-Modus erfordern Dateiauswahl und Supabase Storage — noch nicht vollständig konfiguriert.';

export async function prepareAttachmentUpload(
  input: PrepareAttachmentInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ storagePath: string; attachmentId: string }>> {
  const denied = enforceCommunicationPermission<{ storagePath: string; attachmentId: string }>(
    actorRoleKey,
    'communication.upload_attachment',
  );
  if (denied) return denied;

  const tenantErr = assertTenantForMode(input.tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  const attachmentId = `att-${Date.now()}`;
  const storagePath = ATTACHMENT_STORAGE_PATH.replace('{tenantId}', input.tenantId)
    .replace('{threadId}', input.threadId)
    .replace('{attachmentId}', attachmentId)
    .replace('{filename}', input.filename);

  return { ok: true, data: { storagePath, attachmentId } };
}

async function uploadToStorage(
  storagePath: string,
  _mimeType: string,
): Promise<ServiceResult<{ publicUrl: string | null }>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: PREPARED_ONLY_MESSAGE };
  }

  const bucket = 'communication-attachments';
  const { error } = await supabase.storage.from(bucket).upload(storagePath, new Uint8Array(0), {
    upsert: false,
    contentType: 'application/octet-stream',
  });

  if (error) {
    return {
      ok: false,
      error: `Storage-Upload fehlgeschlagen: ${error.message}. Bucket "${bucket}" prüfen.`,
    };
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { ok: true, data: { publicUrl: urlData.publicUrl ?? null } };
}

export async function uploadAttachment(
  input: PrepareAttachmentInput & { uploadedBy?: string | null },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CommunicationAttachment>> {
  const prepared = await prepareAttachmentUpload(input, actorRoleKey);
  if (!prepared.ok) return prepared;

  if (getServiceMode() === 'supabase') {
    const storageResult = await uploadToStorage(prepared.data.storagePath, input.mimeType);
    if (!storageResult.ok) return storageResult;

    const insertResult = await attachmentsSupabaseRepository.insert(input.tenantId, {
      threadId: input.threadId,
      messageId: input.messageId,
      filename: input.filename,
      mimeType: input.mimeType,
      storagePath: prepared.data.storagePath,
      sizeBytes: input.sizeBytes,
      attachmentType: input.attachmentType,
    });
    if (!insertResult.ok) return insertResult;

    const now = new Date().toISOString();
    const attachment: CommunicationAttachment = {
      id: insertResult.data.id,
      tenantId: input.tenantId,
      threadId: input.threadId,
      messageId: input.messageId,
      attachmentType: input.attachmentType,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: prepared.data.storagePath,
      publicUrl: storageResult.data.publicUrl,
      scanStatus: 'pending',
      durationSeconds: null,
      waveformPreview: null,
      linkedDocumentId: null,
      uploadedBy: input.uploadedBy ?? null,
      createdAt: now,
      updatedAt: now,
    };

    appendCommunicationAudit({
      tenantId: input.tenantId,
      userId: input.uploadedBy ?? null,
      action: 'attachment_uploaded',
      entityType: 'communication_attachment',
      entityId: attachment.id,
      threadId: input.threadId,
      messageId: input.messageId,
      result: 'success',
    });

    return { ok: true, data: attachment };
  }

  return runService(async () => {
    const now = new Date().toISOString();
    const attachment: CommunicationAttachment = {
      id: prepared.data.attachmentId,
      tenantId: input.tenantId,
      threadId: input.threadId,
      messageId: input.messageId,
      attachmentType: input.attachmentType,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: prepared.data.storagePath,
      publicUrl: null,
      scanStatus: 'pending',
      durationSeconds: null,
      waveformPreview: null,
      linkedDocumentId: null,
      uploadedBy: input.uploadedBy ?? null,
      createdAt: now,
      updatedAt: now,
    };

    appendDemoAttachment(attachment);
    appendCommunicationAudit({
      tenantId: input.tenantId,
      userId: input.uploadedBy ?? null,
      action: 'attachment_uploaded',
      entityType: 'communication_attachment',
      entityId: attachment.id,
      threadId: input.threadId,
      messageId: input.messageId,
      result: 'success',
    });

    return { ok: true, data: attachment };
  });
}

export async function listAttachments(
  tenantId: string,
  threadId: string,
): Promise<ServiceResult<CommunicationAttachment[]>> {
  if (getServiceMode() === 'supabase') {
    const result = await attachmentsSupabaseRepository.listByThread(tenantId, threadId);
    if (!result.ok) return result;
    const now = new Date().toISOString();
    const data: CommunicationAttachment[] = result.data.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      threadId: row.threadId,
      messageId: row.messageId,
      attachmentType: 'document',
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: 0,
      storagePath: row.storagePath,
      publicUrl: null,
      scanStatus: 'pending',
      durationSeconds: null,
      waveformPreview: null,
      linkedDocumentId: null,
      uploadedBy: null,
      createdAt: now,
      updatedAt: now,
    }));
    return { ok: true, data };
  }

  return {
    ok: true,
    data: getDemoAttachments().filter((a) => a.tenantId === tenantId && a.threadId === threadId),
  };
}

export async function linkAttachmentToDocument(
  attachmentId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CommunicationAttachment>> {
  const denied = enforceCommunicationPermission<CommunicationAttachment>(
    actorRoleKey,
    'communication.assign_thread',
  );
  if (denied) return denied;

  const attachment = getDemoAttachments().find((a) => a.id === attachmentId);
  if (!attachment) return { ok: false, error: 'Anhang nicht gefunden.' };
  attachment.linkedDocumentId = documentId;
  attachment.updatedAt = new Date().toISOString();
  return { ok: true, data: attachment };
}

export async function removeAttachment(
  attachmentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ removed: true }>> {
  const denied = enforceCommunicationPermission<{ removed: true }>(
    actorRoleKey,
    'communication.delete_any_message',
  );
  if (denied) return denied;

  const index = getDemoAttachments().findIndex((a) => a.id === attachmentId);
  if (index < 0) return { ok: false, error: 'Anhang nicht gefunden.' };
  getDemoAttachments().splice(index, 1);
  return { ok: true, data: { removed: true } };
}

export function getAttachmentPreview(attachment: CommunicationAttachment): string {
  return attachment.filename;
}

export function isAttachmentUploadPreparedOnly(): boolean {
  return getServiceMode() === 'supabase' && !getSupabaseClient();
}
