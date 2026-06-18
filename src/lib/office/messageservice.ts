import type { RoleKey, ServiceResult } from '@/types';
import type { OfficeMessage, OfficeMessageThreadDetail } from '@/types/office/messaging';
import {
  appendDemoOfficeMessage,
  appendDemoOfficeThread,
  getDemoOfficeMessageThreads,
  getDemoOfficeMessages,
} from '@/data/demo/officemessagethreads';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { type PreviewAwareResult } from '@/lib/supabase/missingtablefallback';
import {
  canSendMessageToThread,
  filterPortalVisibleMessages,
  isThreadClosed,
  toDbThreadType,
  validateSendMessage,
} from '@/lib/office/messagebusinessrules';
import { fetchOfficeMessageThreadById } from '@/lib/office/messagethreadservice';

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
    data: (data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>)),
  };
}

async function uploadAttachmentsForMessage(
  tenantId: string,
  threadId: string,
  messageId: string,
  attachments: PendingMessageAttachment[],
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
): Promise<ServiceResult<void>> {
  for (const attachment of attachments) {
    const result = await uploadMessageAttachment({
      tenantId,
      threadId,
      messageId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSizeBytes: attachment.fileSizeBytes,
      fileData: attachment.fileData,
      actorRoleKey,
      profileId,
    });
    if (!result.ok) return result;
  }
  return { ok: true, data: undefined };
}

async function incrementPortalUnreadCount(tenantId: string, threadId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data } = await supabase
    .from('message_threads')
    .select('portal_unread_count')
    .eq('tenant_id', tenantId)
    .eq('id', threadId)
    .maybeSingle();
  const current = Number(data?.portal_unread_count ?? 0);
  await supabase
    .from('message_threads')
    .update({
      portal_unread_count: current + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', threadId);
}

async function incrementOfficeUnreadCount(tenantId: string, threadId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data } = await supabase
    .from('message_threads')
    .select('office_unread_count')
    .eq('tenant_id', tenantId)
    .eq('id', threadId)
    .maybeSingle();
  const current = Number(data?.office_unread_count ?? 0);
  await supabase
    .from('message_threads')
    .update({
      office_unread_count: current + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', threadId);
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

  if (getServiceMode() === 'demo') {
    const messages = getDemoOfficeMessages().filter((message) => message.threadId === threadId);
    return {
      ok: true,
      data: {
        ...thread,
        messages,
        canReply: canSendMessageToThread(thread.status),
        isClosed,
      },
      previewData: true,
    };
  }

  const messagesResult = await fetchMessagesLive(tenantId, threadId);
  if (!messagesResult.ok && isMissingTableServiceError(messagesResult.error)) {
    const messages = getDemoOfficeMessages().filter((message) => message.threadId === threadId);
    return {
      ok: true,
      data: {
        ...thread,
        messages,
        canReply: canSendMessageToThread(thread.status),
        isClosed,
      },
      previewData: true,
    };
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
    previewData: threadResult.previewData,
  };
}

export async function sendOfficeMessage(
  tenantId: string,
  threadId: string,
  body: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
  options?: { isInternalNote?: boolean },
): Promise<PreviewAwareResult<OfficeMessage>> {
  const denied = enforcePermission<OfficeMessage>(actorRoleKey, 'office.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Nachricht darf nicht leer sein.' };

  const threadResult = await fetchOfficeMessageThreadById(tenantId, threadId, actorRoleKey);
  if (!threadResult.ok) return threadResult;
  if (!threadResult.data) return { ok: false, error: 'Chat nicht gefunden.' };

  const validation = validateSendMessage(threadResult.data);
  if (!validation.ok) return validation;

  const now = new Date().toISOString();
  const isInternalNote = options?.isInternalNote ?? false;

  if (getServiceMode() === 'demo') {
    const message: OfficeMessage = {
      id: `msg-demo-${Date.now()}`,
      tenantId,
      threadId,
      body: trimmed,
      senderType: 'office_profile',
      senderProfileId: profileId ?? null,
      senderClientId: null,
      senderEmployeeId: null,
      senderDisplayName: 'Office',
      isInternalNote,
      isSystemMessage: false,
      sentAt: now,
      readAt: null,
      status: 'sent',
      createdAt: now,
      updatedAt: now,
    };
    appendDemoOfficeMessage(message);
    return { ok: true, data: message, previewData: true };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      body: trimmed,
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
      const message: OfficeMessage = {
        id: `msg-demo-${Date.now()}`,
        tenantId,
        threadId,
        body: trimmed,
        senderType: 'office_profile',
        senderProfileId: profileId ?? null,
        senderClientId: null,
        senderEmployeeId: null,
        senderDisplayName: 'Office',
        isInternalNote,
        isSystemMessage: false,
        sentAt: now,
        readAt: null,
        status: 'sent',
        createdAt: now,
        updatedAt: now,
      };
      appendDemoOfficeMessage(message);
      return { ok: true, data: message, previewData: true };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  await supabase
    .from('message_threads')
    .update({
      last_message_at: now,
      last_message_preview: trimmed.slice(0, 120),
      updated_at: now,
    })
    .eq('tenant_id', tenantId)
    .eq('id', threadId);

  return { ok: true, data: mapMessageRow(data as Record<string, unknown>), previewData: false };
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
  const newId = `thread-reopen-${Date.now()}`;

  if (getServiceMode() === 'demo' || tenantId === DEMO_TENANT_ID) {
    const newThread = {
      ...source,
      id: newId,
      status: 'open' as const,
      archivedAt: null,
      unreadCount: 0,
      lastMessageAt: now,
      lastMessagePreview: 'Neuer Chat gestartet',
      createdAt: now,
      updatedAt: now,
    };
    appendDemoOfficeThread(newThread);
    appendDemoOfficeMessage({
      id: `msg-system-${Date.now()}`,
      tenantId,
      threadId: newId,
      body: 'Neuer Chat gestartet — vorheriger Verlauf abgeschlossen.',
      senderType: 'system',
      senderProfileId: null,
      senderClientId: null,
      senderEmployeeId: null,
      senderDisplayName: 'System',
      isInternalNote: false,
      isSystemMessage: true,
      sentAt: now,
      readAt: null,
      status: 'sent',
      createdAt: now,
      updatedAt: now,
    });
    return fetchOfficeMessageThreadDetail(tenantId, newId, actorRoleKey);
  }

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

/** Portal-facing message list — excludes internal notes (Rule 4). */
export function getPortalVisibleMessages(messages: OfficeMessage[]): OfficeMessage[] {
  return filterPortalVisibleMessages(messages);
}

export { fetchMessagesLive, mapMessageRow };
