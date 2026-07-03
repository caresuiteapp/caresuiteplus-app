import type { RoleKey, ServiceResult } from '@/types';
import type {
  CreateOfficeThreadInput,
  OfficeMessage,
  OfficeMessageThread,
  OfficeMessageThreadDetail,
} from '@/types/office/messaging';
import { OFFICE_MESSAGING_SCHEMA_ERROR } from '@/lib/office/messagethreadservice';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { type PreviewAwareResult } from '@/lib/supabase/missingtablefallback';
import {
  canSendMessageToThread,
  filterActiveMessages,
  filterPortalVisibleMessages,
  isThreadClosed,
  toDbThreadType,
  validateCreateThread,
  validateSendMessage,
} from '@/lib/office/messagebusinessrules';
import { fetchOfficeMessageThreadById } from '@/lib/office/messagethreadservice';
import { insertEmployeeGroupParticipants } from '@/lib/office/employeeGroupChatService';
import { uploadMessageAttachment } from '@/lib/office/messageattachmentservice';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { isAudioMimeType } from '@/lib/office/messageattachmentvalidation';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

function mapMessageRow(row: Record<string, unknown>): OfficeMessage {
  const senderProfileId = row.sender_profile_id ? String(row.sender_profile_id) : null;
  const senderClientId = row.sender_client_id ? String(row.sender_client_id) : null;
  const senderEmployeeId = row.sender_employee_id ? String(row.sender_employee_id) : null;

  let senderType: OfficeMessage['senderType'] = 'office_profile';
  let senderDisplayName = 'Office';
  if (senderClientId) {
    senderType = 'client_portal';
    senderDisplayName = 'Klient:in';
  } else if (senderEmployeeId) {
    senderType = 'employee_portal';
    senderDisplayName = 'Mitarbeiter:in';
  } else if (row.is_system_message) {
    senderType = 'system';
    senderDisplayName = 'System';
  }

  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    threadId: String(row.thread_id),
    body: String(row.body ?? ''),
    senderType,
    senderProfileId,
    senderClientId,
    senderEmployeeId,
    senderDisplayName,
    isInternalNote: Boolean(row.is_internal_note),
    isSystemMessage: Boolean(row.is_system_message),
    sentAt: String(row.sent_at ?? row.created_at),
    readAt: row.read_at ? String(row.read_at) : null,
    status: (row.status as OfficeMessage['status']) ?? 'sent',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function fetchMessagesLive(
  tenantId: string,
  threadId: string,
): Promise<ServiceResult<OfficeMessage[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return {
    ok: true,
    data: filterActiveMessages(
      (data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>)),
    ),
  };
}

