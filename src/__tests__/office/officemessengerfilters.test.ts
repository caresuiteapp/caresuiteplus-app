import { describe, expect, it } from 'vitest';
import {
  filterThreadsByAudience,
  filterThreadsByChatAge,
  isCurrentChat,
  isNewChat,
  isOldChat,
  parseOfficeChatAgeFilter,
  parseOfficeMessageAudience,
  parseOfficeMessengerView,
} from '@/lib/office/officemessengerfilters';
import type { OfficeMessageThread } from '@/types/office/messaging';

function thread(partial: Partial<OfficeMessageThread> & Pick<OfficeMessageThread, 'threadType'>): OfficeMessageThread {
  return {
    id: partial.id ?? 'thread-1',
    tenantId: partial.tenantId ?? 'tenant-1',
    threadType: partial.threadType,
    status: partial.status ?? 'received',
    priority: partial.priority ?? 'normal',
    subject: partial.subject ?? 'Test',
    categoryId: null,
    categoryLabel: null,
    clientId: null,
    clientName: null,
    employeeId: null,
    employeeName: null,
    participantName: null,
    lastMessageAt: partial.lastMessageAt ?? '2026-06-25T08:00:00.000Z',
    lastMessagePreview: partial.lastMessagePreview ?? 'Hallo',
    unreadCount: partial.unreadCount ?? 0,
    archivedAt: null,
    createdAt: partial.createdAt ?? '2026-06-25T08:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-06-25T08:00:00.000Z',
  };
}

describe('Office Messenger Filters', () => {
  it('teilt Chats in Neue, Aktuelle und Alte auf', () => {
    const threads = [
      thread({ id: 'new-1', threadType: 'employee_office', status: 'received', unreadCount: 2 }),
      thread({ id: 'current-1', threadType: 'employee_office', status: 'in_progress', unreadCount: 0 }),
      thread({ id: 'old-1', threadType: 'employee_office', status: 'closed', unreadCount: 0 }),
    ];

    expect(filterThreadsByChatAge(threads, 'new').map((item) => item.id)).toEqual(['new-1']);
    expect(filterThreadsByChatAge(threads, 'current').map((item) => item.id)).toEqual(['current-1']);
    expect(filterThreadsByChatAge(threads, 'old').map((item) => item.id)).toEqual(['old-1']);
  });

  it('filtert Chats nach Zielgruppe', () => {
    const threads = [
      thread({ id: 'client-1', threadType: 'client_office' }),
      thread({ id: 'employee-1', threadType: 'employee_office' }),
      thread({ id: 'internal-1', threadType: 'internal' }),
    ];

    expect(filterThreadsByAudience(threads, 'clients').map((item) => item.id)).toEqual(['client-1']);
    expect(filterThreadsByAudience(threads, 'employees').map((item) => item.id)).toEqual(['employee-1']);
    expect(filterThreadsByAudience(threads, 'internal').map((item) => item.id)).toEqual(['internal-1']);
  });

  it('parst URL-Parameter rückwärtskompatibel', () => {
    expect(parseOfficeMessageAudience('clients')).toBe('clients');
    expect(parseOfficeMessageAudience('closed')).toBe('employees');
    expect(parseOfficeChatAgeFilter('closed')).toBe('old');
    expect(parseOfficeMessengerView(undefined, 'broadcasts')).toBe('broadcasts');
  });

  it('klassifiziert jeden Thread genau einmal', () => {
    const samples = [
      thread({ status: 'new', unreadCount: 0 }),
      thread({ status: 'received', unreadCount: 1 }),
      thread({ status: 'in_progress', unreadCount: 0 }),
      thread({ status: 'closed', unreadCount: 0 }),
    ];

    for (const sample of samples) {
      const flags = [isNewChat(sample), isCurrentChat(sample), isOldChat(sample)].filter(Boolean);
      expect(flags).toHaveLength(1);
    }
  });
});
