import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfficeMessageThread } from '@/types/office/messaging';
import {
  filterPortalVisibleMessages,
  filterThreadsForPortalClient,
  filterThreadsForPortalEmployee,
} from '@/lib/office/messagebusinessrules';
import {
  buildMessageAttachmentPath,
  listMessageAttachments,
} from '@/lib/office/messageattachmentservice';
import {
  fetchPortalOfficeThreads,
  filterThreadsForPortalActor,
  resolvePortalActor,
} from '@/lib/office/portalofficemessageservice';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';
const EMPLOYEE_A = 'employee-a';
const EMPLOYEE_B = 'employee-b';

const baseThread = {
  tenantId: TENANT_ID,
  status: 'received' as const,
  priority: 'normal' as const,
  subject: 'Test',
  categoryId: null,
  categoryLabel: null,
  assignedToUserId: null,
  assignedToUserName: null,
  assignedAt: null,
  closedAt: null,
  closedByUserId: null,
  participantProfileIds: [] as string[],
  participantName: null as string | null,
  lastMessageAt: null,
  lastMessagePreview: null,
  unreadCount: 0,
  archivedAt: null,
  createdAt: '2026-06-10T08:00:00.000Z',
  updatedAt: '2026-06-10T08:00:00.000Z',
};

const threads: OfficeMessageThread[] = [
  {
    ...baseThread,
    id: 't-client-a',
    threadType: 'client_office',
    clientId: CLIENT_A,
    clientName: 'Anna',
    employeeId: null,
    employeeName: null,
  },
  {
    ...baseThread,
    id: 't-client-b',
    threadType: 'client_office',
    clientId: CLIENT_B,
    clientName: 'Bernd',
    employeeId: null,
    employeeName: null,
  },
  {
    ...baseThread,
    id: 't-employee-a',
    threadType: 'employee_office',
    clientId: null,
    clientName: null,
    employeeId: EMPLOYEE_A,
    employeeName: 'Clara',
  },
  {
    ...baseThread,
    id: 't-group-ab',
    threadType: 'employee_group_office',
    clientId: null,
    clientName: null,
    employeeId: null,
    employeeName: null,
    subject: 'Team Nord',
    employeeParticipantIds: [EMPLOYEE_A, EMPLOYEE_B],
    memberCount: 2,
    lastMessagePreview: 'Hallo Team',
  },
  {
    ...baseThread,
    id: 't-group-b-only',
    threadType: 'employee_group_office',
    clientId: null,
    clientName: null,
    employeeId: null,
    employeeName: null,
    subject: 'Team Süd',
    employeeParticipantIds: [EMPLOYEE_B],
    memberCount: 1,
  },
  {
    ...baseThread,
    id: 't-internal',
    threadType: 'internal',
    clientId: null,
    clientName: null,
    employeeId: null,
    employeeName: null,
  },
];

const mockFrom = vi.fn();
const mockParticipantSelect = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    if (table === 'message_thread_employee_participants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: mockParticipantSelect,
            }),
          }),
        }),
      };
    }
    return { select: vi.fn() };
  },
}));

function createQueryChain(finalData: unknown = [], finalError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: finalData, error: finalError }).then(resolve),
  };
  return chain;
}