export async function fetchOfficeMessageThreadDetail(
  tenantId: string,
  threadId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<OfficeMessageThreadDetail>> {
  const threadResult = await fetchOfficeMessageThreadById(tenantId, threadId, actorRoleKey);
  if (!threadResult.ok) return threadResult;
  if (!threadResult.data) return { ok: false, error: 'Chat nicht gefunden.' };

  const thread = threadResult.data;
  const isClosed = isThreadClosed(thread.status);

  const messagesResult = await fetchMessagesLive(tenantId, threadId);
  if (!messagesResult.ok && isMissingTableServiceError(messagesResult.error)) {
    return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
  }
  if (!messagesResult.ok) return messagesResult;

  return {
    ok: true,
    data: {
      ...thread,
      messages: messagesResult.data,
      canReply: canSendMessageToThread(thread.status),
      isClosed,
    },
    previewData: false,
  };
}

export async function sendOfficeMessage(
  tenantId: string,
  threadId: string,
  body: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
  options?: { isInternalNote?: boolean; attachments?: PendingMessageAttachment[] },
): Promise<PreviewAwareResult<OfficeMessage>> {
  const denied = enforcePermission<OfficeMessage>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const attachments = options?.attachments ?? [];
  const trimmed = body.trim();
  if (!trimmed && attachments.length === 0) {
    return { ok: false, error: 'Nachricht oder Anhang erforderlich.' };
  }

  const threadResult = await fetchOfficeMessageThreadById(tenantId, threadId, actorRoleKey);
  if (!threadResult.ok) return threadResult;
  if (!threadResult.data) return { ok: false, error: 'Chat nicht gefunden.' };

  const validation = validateSendMessage(threadResult.data);
  if (!validation.ok) return validation;

  const now = new Date().toISOString();
  const isInternalNote = options?.isInternalNote ?? false;
  const messageBody =
    trimmed ||
    (attachments.length === 1
      ? isAudioMimeType(attachments[0]!.mimeType)
        ? '🎤 Sprachnachricht'
        : `📎 ${attachments[0]!.fileName}`
      : `📎 ${attachments.length} Anhänge`);

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      body: messageBody,
      is_internal_note: isInternalNote,
      is_system_message: false,
      sender_profile_id: profileId ?? null,
      sent_at: now,
      status: 'sent',
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingTableServiceError(toGermanSupabaseError(error))) {
      return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const message = mapMessageRow(data as Record<string, unknown>);

  for (const attachment of attachments) {
    const uploadResult = await uploadMessageAttachment({
      tenantId,
      threadId,
      messageId: message.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSizeBytes: attachment.fileSizeBytes,
      fileData: attachment.fileData,
      actorRoleKey,
      profileId,
    });
    if (!uploadResult.ok) {
      await supabase
        .from('messages')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', message.id);
      return uploadResult;
    }
  }

  const bumpPortalUnread =
    !isInternalNote &&
    (threadResult.data.threadType === 'client_office' ||
      threadResult.data.threadType === 'employee_group_office');

  const threadUpdate: {
    last_message_at: string;
    last_message_preview: string;
    updated_at: string;
    portal_unread_count?: number;
  } = {
    last_message_at: now,
    last_message_preview: messageBody.slice(0, 120),
    updated_at: now,
  };

  if (bumpPortalUnread) {
    const { data: threadRow } = await supabase
      .from('message_threads')
      .select('portal_unread_count')
      .eq('tenant_id', tenantId)
      .eq('id', threadId)
      .maybeSingle();
    threadUpdate.portal_unread_count = Number(threadRow?.portal_unread_count ?? 0) + 1;
  }

  await supabase
    .from('message_threads')
    .update(threadUpdate)
    .eq('tenant_id', tenantId)
    .eq('id', threadId);

  return { ok: true, data: message, previewData: false };
}

export async function startNewOfficeThreadFromClosed(
  closedThreadId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
): Promise<PreviewAwareResult<OfficeMessageThreadDetail>> {
  const denied = enforcePermission<OfficeMessageThreadDetail>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const closedResult = await fetchOfficeMessageThreadById(tenantId, closedThreadId, actorRoleKey);
  if (!closedResult.ok) return closedResult;
  if (!closedResult.data) return { ok: false, error: 'Chat nicht gefunden.' };
  if (!isThreadClosed(closedResult.data.status)) {
    return { ok: false, error: 'Nur abgeschlossene Chats können neu gestartet werden.' };
  }

  const source = closedResult.data;
  const now = new Date().toISOString();

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      tenant_id: tenantId,
      thread_type: toDbThreadType(source.threadType),
      status: 'open',
      priority: source.priority,
      subject: source.subject,
      category_id: source.categoryId,
      client_id: source.clientId,
      employee_id: source.employeeId,
      created_by_profile_id: profileId ?? null,
      last_message_at: now,
      last_message_preview: 'Neuer Chat gestartet',
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const threadId = String(data.id);
  await supabase.from('messages').insert({
    tenant_id: tenantId,
    thread_id: threadId,
    body: 'Neuer Chat gestartet — vorheriger Verlauf abgeschlossen.',
    is_system_message: true,
    sent_at: now,
    status: 'sent',
  });

  return fetchOfficeMessageThreadDetail(tenantId, threadId, actorRoleKey);
}

export async function createOfficeMessageThread(
  tenantId: string,
  input: CreateOfficeThreadInput,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
  context?: { clientName?: string | null; employeeName?: string | null },
): Promise<PreviewAwareResult<OfficeMessageThread>> {
  const denied = enforcePermission<OfficeMessageThread>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const subject = input.subject.trim();
  if (!subject) return { ok: false, error: 'Betreff darf nicht leer sein.' };

  const validation = validateCreateThread({
    threadType: input.threadType,
    clientId: input.clientId,
    employeeId: input.employeeId,
  });
  if (!validation.ok) return validation;

  const now = new Date().toISOString();
  const priority = input.priority ?? 'normal';
  const preview = input.initialMessage?.trim().slice(0, 120) ?? 'Neuer Chat';

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      tenant_id: tenantId,
      thread_type: toDbThreadType(input.threadType),
      status: 'received',
      priority,
      subject,
      category_id: input.categoryId ?? null,
      client_id: input.clientId ?? null,
      employee_id: input.employeeId ?? null,
      created_by_profile_id: profileId ?? null,
      last_message_at: now,
      last_message_preview: preview,
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingTableServiceError(toGermanSupabaseError(error))) {
      return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const threadId = String(data.id);

  if (input.threadType === 'internal' && input.participantProfileIds?.length) {
    const participantIds = new Set(input.participantProfileIds);
    if (profileId) participantIds.add(profileId);
    const rows = Array.from(participantIds).map((participantProfileId) => ({
      tenant_id: tenantId,
      thread_id: threadId,
      profile_id: participantProfileId,
      is_active: true,
    }));
    await fromUnknownTable(supabase, 'message_thread_participants').insert(rows);
  }

  if (input.threadType === 'employee_group_office' && input.employeeParticipantIds?.length) {
    const participantResult = await insertEmployeeGroupParticipants(
      tenantId,
      threadId,
      input.employeeParticipantIds,
    );
    if (!participantResult.ok) return participantResult;
  }

  if (input.initialMessage?.trim()) {
    await supabase.from('messages').insert({
      tenant_id: tenantId,
      thread_id: threadId,
      body: input.initialMessage.trim(),
      sender_profile_id: profileId ?? null,
      sent_at: now,
      status: 'sent',
    });

    if (input.threadType === 'client_office' || input.threadType === 'employee_group_office') {
      await supabase
        .from('message_threads')
        .update({ portal_unread_count: 1, updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('id', threadId);
    }
  }

  const threadResult = await fetchOfficeMessageThreadById(tenantId, threadId, actorRoleKey);
  if (!threadResult.ok || !threadResult.data) {
    return { ok: false, error: 'Chat konnte nicht erstellt werden.' };
  }

  const created = {
    ...threadResult.data,
    clientName: context?.clientName ?? threadResult.data.clientName,
    employeeName: context?.employeeName ?? threadResult.data.employeeName,
  };

  return { ok: true, data: created, previewData: false };
}

/** Portal-facing message list — excludes internal notes (Rule 4). */
export function getPortalVisibleMessages(messages: OfficeMessage[]): OfficeMessage[] {
  return filterPortalVisibleMessages(messages);
}

export { fetchMessagesLive, mapMessageRow };
