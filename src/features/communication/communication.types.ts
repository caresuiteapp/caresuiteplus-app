import type { ISODateTime, TenantScopedEntity } from '@/types/core/base';

export type CommunicationThreadType =
  | 'client'
  | 'employee'
  | 'relative'
  | 'internal'
  | 'support'
  | 'module'
  | 'assignment'
  | 'document'
  | 'invoice'
  | 'consultation'
  | 'course'
  | 'system';

export type CommunicationThreadStatus =
  | 'open'
  | 'waiting_for_business'
  | 'waiting_for_portal_user'
  | 'resolved'
  | 'archived'
  | 'deleted'
  | 'blocked';

export type CommunicationPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

export type CommunicationModuleKey =
  | 'core'
  | 'office'
  | 'assist'
  | 'pflege'
  | 'stationaer'
  | 'beratung'
  | 'akademie'
  | 'ti'
  | null;

export type CommunicationThread = TenantScopedEntity & {
  threadType: CommunicationThreadType;
  status: CommunicationThreadStatus;
  priority: CommunicationPriority;
  subject: string | null;
  title: string;
  previewText: string | null;
  moduleKey: CommunicationModuleKey;
  clientId: string | null;
  employeeId: string | null;
  relativeContactId: string | null;
  assignmentId: string | null;
  documentId: string | null;
  invoiceId: string | null;
  consultationCaseId: string | null;
  courseId: string | null;
  supportTicketId: string | null;
  createdByUserId: string | null;
  createdByPortalSessionId: string | null;
  lastMessageId: string | null;
  lastMessageAt: ISODateTime | null;
  lastMessageByDisplayName: string | null;
  unreadCountBusiness: number;
  unreadCountEmployee: number;
  unreadCountClient: number;
  unreadCountRelative: number;
  isInternalOnly: boolean;
  isPortalVisible: boolean;
  allowClientReplies: boolean;
  allowEmployeeReplies: boolean;
  allowRelativeReplies: boolean;
  archivedAt: ISODateTime | null;
  archivedBy: string | null;
  deletedAt: ISODateTime | null;
  deletedBy: string | null;
};

export type MessageSenderType =
  | 'business_user'
  | 'employee_portal'
  | 'client_portal'
  | 'relative_portal'
  | 'system'
  | 'integration';

export type MessageContentType =
  | 'text'
  | 'voice'
  | 'image'
  | 'file'
  | 'mixed'
  | 'system'
  | 'internal_note';

export type MessageStatus =
  | 'draft'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'edited'
  | 'deleted'
  | 'archived';

export type CommunicationMessage = TenantScopedEntity & {
  threadId: string;
  senderType: MessageSenderType;
  senderUserId: string | null;
  senderPortalSessionId: string | null;
  senderDisplayName: string;
  contentType: MessageContentType;
  bodyText: string | null;
  hasAttachments: boolean;
  hasVoice: boolean;
  emojiReactionsCount: number;
  status: MessageStatus;
  isInternalNote: boolean;
  isVisibleToBusiness: boolean;
  isVisibleToEmployee: boolean;
  isVisibleToClient: boolean;
  isVisibleToRelative: boolean;
  sentAt: ISODateTime | null;
  deliveredAt: ISODateTime | null;
  readAt: ISODateTime | null;
  editedAt: ISODateTime | null;
  editedBy: string | null;
  deletedAt: ISODateTime | null;
  deletedBy: string | null;
  deleteReason: string | null;
  replyToMessageId: string | null;
};

export type ParticipantType =
  | 'business_user'
  | 'employee'
  | 'client'
  | 'relative'
  | 'system'
  | 'support';

export type ParticipantRole = 'owner' | 'admin' | 'member' | 'viewer' | 'portal_user';

export type CommunicationParticipant = TenantScopedEntity & {
  threadId: string;
  participantType: ParticipantType;
  participantId: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: ParticipantRole;
  canRead: boolean;
  canWrite: boolean;
  canUpload: boolean;
  canVoiceMessage: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canAssign: boolean;
  lastReadMessageId: string | null;
  lastReadAt: ISODateTime | null;
  muted: boolean;
  pinned: boolean;
};

export type AttachmentType =
  | 'image'
  | 'pdf'
  | 'document'
  | 'audio'
  | 'voice'
  | 'video'
  | 'other';

export type AttachmentScanStatus = 'pending' | 'safe' | 'blocked' | 'failed';

export type CommunicationAttachment = TenantScopedEntity & {
  threadId: string;
  messageId: string;
  attachmentType: AttachmentType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string | null;
  scanStatus: AttachmentScanStatus;
  durationSeconds: number | null;
  waveformPreview: number[] | null;
  linkedDocumentId: string | null;
  uploadedBy: string | null;
};

export type MessageReaction = TenantScopedEntity & {
  threadId: string;
  messageId: string;
  emoji: string;
  reactedByType: MessageSenderType;
  reactedById: string | null;
  reactedByDisplayName: string;
};

