import type { ISODateTime, TenantScopedEntity } from '@/types/core/base';

/** Spec thread types — mapped to DB enum client | employee | internal */
export type OfficeThreadType = 'client_office' | 'employee_office' | 'internal';

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

export type OfficeInboxFilter =
  | 'inbox'
  | 'clients'
  | 'employees'
  | 'internal'
  | 'closed';

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
  initialMessage?: string;
  priority?: OfficeMessagePriority;
};
