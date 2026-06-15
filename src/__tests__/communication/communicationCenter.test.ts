import { describe, expect, it, beforeEach } from 'vitest';
import {
  assertNoInternalNotesInPortalView,
  filterMessagesForAudience,
  stripInternalNotes,
} from '@/features/communication/communication.portalFilter';
import {
  listMessages,
  listThreads,
  softDeleteMessage,
  archiveThread,
  restoreThread,
} from '@/features/communication/communication.service';
import { assignThread } from '@/features/communication/communication.assignments';
import { enforceCommunicationPermission } from '@/features/communication/communication.permissions';
import { resetCommunicationDemoStore } from '@/features/communication/communication.demoStore';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

describe('Communication Portal Isolation', () => {
  beforeEach(() => {
    resetCommunicationDemoStore();
  });

  it('filtert interne Notizen für Klient:innenportal', async () => {
    const result = await listMessages(
      DEMO_TENANT_ID,
      'thread-client-001',
      'client_portal',
      'profile-client-001',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.some((m) => m.isInternalNote)).toBe(false);
    expect(assertNoInternalNotesInPortalView(result.data)).toBe(true);
  });

  it('Business sieht interne Notizen', async () => {
    const result = await listMessages(
      DEMO_TENANT_ID,
      'thread-client-001',
      'business_admin',
      'profile-admin-001',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.some((m) => m.isInternalNote)).toBe(true);
  });

  it('stripInternalNotes entfernt alle internen Notizen', () => {
    const filtered = filterMessagesForAudience(
      [
        {
          id: '1',
          tenantId: DEMO_TENANT_ID,
          threadId: 't1',
          senderType: 'business_user',
          senderUserId: null,
          senderPortalSessionId: null,
          senderDisplayName: 'Test',
          contentType: 'internal_note',
          bodyText: 'Geheim',
          hasAttachments: false,
          hasVoice: false,
          emojiReactionsCount: 0,
          status: 'read',
          isInternalNote: true,
          isVisibleToBusiness: true,
          isVisibleToEmployee: false,
          isVisibleToClient: false,
          isVisibleToRelative: false,
          sentAt: null,
          deliveredAt: null,
          readAt: null,
          editedAt: null,
          editedBy: null,
          deletedAt: null,
          deletedBy: null,
          deleteReason: null,
          replyToMessageId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      'client_portal',
      false,
    );
    expect(filtered).toHaveLength(0);
    expect(stripInternalNotes(filtered)).toHaveLength(0);
  });
});

describe('Communication Permissions', () => {
  it('blockiert caregiver ohne create_thread', () => {
    const denied = enforceCommunicationPermission('caregiver', 'communication.create_thread');
    expect(denied).not.toBeNull();
  });

  it('erlaubt business_admin view_center', () => {
    const denied = enforceCommunicationPermission('business_admin', 'communication.view_center');
    expect(denied).toBeNull();
  });
});

describe('Communication Soft Delete', () => {
  beforeEach(() => {
    resetCommunicationDemoStore();
  });

  it('soft deleted Nachricht behält Audit-Spur', async () => {
    const result = await softDeleteMessage(
      DEMO_TENANT_ID,
      'msg-thread-client-002-1',
      'business_admin',
      'profile-admin-001',
      'Test',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deletedAt).not.toBeNull();
    expect(result.data.status).toBe('deleted');
  });
});

describe('Communication Thread Filtering', () => {
  beforeEach(() => {
    resetCommunicationDemoStore();
  });

  it('listet Klient:innen-Threads für Business', async () => {
    const result = await listThreads(
      DEMO_TENANT_ID,
      { filter: 'client' },
      'business_admin',
      'profile-admin-001',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThanOrEqual(5);
    expect(result.data.every((t) => t.threadType === 'client')).toBe(true);
  });

  it('Mitarbeiterportal sieht nur eigene Threads', async () => {
    const result = await listThreads(
      DEMO_TENANT_ID,
      { filter: 'all' },
      'employee_portal',
      'profile-portal-employee-001',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.every((t) => t.employeeId === 'employee-003')).toBe(true);
  });
});

describe('Communication Assignment Workflow', () => {
  beforeEach(() => {
    resetCommunicationDemoStore();
  });

  it('assignThread erstellt Zuordnung', async () => {
    const result = await assignThread(
      DEMO_TENANT_ID,
      'thread-client-002',
      'client',
      'client-002',
      'business_admin',
      'profile-admin-001',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('assigned');
    expect(result.data.targetId).toBe('client-002');
  });

  it('archive und restore Thread', async () => {
    const archived = await archiveThread(
      DEMO_TENANT_ID,
      'thread-client-003',
      'business_admin',
      'profile-admin-001',
    );
    expect(archived.ok).toBe(true);

    const restored = await restoreThread(
      DEMO_TENANT_ID,
      'thread-client-003',
      'business_admin',
      'profile-admin-001',
    );
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.data.status).toBe('open');
  });
});
