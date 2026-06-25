import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyOfficeMessageNavBadgeRouteOverrides,
  buildOfficeMessageNavBadges,
  collectOfficeMessageNavSeenThreadIds,
  computeOfficeMessageNavBadgeCounts,
  resolveOfficeMessageNavRouteContext,
  resolveOfficeMessageNavBadgeContext,
  resolveOfficeMessageNavBadge,
} from '@/lib/office/officeMessageNavBadges';
import { resetOfficeMessageNavBadgeSeenStore } from '@/lib/office/officeMessageNavBadgeSeenStore';
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

describe('Office message nav badges', () => {
  beforeEach(() => {
    resetOfficeMessageNavBadgeSeenStore();
  });

  it('zählt neue Chats gesamt und pro Zielgruppe', () => {
    const threads = [
      thread({ id: 'client-new', threadType: 'client_office', status: 'received', unreadCount: 1 }),
      thread({ id: 'employee-new', threadType: 'employee_office', status: 'new', unreadCount: 0 }),
      thread({ id: 'internal-new', threadType: 'internal', status: 'received', unreadCount: 2 }),
      thread({ id: 'employee-current', threadType: 'employee_office', status: 'in_progress', unreadCount: 0 }),
    ];

    expect(computeOfficeMessageNavBadgeCounts(threads)).toEqual({
      total: 3,
      clients: 1,
      employees: 1,
      internal: 1,
    });
  });

  it('ignoriert bereits gesehene Threads in der Session', () => {
    const threads = [
      thread({ id: 'client-new', threadType: 'client_office', status: 'received', unreadCount: 1 }),
      thread({ id: 'employee-new', threadType: 'employee_office', status: 'new', unreadCount: 0 }),
    ];

    const seen = new Set(['client-new']);
    expect(computeOfficeMessageNavBadgeCounts(threads, seen)).toEqual({
      total: 1,
      clients: 0,
      employees: 1,
      internal: 0,
    });
  });

  it('blendet Badges für aktive Nav-Keys auf der Route aus', () => {
    const counts = { total: 2, clients: 1, employees: 1, internal: 0 };
    const hidden = applyOfficeMessageNavBadgeRouteOverrides(counts, new Set(['messages', 'messages-clients']));

    expect(hidden).toEqual({ total: 0, clients: 0, employees: 1, internal: 0 });
  });

  it('leitet Nav-Kontext aus Messenger-Route ab', () => {
    expect(
      resolveOfficeMessageNavRouteContext('/office/messages', { audience: 'clients', view: 'chats' }),
    ).toEqual({
      activeNavKeys: ['messages', 'messages-clients'],
      seenAudiences: ['clients'],
    });

    expect(
      resolveOfficeMessageNavRouteContext('/office/messages', { audience: 'employees', view: 'broadcasts' }),
    ).toEqual({
      activeNavKeys: ['messages'],
      seenAudiences: [],
    });

    expect(resolveOfficeMessageNavRouteContext('/office/messages/templates', {})).toBeNull();
  });

  it('bevorzugt In-App-Messenger-Ansicht vor URL-Parametern', () => {
    expect(
      resolveOfficeMessageNavBadgeContext(
        '/office/messages',
        { audience: 'employees', view: 'chats' },
        { audience: 'clients', view: 'chats' },
      ),
    ).toEqual({
      activeNavKeys: ['messages', 'messages-clients'],
      seenAudiences: ['clients'],
    });
  });

  it('sammelt Thread-IDs für markierte Zielgruppen', () => {
    const threads = [
      thread({ id: 'client-new', threadType: 'client_office', status: 'received', unreadCount: 1 }),
      thread({ id: 'employee-new', threadType: 'employee_office', status: 'new', unreadCount: 0 }),
    ];

    expect(collectOfficeMessageNavSeenThreadIds(threads, ['clients'])).toEqual(['client-new']);
  });

  it('liefert deutsche Badge-Labels für Nav-Keys', () => {
    const counts = { total: 3, clients: 1, employees: 2, internal: 0 };

    expect(resolveOfficeMessageNavBadge('messages', counts)).toBe('3 Neu');
    expect(resolveOfficeMessageNavBadge('messages-clients', counts)).toBe('1 Neu');
    expect(resolveOfficeMessageNavBadge('messages-employees', counts)).toBe('2 Neu');
    expect(resolveOfficeMessageNavBadge('messages-internal', counts)).toBeUndefined();
    expect(resolveOfficeMessageNavBadge('broadcasts', counts)).toBeUndefined();
  });

  it('baut Nav-Badge-Map für Office-Kommunikation', () => {
    const badges = buildOfficeMessageNavBadges({ total: 2, clients: 0, employees: 2, internal: 0 });

    expect(badges.messages).toBe('2 Neu');
    expect(badges['messages-employees']).toBe('2 Neu');
    expect(badges['messages-clients']).toBeUndefined();
  });
});
