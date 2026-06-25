import type { RoleKey, ServiceResult } from '@/types';
import type { OfficeMessage } from '@/types/office/messaging';
import {
  auditFromThread,
  logOfficeMessageAuditEvent,
} from '@/lib/office/officemessageauditservice';
import {
  listMessageAttachments,
  type MessageAttachment,
} from '@/lib/office/messageattachmentservice';
import { filterActiveMessages } from '@/lib/office/messagebusinessrules';
import { fetchMessagesLive, mapMessageRow } from '@/lib/office/messageservice';
import { fetchOfficeMessageThreadById } from '@/lib/office/messagethreadservice';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

const BUCKET = 'message-attachments';

function canMutateMessage(message: OfficeMessage): { ok: true } | { ok: false; error: string } {
  if (message.isSystemMessage) {
    return { ok: false, error: 'Systemnachrichten können nicht geändert werden.' };
  }
  if (message.status === 'archived') {
    return { ok: false, error: 'Nachricht ist bereits archiviert.' };
  }
  return { ok: true };
}

async function loadMessage(
  tenantId: string,
  messageId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ message: OfficeMessage; threadId: string }>> {
  const denied = enforcePermission<{ message: OfficeMessage; threadId: string }>(
    actorRoleKey,
    'office.messages.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', messageId)
    .maybeSingle();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: false, error: 'Nachricht nicht gefunden.' };

  const message = mapMessageRow(data as Record<string, unknown>);
  return { ok: true, data: { message, threadId: message.threadId } };
}

async function removeAttachmentFiles(
  attachments: MessageAttachment[],
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const paths = attachments
    .map((attachment) => attachment.filePath)
    .filter((filePath): filePath is string => Boolean(filePath?.trim()));

  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

async function syncThreadPreview(tenantId: string, threadId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const messagesResult = await fetchMessagesLive(tenantId, threadId);
  if (!messagesResult.ok) return;

  const active = filterActiveMessages(messagesResult.data);
  const last = active[active.length - 1];
  const now = new Date().toISOString();

  await supabase
    .from('message_threads')
    .update({
      last_message_at: last?.sentAt ?? null,
      last_message_preview: last ? last.body.slice(0, 120) : null,
      updated_at: now,
    })
    .eq('tenant_id', tenantId)
    .eq('id', threadId);
}

export async function archiveOfficeMessage(
  tenantId: string,
  messageId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
  actorDisplayName?: string | null,
): Promise<ServiceResult<OfficeMessage>> {
  const denied = enforcePermission<OfficeMessage>(actorRoleKey, 'office.messages.archive');
  if (denied) return denied;

  const loaded = await loadMessage(tenantId, messageId, actorRoleKey);
  if (!loaded.ok) return loaded;

  const { message, threadId } = loaded.data;
  const mutable = canMutateMessage(message);
  if (!mutable.ok) return mutable;

  const threadResult = await fetchOfficeMessageThreadById(tenantId, threadId, actorRoleKey);
  if (!threadResult.ok) return threadResult;
  if (!threadResult.data) return { ok: false, error: 'Chat nicht gefunden.' };

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('messages')
    .update({ status: 'archived', updated_at: now })
    .eq('tenant_id', tenantId)
    .eq('id', messageId)
    .select('*')
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  await syncThreadPreview(tenantId, threadId);

  void logOfficeMessageAuditEvent({
    tenantId,
    action: 'office_message_archived',
    summary: 'Nachricht archiviert.',
    actorName: actorDisplayName ?? profileId ?? 'Office',
    ...auditFromThread(threadResult.data),
    metadata: { messageId },
  });

  return { ok: true, data: mapMessageRow(data as Record<string, unknown>) };
}

export async function hardDeleteOfficeMessage(
  tenantId: string,
  messageId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
  actorDisplayName?: string | null,
): Promise<ServiceResult<{ deleted: true }>> {
  const denied = enforcePermission<{ deleted: true }>(actorRoleKey, 'office.messages.delete');
  if (denied) return denied;

  const loaded = await loadMessage(tenantId, messageId, actorRoleKey);
  if (!loaded.ok) return loaded;

  const { message, threadId } = loaded.data;
  const mutable = canMutateMessage(message);
  if (!mutable.ok) return mutable;

  const threadResult = await fetchOfficeMessageThreadById(tenantId, threadId, actorRoleKey);
  if (!threadResult.ok) return threadResult;
  if (!threadResult.data) return { ok: false, error: 'Chat nicht gefunden.' };

  const attachmentsResult = await listMessageAttachments(tenantId, messageId, actorRoleKey);
  if (!attachmentsResult.ok) return attachmentsResult;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  await removeAttachmentFiles(attachmentsResult.data);

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', messageId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  await syncThreadPreview(tenantId, threadId);

  void logOfficeMessageAuditEvent({
    tenantId,
    action: 'office_message_deleted',
    summary: 'Nachricht vollständig gelöscht.',
    actorName: actorDisplayName ?? profileId ?? 'Office',
    ...auditFromThread(threadResult.data),
    metadata: { messageId },
  });

  return { ok: true, data: { deleted: true } };
}
