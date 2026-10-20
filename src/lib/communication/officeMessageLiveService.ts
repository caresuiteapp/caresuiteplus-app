import type { RoleKey, ServiceResult } from '@/types';
import type { MessageDetail, MessageListItem } from '@/types/portal/communication';
import { messagesSupabaseRepository } from '@/features/communication/repositories/messages.supabase';
import { threadsSupabaseRepository } from '@/features/communication/repositories/threads.supabase';
import {
  mapOfficeThreadToMessageListItem,
  shouldIncludeOfficeThread,
} from '@/lib/communication/officeComposeRouting';

export async function fetchOfficeMessagesLive(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MessageListItem[]>> {
  const threadsResult = await threadsSupabaseRepository.list(tenantId);
  if (!threadsResult.ok) return threadsResult;

  const items = threadsResult.data
    .filter((thread) => shouldIncludeOfficeThread(thread, actorRoleKey))
    .map((thread) =>
      mapOfficeThreadToMessageListItem(
        thread,
        thread.previewText ?? '',
        thread.lastMessageByDisplayName ?? 'CareSuite',
      ),
    );

  return { ok: true, data: items };
}

export async function fetchOfficeMessageDetailLive(
  messageId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MessageDetail>> {
  const threadResult = await threadsSupabaseRepository.getById(tenantId, messageId);
  if (!threadResult.ok) return threadResult;
  if (!threadResult.data || !shouldIncludeOfficeThread(threadResult.data, actorRoleKey)) {
    return { ok: false, error: 'Nachricht nicht gefunden.' };
  }

  const thread = threadResult.data;
  const messagesResult = await messagesSupabaseRepository.listByThread(tenantId, thread.id);
  if (!messagesResult.ok) return messagesResult;

  const latestMessage = messagesResult.data.at(-1);
  const listItem = mapOfficeThreadToMessageListItem(
    thread,
    latestMessage?.bodyText ?? thread.previewText ?? '',
    latestMessage?.senderDisplayName ?? thread.lastMessageByDisplayName ?? 'CareSuite',
  );

  return {
    ok: true,
    data: {
      ...listItem,
      channel: 'portal',
      createdAt: latestMessage?.createdAt ?? thread.createdAt,
      canReply: true,
    },
  };
}

export async function replyToOfficeMessageLive(
  messageId: string,
  tenantId: string,
  replyBody: string,
  senderName: string,
  profileId?: string | null,
): Promise<ServiceResult<MessageDetail>> {
  const threadResult = await threadsSupabaseRepository.getById(tenantId, messageId);
  if (!threadResult.ok) return threadResult;
  if (!threadResult.data) {
    return { ok: false, error: 'Nachricht nicht gefunden.' };
  }

  const thread = threadResult.data;
  const body = replyBody.trim();
  const now = new Date().toISOString();

  const messageResult = await messagesSupabaseRepository.create(tenantId, {
    tenantId,
    threadId: thread.id,
    senderType: 'business_user',
    senderUserId: profileId ?? null,
    senderPortalSessionId: null,
    senderDisplayName: senderName,
    contentType: 'text',
    bodyText: body,
    hasAttachments: false,
    hasVoice: false,
    emojiReactionsCount: 0,
    status: 'sent',
    isInternalNote: false,
    isVisibleToBusiness: true,
    isVisibleToEmployee: thread.allowEmployeeReplies,
    isVisibleToClient: thread.allowClientReplies,
    isVisibleToRelative: thread.allowRelativeReplies,
    sentAt: now,
    deliveredAt: now,
    readAt: null,
    editedAt: null,
    editedBy: null,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    replyToMessageId: null,
  });
  if (!messageResult.ok) return messageResult;

  await threadsSupabaseRepository.update(tenantId, thread.id, {
    last_message_id: messageResult.data.id,
    last_message_at: now,
    last_message_by_display_name: senderName,
    preview_text: body.slice(0, 120),
    updated_at: now,
  });

  return fetchOfficeMessageDetailLive(messageId, tenantId);
}
