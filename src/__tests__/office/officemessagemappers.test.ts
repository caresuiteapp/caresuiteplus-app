import { describe, expect, it } from 'vitest';
import {
  resolveInternalParticipantName,
  resolveOfficeThreadHeaderSubtitle,
  resolveOfficeThreadParticipantName,
} from '@/lib/office/officemessagemappers';
import type { OfficeMessageThread } from '@/types/office/messaging';

const BASE = '2026-06-10T08:00:00.000Z';

function thread(partial: Partial<OfficeMessageThread>): OfficeMessageThread {
  return {
    id: 'thread-1',
    tenantId: 'tenant-1',
    threadType: 'client_office',
    status: 'in_progress',
    priority: 'normal',
    subject: 'Rückmeldung',
    categoryId: null,
    categoryLabel: null,
    clientId: null,
    clientName: null,
    employeeId: null,
    employeeName: null,
    participantName: null,
    assignedToUserId: null,
    assignedToUserName: null,
    assignedAt: null,
    closedAt: null,
    closedByUserId: null,
    participantProfileIds: [],
    lastMessageAt: BASE,
    lastMessagePreview: 'Test',
    unreadCount: 0,
    archivedAt: null,
    createdAt: BASE,
    updatedAt: BASE,
    ...partial,
  };
}

describe('officeMessageMappers participant names', () => {
  it('liefert Klient:innen-Namen für client_office', () => {
    const value = resolveOfficeThreadParticipantName(
      thread({ threadType: 'client_office', clientName: 'Helga Schneider' }),
    );
    expect(value).toBe('Helga Schneider');
  });

  it('liefert Mitarbeitenden-Namen für employee_office', () => {
    const value = resolveOfficeThreadParticipantName(
      thread({ threadType: 'employee_office', employeeName: 'Sandra Meier' }),
    );
    expect(value).toBe('Sandra Meier');
  });

  it('liefert interne Teilnehmernamen für internal', () => {
    const value = resolveOfficeThreadParticipantName(
      thread({ threadType: 'internal', participantName: 'Thomas Keller · Sabine Muster' }),
    );
    expect(value).toBe('Thomas Keller · Sabine Muster');
  });

  it('filtert den aktuellen Nutzer bei internen Chats heraus', () => {
    const names = new Map([
      ['profile-a', 'Thomas Keller'],
      ['profile-b', 'Sabine Muster'],
    ]);
    expect(
      resolveInternalParticipantName(['profile-a', 'profile-b'], names, 'profile-a'),
    ).toBe('Sabine Muster');
  });

  it('baut Untertitel mit Typ, Betreff und Status', () => {
    const subtitle = resolveOfficeThreadHeaderSubtitle(
      thread({ threadType: 'employee_office', subject: 'Rückmeldung' }),
      'In Bearbeitung',
    );
    expect(subtitle).toBe('Mitarbeiter:in · Rückmeldung · Status: In Bearbeitung');
  });
});
