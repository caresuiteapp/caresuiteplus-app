import type { OfficeThreadStatus } from '@/types/office/messaging';

/** DB enum values stored in message_threads.status */
export type DbThreadStatus =
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

const CLOSED_DB_STATUSES = new Set<DbThreadStatus>([
  'resolved',
  'archived',
  'deleted',
  'closed',
]);

const CLOSED_APP_STATUSES = new Set<OfficeThreadStatus>([
  'resolved',
  'archived',
  'closed',
]);

/** Office UI labels (German) */
export const OFFICE_THREAD_STATUS_LABELS: Record<OfficeThreadStatus, string> = {
  open: 'Offen',
  waiting: 'Wartend',
  deleted: 'Gelöscht',
  new: 'Neu',
  received: 'Eingegangen',
  in_progress: 'In Bearbeitung',
  waiting_for_reply: 'Rückfrage offen',
  internal_review: 'Interne Prüfung',
  resolved: 'Erledigt',
  closed: 'Abgeschlossen',
  archived: 'Archiviert',
};

/** Portal-facing labels (German, simplified) */
export const PORTAL_THREAD_STATUS_LABELS: Record<OfficeThreadStatus, string> = {
  open: 'Offen',
  waiting: 'Wartend',
  deleted: 'Gelöscht',
  new: 'Neu',
  received: 'Eingegangen',
  in_progress: 'In Bearbeitung',
  waiting_for_reply: 'Wir melden uns',
  internal_review: 'In Bearbeitung',
  resolved: 'Erledigt',
  closed: 'Abgeschlossen',
  archived: 'Archiviert',
};

export function fromDbThreadStatus(value: string): OfficeThreadStatus {
  switch (value as DbThreadStatus) {
    case 'open':
      return 'received';
    case 'waiting':
      return 'waiting_for_reply';
    case 'new':
    case 'received':
    case 'in_progress':
    case 'waiting_for_reply':
    case 'internal_review':
    case 'resolved':
    case 'closed':
    case 'archived':
      return value as OfficeThreadStatus;
    case 'deleted':
      return 'closed';
    default:
      return 'received';
  }
}

export function toDbThreadStatus(status: OfficeThreadStatus): DbThreadStatus {
  switch (status) {
    case 'new':
      return 'new';
    case 'received':
      return 'received';
    case 'in_progress':
      return 'in_progress';
    case 'waiting_for_reply':
      return 'waiting_for_reply';
    case 'internal_review':
      return 'internal_review';
    case 'resolved':
      return 'resolved';
    case 'closed':
      return 'closed';
    case 'archived':
      return 'archived';
    default:
      return 'received';
  }
}

export function isClosedDbStatus(value: string): boolean {
  return CLOSED_DB_STATUSES.has(value as DbThreadStatus);
}

export function isClosedAppStatus(status: OfficeThreadStatus): boolean {
  return CLOSED_APP_STATUSES.has(status);
}

export function statusChangeSystemMessage(
  oldStatus: OfficeThreadStatus,
  newStatus: OfficeThreadStatus,
): string {
  const oldLabel = OFFICE_THREAD_STATUS_LABELS[oldStatus];
  const newLabel = OFFICE_THREAD_STATUS_LABELS[newStatus];
  return `Status geändert: ${oldLabel} → ${newLabel}`;
}

/** Quick actions shown in context panel */
export const OFFICE_STATUS_ACTIONS: {
  key: OfficeThreadStatus;
  label: string;
}[] = [
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'waiting_for_reply', label: 'Rückfrage offen' },
  { key: 'resolved', label: 'Erledigt' },
  { key: 'closed', label: 'Abschließen' },
];