export type MessageAssignmentStatus =
  | 'open'
  | 'in_review'
  | 'assigned'
  | 'rejected'
  | 'needs_clarification'
  | 'archived';

export type MessageAssignmentTargetType =
  | 'client'
  | 'employee'
  | 'assignment'
  | 'document'
  | 'invoice'
  | 'consultation_case'
  | 'course'
  | 'support_ticket'
  | 'internal_task';

export type MessageAssignment = TenantScopedEntity & {
  threadId: string;
  messageId: string | null;
  targetType: MessageAssignmentTargetType;
  targetId: string | null;
  suggestedTargetId: string | null;
  suggestionConfidence: number | null;
  status: MessageAssignmentStatus;
  assignedBy: string | null;
  assignedAt: ISODateTime | null;
};

export type CommunicationReadReceipt = TenantScopedEntity & {
  threadId: string;
  messageId: string;
  readerType: MessageSenderType;
  readerId: string | null;
  readAt: ISODateTime;
};

export type CommunicationNotificationType =
  | 'new_message'
  | 'new_portal_message'
  | 'new_employee_message'
  | 'new_client_message'
  | 'new_relative_message'
  | 'voice_received'
  | 'attachment_received'
  | 'message_failed'
  | 'message_assigned'
  | 'mention'
  | 'unread_reminder'
  | 'high_priority';

export type CommunicationNotification = TenantScopedEntity & {
  type: CommunicationNotificationType;
  threadId: string | null;
  messageId: string | null;
  title: string;
  body: string;
  readAt: ISODateTime | null;
  actionRoute: string | null;
};

export type CommunicationAuditAction =
  | 'thread_created'
  | 'message_sent'
  | 'message_read'
  | 'message_edited'
  | 'message_deleted'
  | 'thread_archived'
  | 'thread_restored'
  | 'attachment_uploaded'
  | 'voice_sent'
  | 'message_assigned'
  | 'participant_added'
  | 'participant_removed'
  | 'visibility_changed'
  | 'portal_message_received'
  | 'consent_blocked'
  | 'permission_blocked'
  | 'export_started';

export type CommunicationAuditEvent = TenantScopedEntity & {
  userId: string | null;
  portalSessionId: string | null;
  action: CommunicationAuditAction;
  entityType: string;
  entityId: string;
  threadId: string | null;
  messageId: string | null;
  clientId: string | null;
  employeeId: string | null;
  result: 'success' | 'blocked' | 'failed';
  metadata: Record<string, unknown> | null;
};

export type CommunicationSettings = TenantScopedEntity & {
  centerEnabled: boolean;
  clientPortalEnabled: boolean;
  employeePortalEnabled: boolean;
  relativePortalEnabled: boolean;
  voiceMessagesEnabled: boolean;
  attachmentsEnabled: boolean;
  emojisEnabled: boolean;
  reactionsEnabled: boolean;
  internalNotesEnabled: boolean;
  autoArchiveMonths: number | null;
  maxFileSizeMb: number;
  allowedFileTypes: string[];
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  realtimeEnabled: boolean;
  showReadReceipts: boolean;
  showTypingIndicator: boolean;
};

export type CommunicationAudience = 'business' | 'employee_portal' | 'client_portal' | 'relative_portal';

export type ThreadListFilter =
  | 'all'
  | 'unread'
  | 'client'
  | 'employee'
  | 'relative'
  | 'internal'
  | 'module'
  | 'unassigned'
  | 'archived'
  | 'deleted'
  | 'high_priority';

export type CommunicationCenterKpis = {
  unread: number;
  openQuestions: number;
  unassigned: number;
  archived: number;
  withAttachments: number;
  failedDeliveries: number;
};

export type ThreadListItem = Pick<
  CommunicationThread,
  | 'id'
  | 'threadType'
  | 'status'
  | 'priority'
  | 'title'
  | 'previewText'
  | 'moduleKey'
  | 'lastMessageAt'
  | 'lastMessageByDisplayName'
  | 'unreadCountBusiness'
  | 'isPortalVisible'
  | 'clientId'
  | 'employeeId'
  | 'assignmentId'
  | 'updatedAt'
> & {
  hasAttachments: boolean;
  participantLabel: string;
};

export type SendMessageInput = {
  threadId: string;
  bodyText: string;
  contentType?: MessageContentType;
  isInternalNote?: boolean;
  replyToMessageId?: string | null;
};

export type CreateThreadInput = {
  threadType: CommunicationThreadType;
  title: string;
  subject?: string | null;
  priority?: CommunicationPriority;
  moduleKey?: CommunicationModuleKey;
  clientId?: string | null;
  employeeId?: string | null;
  relativeContactId?: string | null;
  isInternalOnly?: boolean;
  isPortalVisible?: boolean;
};
