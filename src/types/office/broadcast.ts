export type BroadcastPriority = 'normal' | 'important' | 'urgent' | 'critical';

export type BroadcastStatus = 'draft' | 'scheduled' | 'sent' | 'archived';

export type BroadcastAudience =
  | 'employees'
  | 'clients'
  | 'internal'
  | 'selected_employees'
  | 'role'
  | 'team'
  | 'location';

export type BroadcastCategoryKey =
  | 'general'
  | 'schedule_change'
  | 'company_info'
  | 'software'
  | 'assignment'
  | 'reminder'
  | 'training'
  | 'quality'
  | 'compliance'
  | 'urgent_info'
  | 'system_outage'
  | 'other';

export const BROADCAST_CATEGORIES: { key: BroadcastCategoryKey; label: string }[] = [
  { key: 'general', label: 'Allgemeine Mitteilung' },
  { key: 'schedule_change', label: 'Dienstplanänderung' },
  { key: 'company_info', label: 'Wichtige Unternehmensinformation' },
  { key: 'software', label: 'Software-Hinweis' },
  { key: 'assignment', label: 'Einsatzbezogene Information' },
  { key: 'reminder', label: 'Erinnerung' },
  { key: 'training', label: 'Schulung / Akademie' },
  { key: 'quality', label: 'Qualitätsmanagement' },
  { key: 'compliance', label: 'Datenschutz / Compliance' },
  { key: 'urgent_info', label: 'Dringende Information' },
  { key: 'system_outage', label: 'Systemstörung' },
  { key: 'other', label: 'Sonstiges' },
];

export const BROADCAST_PRIORITIES: { key: BroadcastPriority; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'important', label: 'Wichtig' },
  { key: 'urgent', label: 'Dringend' },
  { key: 'critical', label: 'Kritisch' },
];

export type BroadcastRecipientFilter = {
  audience: BroadcastAudience;
  roleKeys?: string[];
  teamIds?: string[];
  locationIds?: string[];
  employeeIds?: string[];
  /** Vorbereitet: nur Mitarbeitende mit heutigen Einsätzen */
  todayAssignmentsOnly?: boolean;
};

export type CreateBroadcastInput = {
  title: string;
  body: string;
  category: BroadcastCategoryKey;
  priority: BroadcastPriority;
  allowReplies: boolean;
  requireAcknowledgement: boolean;
  showInEmployeePortal: boolean;
  expiresAt?: string | null;
  recipientFilter?: BroadcastRecipientFilter;
};

export type NotificationBroadcast = {
  id: string;
  tenantId: string;
  createdByUserId: string;
  title: string;
  body: string;
  category: BroadcastCategoryKey;
  categoryLabel: string;
  priority: BroadcastPriority;
  audience: BroadcastAudience;
  allowReplies: boolean;
  requireAcknowledgement: boolean;
  showInEmployeePortal: boolean;
  status: BroadcastStatus;
  sentAt: string | null;
  archivedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  senderDisplayName: string | null;
  recipientCount: number;
  readCount: number;
  acknowledgedCount: number;
};

export type BroadcastRecipientStat = {
  id: string;
  employeeId: string;
  employeeName: string;
  isRead: boolean;
  isAcknowledged: boolean;
  readAt: string | null;
  acknowledgedAt: string | null;
  replyThreadId: string | null;
};

export type BroadcastDetail = NotificationBroadcast & {
  recipients: BroadcastRecipientStat[];
  attachments: BroadcastAttachment[];
};

export type BroadcastAttachment = {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number | null;
};

export type AppNotificationType = 'broadcast' | 'message' | 'system' | 'task' | 'appointment';

export type AppNotification = {
  id: string;
  tenantId: string;
  notificationType: AppNotificationType;
  title: string;
  bodyPreview: string | null;
  priority: BroadcastPriority;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  relatedBroadcastId: string | null;
  relatedThreadId: string | null;
  senderDisplayName: string | null;
  categoryLabel: string | null;
  requireAcknowledgement: boolean;
  allowReplies: boolean;
  isAcknowledged: boolean;
};

export type NotificationCenterTab = 'all' | 'unread' | 'messages' | 'broadcasts' | 'system';
