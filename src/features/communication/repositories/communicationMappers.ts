import type {
  CommunicationMessage,
  CommunicationSettings,
  CommunicationThread,
} from '../communication.types';

function toIso(value: string | null | undefined): string | null {
  return value ?? null;
}

export function mapCommunicationThreadRow(row: Record<string, unknown>): CommunicationThread {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    threadType: row.thread_type as CommunicationThread['threadType'],
    status: row.status as CommunicationThread['status'],
    priority: row.priority as CommunicationThread['priority'],
    subject: (row.subject as string | null) ?? null,
    title: String(row.title),
    previewText: (row.preview_text as string | null) ?? null,
    moduleKey: (row.module_key as CommunicationThread['moduleKey']) ?? null,
    clientId: (row.client_id as string | null) ?? null,
    employeeId: (row.employee_id as string | null) ?? null,
    relativeContactId: (row.relative_contact_id as string | null) ?? null,
    assignmentId: (row.assignment_id as string | null) ?? null,
    documentId: (row.document_id as string | null) ?? null,
    invoiceId: (row.invoice_id as string | null) ?? null,
    consultationCaseId: (row.consultation_case_id as string | null) ?? null,
    courseId: (row.course_id as string | null) ?? null,
    supportTicketId: (row.support_ticket_id as string | null) ?? null,
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
    createdByPortalSessionId: (row.created_by_portal_session_id as string | null) ?? null,
    lastMessageId: (row.last_message_id as string | null) ?? null,
    lastMessageAt: toIso(row.last_message_at as string | null),
    lastMessageByDisplayName: (row.last_message_by_display_name as string | null) ?? null,
    unreadCountBusiness: Number(row.unread_count_business ?? row.office_unread_count ?? 0),
    unreadCountEmployee: Number(row.unread_count_employee ?? 0),
    unreadCountClient: Number(row.unread_count_client ?? 0),
    unreadCountRelative: Number(row.unread_count_relative ?? 0),
    isInternalOnly: Boolean(row.is_internal_only),
    isPortalVisible: Boolean(row.is_portal_visible),
    allowClientReplies: Boolean(row.allow_client_replies),
    allowEmployeeReplies: Boolean(row.allow_employee_replies),
    allowRelativeReplies: Boolean(row.allow_relative_replies),
    archivedAt: toIso(row.archived_at as string | null),
    archivedBy: (row.archived_by as string | null) ?? null,
    deletedAt: toIso(row.deleted_at as string | null),
    deletedBy: (row.deleted_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapCommunicationMessageRow(row: Record<string, unknown>): CommunicationMessage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    threadId: String(row.thread_id),
    senderType: row.sender_type as CommunicationMessage['senderType'],
    senderUserId: (row.sender_user_id as string | null) ?? null,
    senderPortalSessionId: (row.sender_portal_session_id as string | null) ?? null,
    senderDisplayName: String(row.sender_display_name),
    contentType: row.content_type as CommunicationMessage['contentType'],
    bodyText: (row.body_text as string | null) ?? null,
    hasAttachments: Boolean(row.has_attachments),
    hasVoice: Boolean(row.has_voice),
    emojiReactionsCount: Number(row.emoji_reactions_count ?? 0),
    status: row.status as CommunicationMessage['status'],
    isInternalNote: Boolean(row.is_internal_note),
    isVisibleToBusiness: Boolean(row.is_visible_to_business),
    isVisibleToEmployee: Boolean(row.is_visible_to_employee),
    isVisibleToClient: Boolean(row.is_visible_to_client),
    isVisibleToRelative: Boolean(row.is_visible_to_relative),
    sentAt: toIso(row.sent_at as string | null),
    deliveredAt: toIso(row.delivered_at as string | null),
    readAt: toIso(row.read_at as string | null),
    editedAt: toIso(row.edited_at as string | null),
    editedBy: (row.edited_by as string | null) ?? null,
    deletedAt: toIso(row.deleted_at as string | null),
    deletedBy: (row.deleted_by as string | null) ?? null,
    deleteReason: (row.delete_reason as string | null) ?? null,
    replyToMessageId: (row.reply_to_message_id as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapCommunicationSettingsRow(row: Record<string, unknown>): CommunicationSettings {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    centerEnabled: Boolean(row.center_enabled),
    clientPortalEnabled: Boolean(row.client_portal_enabled),
    employeePortalEnabled: Boolean(row.employee_portal_enabled),
    relativePortalEnabled: Boolean(row.relative_portal_enabled),
    voiceMessagesEnabled: Boolean(row.voice_messages_enabled),
    attachmentsEnabled: Boolean(row.attachments_enabled),
    emojisEnabled: Boolean(row.emojis_enabled),
    reactionsEnabled: Boolean(row.reactions_enabled),
    internalNotesEnabled: Boolean(row.internal_notes_enabled),
    autoArchiveMonths: (row.auto_archive_months as number | null) ?? null,
    maxFileSizeMb: Number(row.max_file_size_mb ?? 25),
    allowedFileTypes: (row.allowed_file_types as string[]) ?? ['pdf', 'jpg', 'png'],
    pushEnabled: Boolean(row.push_enabled),
    emailEnabled: Boolean(row.email_enabled),
    smsEnabled: Boolean(row.sms_enabled),
    realtimeEnabled: Boolean(row.realtime_enabled),
    showReadReceipts: Boolean(row.show_read_receipts),
    showTypingIndicator: Boolean(row.show_typing_indicator),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function threadToInsertRow(
  tenantId: string,
  thread: Partial<CommunicationThread> & { title: string; threadType: CommunicationThread['threadType'] },
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    thread_type: thread.threadType,
    status: thread.status ?? 'open',
    priority: thread.priority ?? 'normal',
    subject: thread.subject ?? null,
    title: thread.title,
    preview_text: thread.previewText ?? null,
    module_key: thread.moduleKey ?? 'core',
    client_id: thread.clientId ?? null,
    employee_id: thread.employeeId ?? null,
    relative_contact_id: thread.relativeContactId ?? null,
    is_internal_only: thread.isInternalOnly ?? false,
    is_portal_visible: thread.isPortalVisible ?? true,
    allow_client_replies: thread.allowClientReplies ?? false,
    allow_employee_replies: thread.allowEmployeeReplies ?? false,
    allow_relative_replies: thread.allowRelativeReplies ?? false,
    created_by_user_id: thread.createdByUserId ?? null,
  };
}

export function messageToInsertRow(
  tenantId: string,
  message: Omit<CommunicationMessage, 'id' | 'createdAt' | 'updatedAt'>,
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    thread_id: message.threadId,
    sender_type: message.senderType,
    sender_user_id: message.senderUserId,
    sender_display_name: message.senderDisplayName,
    content_type: message.contentType,
    body_text: message.bodyText,
    has_attachments: message.hasAttachments,
    has_voice: message.hasVoice,
    status: message.status,
    is_internal_note: message.isInternalNote,
    is_visible_to_business: message.isVisibleToBusiness,
    is_visible_to_employee: message.isVisibleToEmployee,
    is_visible_to_client: message.isVisibleToClient,
    is_visible_to_relative: message.isVisibleToRelative,
    sent_at: message.sentAt,
    delivered_at: message.deliveredAt,
    reply_to_message_id: message.replyToMessageId,
  };
}
