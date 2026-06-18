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
    id: 't-internal',
    threadType: 'internal',
    clientId: null,
    clientName: null,
    employeeId: null,
    employeeName: null,
  },
];

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
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

  it('Mitarbeiter:in sieht nur eigene employee_office-Threads', () => {
    const visible = filterThreadsForPortalEmployee(threads, EMPLOYEE_A);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe('t-employee-a');
    expect(visible.every((t) => t.employeeId === EMPLOYEE_A)).toBe(true);
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
});
