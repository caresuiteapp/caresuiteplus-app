import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmployeeGroupChat,
  enrichThreadsWithEmployeeGroupParticipants,
  isDirectEmployeeThread,
  isEmployeeGroupChatThread,
  resolveEmployeeGroupParticipantLabel,
} from '@/lib/office/employeeGroupChatService';
import { filterThreadsByAudience } from '@/lib/office/officemessengerfilters';
import { validateEmployeeGroupChatInput, validateCreateThread } from '@/lib/office/messagebusinessrules';
import type { OfficeMessageThread } from '@/types/office/messaging';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

const mockFrom = vi.fn();
const mockUntypedInsert = vi.fn();
const mockParticipantSelect = vi.fn();

vi.mock('@/lib/services/liveServiceGuard', () => ({
  guardServiceTenant: vi.fn(() => null),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
  }),
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
        insert: mockUntypedInsert,
      };
    }
    return { insert: mockUntypedInsert };
  },
}));

vi.mock('@/lib/office/messageservice', () => ({
  createOfficeMessageThread: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      id: 'group-thread-1',
      tenantId: '11111111-1111-1111-1111-111111111111',
      threadType: 'employee_group_office',
      status: 'received',
      priority: 'normal',
      subject: 'Team Nord',
      categoryId: 'cat-1',
      categoryLabel: null,
      clientId: null,
      clientName: null,
      employeeId: null,
      employeeName: null,
      participantName: null,
      employeeParticipantIds: ['emp-1', 'emp-2'],
      memberCount: 2,
      lastMessageAt: '2026-06-18T08:00:00.000Z',
      lastMessagePreview: 'Hallo Team',
      unreadCount: 0,
      archivedAt: null,
      createdAt: '2026-06-18T08:00:00.000Z',
      updatedAt: '2026-06-18T08:00:00.000Z',
    },
    previewData: false,
  }),
}));

function thread(partial: Partial<OfficeMessageThread>): OfficeMessageThread {
  return {
    id: 'thread-1',
    tenantId: TENANT_ID,
    threadType: 'employee_office',
    status: 'open',
    priority: 'normal',
    subject: 'Test',
    categoryId: null,
    categoryLabel: null,
    clientId: null,
    clientName: null,
    employeeId: 'emp-1',
    employeeName: 'Anna Meier',
    participantName: null,
    lastMessageAt: '2026-06-18T08:00:00.000Z',
    lastMessagePreview: 'Test',
    unreadCount: 0,
    archivedAt: null,
    createdAt: '2026-06-18T08:00:00.000Z',
    updatedAt: '2026-06-18T08:00:00.000Z',
    ...partial,
  };
}

describe('employee group chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'emp-1', first_name: 'Anna', last_name: 'Meier' },
                  { id: 'emp-2', first_name: 'Tom', last_name: 'Keller' },
                  { id: 'emp-3', first_name: 'Lisa', last_name: 'Berg' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
    });

    mockUntypedInsert.mockResolvedValue({ error: null });
    mockParticipantSelect.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates group creation requires name and at least two employees', () => {
    expect(validateEmployeeGroupChatInput({ subject: '', employeeIds: ['a', 'b'] }).ok).toBe(false);
    expect(validateEmployeeGroupChatInput({ subject: 'Team Nord', employeeIds: ['a'] }).ok).toBe(false);
    expect(validateEmployeeGroupChatInput({ subject: 'Team Nord', employeeIds: ['a', 'b'] }).ok).toBe(true);
  });

  it('validateCreateThread accepts employee group chats with two or more participant ids', () => {
    expect(
      validateCreateThread({
        threadType: 'employee_group_office',
        employeeParticipantIds: ['emp-1', 'emp-2'],
      }).ok,
    ).toBe(true);
    expect(
      validateCreateThread({
        threadType: 'employee_group_office',
        employeeParticipantIds: ['emp-1'],
      }).ok,
    ).toBe(false);
    expect(
      validateCreateThread({
        threadType: 'employee_group_office',
      }).ok,
    ).toBe(false);
  });

  it('creates employee group chat via office thread service', async () => {
    const result = await createEmployeeGroupChat(
      TENANT_ID,
      {
        subject: 'Team Nord',
        categoryId: 'cat-1',
        employeeIds: ['emp-1', 'emp-2'],
        initialMessage: 'Hallo Team',
      },
      'business_admin',
      'profile-1',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.threadType).toBe('employee_group_office');
      expect(result.data.subject).toBe('Team Nord');
    }
  });

  it('distinguishes direct vs group employee threads in audience filter', () => {
    const threads = [
      thread({ id: 'direct-1', threadType: 'employee_office', employeeId: 'emp-1' }),
      thread({
        id: 'group-1',
        threadType: 'employee_group_office',
        employeeId: null,
        employeeName: null,
        subject: 'Team Nord',
        memberCount: 3,
      }),
      thread({ id: 'client-1', threadType: 'client_office', clientId: 'client-1', employeeId: null }),
    ];

    const employeeThreads = filterThreadsByAudience(threads, 'employees');
    expect(employeeThreads.map((item) => item.id)).toEqual(['direct-1', 'group-1']);
    expect(isDirectEmployeeThread(threads[0]!)).toBe(true);
    expect(isEmployeeGroupChatThread(threads[1]!)).toBe(true);
  });

  it('enriches group threads with tenant-scoped participant names', async () => {
    mockParticipantSelect.mockResolvedValueOnce({
      data: [
        { thread_id: 'group-1', employee_id: 'emp-1', is_active: true },
        { thread_id: 'group-1', employee_id: 'emp-2', is_active: true },
      ],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'emp-1', first_name: 'Anna', last_name: 'Meier' },
                  { id: 'emp-2', first_name: 'Tom', last_name: 'Keller' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: mockParticipantSelect,
            }),
          }),
        }),
      };
    });

    const enriched = await enrichThreadsWithEmployeeGroupParticipants(TENANT_ID, [
      thread({
        id: 'group-1',
        threadType: 'employee_group_office',
        employeeId: null,
        employeeName: null,
        subject: 'Team Nord',
      }),
    ]);

    expect(enriched[0]?.employeeParticipantIds).toEqual(['emp-1', 'emp-2']);
    expect(enriched[0]?.memberCount).toBe(2);
    expect(enriched[0]?.participantName).toBe('Anna Meier · Tom Keller');
  });

  it('formats participant label with overflow count', () => {
    expect(resolveEmployeeGroupParticipantLabel(['Anna Meier', 'Tom Keller', 'Lisa Berg'], 3)).toBe(
      'Anna Meier · Tom Keller · +1',
    );
  });
});
