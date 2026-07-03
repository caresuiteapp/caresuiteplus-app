import type { ISODateTime, TenantScopedEntity } from '@/types/core/base';

/** Spec thread types — mapped to DB enum client | employee | employee_group | internal */
export type OfficeThreadType = 'client_office' | 'employee_office' | 'employee_group_office' | 'internal';

export type OfficeThreadStatus =
  | 'open'
  | 'waiting'
  | 'resolved'
  | 'archived'
  | 'deleted'
  | 'new'
  | 'received'
  | 'in_progress'
  | 'waiting_for_reply'
  | 'internal_review'
  | 'closed';

export type OfficeMessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export type OfficeMessageCategoryAudience = 'client' | 'employee' | 'internal' | 'all';

export type OfficeMessageCategory = TenantScopedEntity & {
  key: string;
  label: string;
  audience: OfficeMessageCategoryAudience;
  sortOrder: number;
  isActive: boolean;
};

export type OfficeMessageThread = TenantScopedEntity & {
  threadType: OfficeThreadType;
  status: OfficeThreadStatus;
  priority: OfficeMessagePriority;
  subject: string;
  categoryId: string | null;
  categoryLabel: string | null;
  clientId: string | null;
  clientName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  /** Joined display names for internal thread participants (excluding current user when resolved). */
  participantName: string | null;
  assignedToUserId?: string | null;
  assignedToUserName?: string | null;
  assignedAt?: ISODateTime | null;
  closedAt?: ISODateTime | null;
  closedByUserId?: string | null;
  participantProfileIds?: string[];
  /** Active employee members for employee_group_office threads. */
  employeeParticipantIds?: string[];
  /** Display names aligned with employeeParticipantIds (when enriched). */
  employeeParticipantNames?: string[];
  /** Member count for group chats (includes all active participants). */
  memberCount?: number;
  lastMessageAt: ISODateTime | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  archivedAt: ISODateTime | null;
};

export type OfficeMessageSenderType =
  | 'office_profile'
  | 'client_portal'
  | 'employee_portal'
  | 'system';

export type OfficeMessage = TenantScopedEntity & {
  threadId: string;
  body: string;
  senderType: OfficeMessageSenderType;
  senderProfileId: string | null;
  senderClientId: string | null;
  senderEmployeeId: string | null;
  senderDisplayName: string;
  isInternalNote: boolean;
  isSystemMessage: boolean;
  sentAt: ISODateTime;
  readAt: ISODateTime | null;
  status: 'draft' | 'sent' | 'read' | 'archived' | 'deleted';
};

/** @deprecated Legacy URL param — prefer OfficeMessageAudience + OfficeChatAgeFilter */
export type OfficeInboxFilter =
  | 'inbox'
  | 'clients'
  | 'employees'
  | 'internal'
  | 'closed';

export type OfficeMessageAudience = 'clients' | 'employees' | 'internal';

export type OfficeChatAgeFilter = 'new' | 'current' | 'old';

export type OfficeMessengerView = 'chats' | 'broadcasts';

export type OfficeMessageThreadDetail = OfficeMessageThread & {
  messages: OfficeMessage[];
  canReply: boolean;
  isClosed: boolean;
};

export type CreateOfficeThreadInput = {
  threadType: OfficeThreadType;
  subject: string;
  categoryId?: string | null;
  clientId?: string | null;
  employeeId?: string | null;
  participantProfileIds?: string[];
  /** Required for employee_group_office — at least two unique employee IDs. */
  employeeParticipantIds?: string[];
  initialMessage?: string;
  priority?: OfficeMessagePriority;
};

export type CreateEmployeeGroupChatInput = {
  subject: string;
  categoryId?: string | null;
  employeeIds: string[];
  initialMessage?: string;
  priority?: OfficeMessagePriority;
};