describe('Portal Office Messaging Phase 2B', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    mockFrom.mockImplementation((table: string) => {
      if (table === 'message_categories') {
        return createQueryChain([
          {
            id: 'cat-1',
            tenant_id: TENANT_ID,
            key: 'general',
            label: 'Allgemein',
            audience: 'client',
            sort_order: 1,
            is_active: true,
            created_at: '2026-06-10T08:00:00.000Z',
            updated_at: '2026-06-10T08:00:00.000Z',
          },
        ]);
      }
      if (table === 'message_threads') {
        return createQueryChain(
          threads.map((thread) => ({
            id: thread.id,
            tenant_id: thread.tenantId,
            thread_type:
              thread.threadType === 'client_office'
                ? 'client'
                : thread.threadType === 'employee_office'
                  ? 'employee'
                  : 'internal',
            status: 'received',
            priority: thread.priority,
            subject: thread.subject,
            category_id: thread.categoryId,
            client_id: thread.clientId,
            employee_id: thread.employeeId,
            last_message_at: thread.lastMessageAt,
            last_message_preview: thread.lastMessagePreview,
            created_at: thread.createdAt,
            updated_at: thread.updatedAt,
            office_unread_count: 0,
          })),
        );
      }
      if (table === 'message_attachments') {
        return createQueryChain([]);
      }
      return createQueryChain([]);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('Klient:in sieht nur eigene client_office-Threads', () => {
    const visible = filterThreadsForPortalClient(threads, CLIENT_A);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe('t-client-a');
    expect(visible.every((t) => t.clientId === CLIENT_A)).toBe(true);
  });

  it('Mitarbeiter:in sieht eigene 1:1-Chats und keine fremden', () => {
    const visible = filterThreadsForPortalEmployee(threads, EMPLOYEE_A);
    const directOnly = visible.filter((t) => t.threadType === 'employee_office');
    expect(directOnly).toHaveLength(1);
    expect(directOnly[0]?.id).toBe('t-employee-a');
    expect(directOnly.every((t) => t.employeeId === EMPLOYEE_A)).toBe(true);
  });

  it('Mitarbeiter:in sieht Gruppen-Chats nur als Mitglied', () => {
    const visibleA = filterThreadsForPortalEmployee(threads, EMPLOYEE_A);
    const visibleB = filterThreadsForPortalEmployee(threads, EMPLOYEE_B);

    expect(visibleA.some((t) => t.id === 't-group-ab')).toBe(true);
    expect(visibleA.some((t) => t.id === 't-group-b-only')).toBe(false);
    expect(visibleB.some((t) => t.id === 't-group-ab')).toBe(true);
    expect(visibleB.some((t) => t.id === 't-group-b-only')).toBe(true);
  });

  it('filterThreadsForPortalActor schließt fremde Gruppen und interne Chats aus', () => {
    const actorResult = resolvePortalActor('employee_portal', {
      sessionToken: 'tok',
      tenantId: TENANT_ID,
      loginType: 'employee_portal',
      roleKey: 'employee_portal',
      expiresAt: '2099-01-01T00:00:00.000Z',
      accountId: 'acc-emp-a',
      employeeId: EMPLOYEE_A,
    });
    expect(actorResult.ok).toBe(true);
    if (!actorResult.ok) return;

    const visible = filterThreadsForPortalActor(threads, actorResult.data);
    expect(visible.map((t) => t.id).sort()).toEqual(['t-employee-a', 't-group-ab'].sort());
    expect(visible.every((t) => t.threadType !== 'internal')).toBe(true);
  });

  it('filterThreadsForPortalActor schließt fremde und interne Chats aus', () => {
    const actorResult = resolvePortalActor('client_portal', {
      sessionToken: 'tok',
      tenantId: TENANT_ID,
      loginType: 'client_portal',
      roleKey: 'client_portal',
      expiresAt: '2099-01-01T00:00:00.000Z',
      accountId: 'acc-1',
      clientId: CLIENT_A,
    });
    expect(actorResult.ok).toBe(true);
    if (!actorResult.ok) return;

    const visible = filterThreadsForPortalActor(threads, actorResult.data);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.threadType).toBe('client_office');
  });

  it('Interne Notizen sind im Portal nicht sichtbar', () => {
    const messages = [
      {
        id: 'm1',
        tenantId: TENANT_ID,
        threadId: 't-client-a',
        body: 'Sichtbar',
        senderType: 'client_portal' as const,
        senderProfileId: null,
        senderClientId: CLIENT_A,
        senderEmployeeId: null,
        senderDisplayName: 'Anna',
        isInternalNote: false,
        isSystemMessage: false,
        sentAt: '2026-06-10T08:00:00.000Z',
        readAt: null,
        status: 'sent' as const,
        createdAt: '2026-06-10T08:00:00.000Z',
        updatedAt: '2026-06-10T08:00:00.000Z',
      },
      {
        id: 'm2',
        tenantId: TENANT_ID,
        threadId: 't-client-a',
        body: 'Intern',
        senderType: 'office_profile' as const,
        senderProfileId: 'p1',
        senderClientId: null,
        senderEmployeeId: null,
        senderDisplayName: 'Office',
        isInternalNote: true,
        isSystemMessage: false,
        sentAt: '2026-06-10T08:00:00.000Z',
        readAt: null,
        status: 'sent' as const,
        createdAt: '2026-06-10T08:00:00.000Z',
        updatedAt: '2026-06-10T08:00:00.000Z',
      },
    ];
    const portalVisible = filterPortalVisibleMessages(messages);
    expect(portalVisible).toHaveLength(1);
    expect(portalVisible[0]?.isInternalNote).toBe(false);
  });

  it('Anhang-Pfad folgt tenant/threads-Policy', () => {
    const path = buildMessageAttachmentPath(TENANT_ID, 'thread-1', 'att-1', 'dokument.pdf');
    expect(path).toBe(`tenant/${TENANT_ID}/threads/thread-1/att-1/dokument.pdf`);
  });

  it('listMessageAttachments lädt aus message_attachments', async () => {
    const result = await listMessageAttachments(TENANT_ID, 'msg-1', 'business_admin');
    expect(result.ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('message_attachments');
  });

  it('fetchPortalOfficeThreads filtert nach clientId über Live-Query', async () => {
    const actorResult = resolvePortalActor('client_portal', {
      sessionToken: 'tok',
      tenantId: TENANT_ID,
      loginType: 'client_portal',
      roleKey: 'client_portal',
      expiresAt: '2099-01-01T00:00:00.000Z',
      accountId: 'acc-1',
      clientId: CLIENT_A,
    });
    expect(actorResult.ok).toBe(true);
    if (!actorResult.ok) return;

    const result = await fetchPortalOfficeThreads(TENANT_ID, actorResult.data, 'open');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.every((t) => t.clientId === CLIENT_A)).toBe(true);
      expect(result.data.every((t) => t.threadType === 'client_office')).toBe(true);
    }
  });

  it('fetchPortalOfficeThreads liefert Gruppen-Chat für Mitglied mit UI-Metadaten', async () => {
    mockParticipantSelect.mockResolvedValueOnce({
      data: [
        { thread_id: 't-group-ab', employee_id: EMPLOYEE_A, is_active: true },
        { thread_id: 't-group-ab', employee_id: EMPLOYEE_B, is_active: true },
      ],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'message_categories') {
        return createQueryChain([
          {
            id: 'cat-1',
            tenant_id: TENANT_ID,
            key: 'general',
            label: 'Allgemein',
            audience: 'employee',
            sort_order: 1,
            is_active: true,
            created_at: '2026-06-10T08:00:00.000Z',
            updated_at: '2026-06-10T08:00:00.000Z',
          },
        ]);
      }
      if (table === 'message_threads') {
        return createQueryChain([
          {
            id: 't-group-ab',
            tenant_id: TENANT_ID,
            thread_type: 'employee_group',
            status: 'received',
            priority: 'normal',
            subject: 'Team Nord',
            category_id: null,
            client_id: null,
            employee_id: null,
            last_message_at: '2026-06-18T08:00:00.000Z',
            last_message_preview: 'Hallo Team',
            created_at: '2026-06-18T08:00:00.000Z',
            updated_at: '2026-06-18T08:00:00.000Z',
            portal_unread_count: 0,
          },
        ]);
      }
      if (table === 'employees') {
        return createQueryChain([
          { id: EMPLOYEE_A, first_name: 'Clara', last_name: 'Meier' },
          { id: EMPLOYEE_B, first_name: 'Tom', last_name: 'Keller' },
        ]);
      }
      return createQueryChain([]);
    });

    const actorResult = resolvePortalActor('employee_portal', {
      sessionToken: 'tok',
      tenantId: TENANT_ID,
      loginType: 'employee_portal',
      roleKey: 'employee_portal',
      expiresAt: '2099-01-01T00:00:00.000Z',
      accountId: 'acc-emp-a',
      employeeId: EMPLOYEE_A,
    });
    expect(actorResult.ok).toBe(true);
    if (!actorResult.ok) return;

    const result = await fetchPortalOfficeThreads(TENANT_ID, actorResult.data, 'open');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.threadType).toBe('employee_group_office');
      expect(result.data[0]?.subject).toBe('Team Nord');
      expect(result.data[0]?.memberCount).toBe(2);
    }
  });
});
