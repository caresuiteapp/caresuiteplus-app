import type {
  OfficeChatAgeFilter,
  OfficeMessageAudience,
  OfficeMessageThread,
  OfficeMessengerView,
} from '@/types/office/messaging';
import { isClosedAppStatus } from '@/lib/office/messagestatuslabels';

export const OFFICE_MESSAGE_AUDIENCES: { key: OfficeMessageAudience; label: string }[] = [
  { key: 'employees', label: 'Mitarbeitende' },
  { key: 'clients', label: 'Klient:innen' },
  { key: 'internal', label: 'Intern' },
];

export const OFFICE_CHAT_AGE_FILTERS: { key: OfficeChatAgeFilter; label: string }[] = [
  { key: 'new', label: 'Neue' },
  { key: 'current', label: 'Aktuelle' },
  { key: 'old', label: 'Alte' },
];

export const OFFICE_MESSENGER_VIEWS: { key: OfficeMessengerView; label: string }[] = [
  { key: 'chats', label: 'Chats' },
  { key: 'broadcasts', label: 'Broadcasts' },
];

export const OFFICE_AUDIENCE_LABELS: Record<OfficeMessageAudience, string> = {
  employees: 'Mitarbeitende',
  clients: 'Klient:innen',
  internal: 'Intern',
};

export const OFFICE_BROADCAST_AUDIENCE_LABELS: Record<OfficeMessageAudience, string> = {
  employees: 'Alle Mitarbeitenden',
  clients: 'Alle Klient:innen',
  internal: 'Verwaltung, Leitung & Geschäftsführung',
};

export function threadAudience(thread: OfficeMessageThread): OfficeMessageAudience {
  switch (thread.threadType) {
    case 'client_office':
      return 'clients';
    case 'employee_office':
      return 'employees';
    case 'internal':
      return 'internal';
  }
}

export function isNewChat(thread: OfficeMessageThread): boolean {
  if (isClosedAppStatus(thread.status)) return false;
  return (
    thread.unreadCount > 0 ||
    thread.status === 'new' ||
    thread.status === 'received'
  );
}

export function isOldChat(thread: OfficeMessageThread): boolean {
  return isClosedAppStatus(thread.status);
}

export function isCurrentChat(thread: OfficeMessageThread): boolean {
  return !isOldChat(thread) && !isNewChat(thread);
}

export function filterThreadsByAudience(
  threads: OfficeMessageThread[],
  audience: OfficeMessageAudience,
): OfficeMessageThread[] {
  return threads.filter((thread) => threadAudience(thread) === audience);
}

export function filterThreadsByChatAge(
  threads: OfficeMessageThread[],
  chatAge: OfficeChatAgeFilter,
): OfficeMessageThread[] {
  switch (chatAge) {
    case 'new':
      return threads.filter(isNewChat);
    case 'current':
      return threads.filter(isCurrentChat);
    case 'old':
      return threads.filter(isOldChat);
  }
}

export function parseOfficeMessageAudience(value: unknown): OfficeMessageAudience {
  if (value === 'clients' || value === 'employees' || value === 'internal') {
    return value;
  }
  if (value === 'inbox' || value === 'closed') return 'employees';
  return 'employees';
}

export function parseOfficeChatAgeFilter(value: unknown): OfficeChatAgeFilter {
  if (value === 'new' || value === 'current' || value === 'old') return value;
  if (value === 'closed') return 'old';
  return 'new';
}

export function parseOfficeMessengerView(value: unknown, tab?: unknown): OfficeMessengerView {
  if (value === 'chats' || value === 'broadcasts') return value;
  if (tab === 'broadcasts') return 'broadcasts';
  return 'chats';
}

export function newChatModeForAudience(
  audience: OfficeMessageAudience,
): 'client' | 'employee' | 'internal' {
  switch (audience) {
    case 'clients':
      return 'client';
    case 'employees':
      return 'employee';
    case 'internal':
      return 'internal';
  }
}

export function emptyChatMessage(audience: OfficeMessageAudience, chatAge: OfficeChatAgeFilter): string {
  const audienceLabel = OFFICE_AUDIENCE_LABELS[audience];
  switch (chatAge) {
    case 'new':
      return `Keine neuen ${audienceLabel}-Chats.`;
    case 'current':
      return `Keine aktuellen ${audienceLabel}-Chats.`;
    case 'old':
      return `Keine abgeschlossenen ${audienceLabel}-Chats.`;
  }
}
