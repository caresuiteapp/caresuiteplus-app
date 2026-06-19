import type {
  CommunicationPriority,
  CommunicationThreadStatus,
  CommunicationThreadType,
  MessageContentType,
  MessageStatus,
  ThreadListFilter,
} from './communication.types';

export const COMMUNICATION_ACCENT = '#62F3FF';

export const THREAD_TYPE_LABELS: Record<CommunicationThreadType, string> = {
  client: 'Klient:in',
  employee: 'Mitarbeiter:in',
  relative: 'Angehörige:r',
  internal: 'Intern',
  support: 'Support',
  module: 'Modul',
  assignment: 'Einsatz',
  document: 'Dokument',
  invoice: 'Rechnung',
  consultation: 'Beratung',
  course: 'Kurs',
  system: 'System',
};

export const THREAD_STATUS_LABELS: Record<CommunicationThreadStatus, string> = {
  open: 'Offen',
  waiting_for_business: 'Wartet auf Büro',
  waiting_for_portal_user: 'Wartet auf Antwort',
  resolved: 'Erledigt',
  archived: 'Archiviert',
  deleted: 'Gelöscht',
  blocked: 'Blockiert',
};

export const PRIORITY_LABELS: Record<CommunicationPriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
  critical: 'Kritisch',
};

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  draft: 'Entwurf',
  sending: 'Wird gesendet…',
  sent: 'Gesendet',
  delivered: 'Zugestellt',
  read: 'Gelesen',
  failed: 'Fehlgeschlagen',
  edited: 'Bearbeitet',
  deleted: 'Gelöscht',
  archived: 'Archiviert',
};

export const CONTENT_TYPE_LABELS: Record<MessageContentType, string> = {
  text: 'Text',
  voice: 'Sprachnachricht',
  image: 'Bild',
  file: 'Datei',
  mixed: 'Gemischt',
  system: 'System',
  internal_note: 'Interne Notiz',
};

export const THREAD_LIST_FILTERS: { key: ThreadListFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'unread', label: 'Ungelesen' },
  { key: 'client', label: 'Klient:innen' },
  { key: 'employee', label: 'Mitarbeitende' },
  { key: 'relative', label: 'Angehörige' },
  { key: 'internal', label: 'Intern' },
  { key: 'module', label: 'Modulbezogen' },
  { key: 'unassigned', label: 'Nicht zugeordnet' },
  { key: 'archived', label: 'Archiviert' },
  { key: 'deleted', label: 'Gelöscht' },
  { key: 'high_priority', label: 'Hohe Priorität' },
];

export const DEFAULT_EMOJIS = ['👍', '❤️', '✅', '🙏', '👀', '❗', '😊'] as const;

export const QUICK_EMOJIS = ['😊', '👍', '🙏', '✅', '❤️'] as const;

export const VOICE_STORAGE_PATH =
  'tenant/{tenantId}/communication/{threadId}/voice/{messageId}.m4a';

export const ATTACHMENT_STORAGE_PATH =
  'tenant/{tenantId}/threads/{threadId}/attachments/{attachmentId}/{filename}';

export const COMMUNICATION_CONSENT_HINTS = {
  sensitive:
    'Diese Nachricht enthält möglicherweise sensible Informationen.',
  relativeBlocked:
    'Für die Freigabe an Angehörige liegt keine gültige Einwilligung vor.',
  internalNote:
    'Interne Notizen sind nicht im Portal sichtbar.',
  voice:
    'Sprachnachrichten können personenbezogene oder sensible Inhalte enthalten.',
} as const;

export const COMMUNICATION_REALTIME_CHANNELS = {
  threads: (tenantId: string) => `tenant:${tenantId}:communication_threads`,
  messages: (threadId: string) => `thread:${threadId}:messages`,
  typing: (threadId: string) => `thread:${threadId}:typing`,
  reactions: (threadId: string) => `thread:${threadId}:reactions`,
} as const;
