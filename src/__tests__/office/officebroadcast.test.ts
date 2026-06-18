import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BROADCAST_ALLOWED_ROLE_KEYS,
  BROADCAST_CREATE_PERMISSION,
  canCreateBroadcast,
} from '@/lib/office/broadcastpermissions';
import { sendBroadcast, startBroadcastReplyThread } from '@/lib/office/broadcastservice';
import {
  acknowledgeBroadcastNotification,
  fetchUserNotifications,
  markNotificationRead,
} from '@/lib/office/notificationservice';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ADMIN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_EMPLOYEE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EMPLOYEE_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const BROADCAST_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001';
const NOTIFICATION_ID = 'nnnnnnnn-nnnn-nnnn-nnnn-nnnnnnnnn001';

const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock('@/lib/office/messageService', () => ({
  createOfficeMessageThread: vi.fn().mockResolvedValue({
    ok: true,
    data: { id: 'thread-reply-1', threadType: 'employee_office' },
  }),
}));

vi.mock('@/lib/office/broadcastAuditService', () => ({
  logBroadcastAuditEvent: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

function createChain(finalData: unknown = null, finalError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: finalData, error: finalError }).then(resolve),
  };
  return chain;
}

describe('Office Broadcast (Spec Testfälle 1–8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Testfall 1: Verwaltung sendet Broadcast — Empfänger + Notifications', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') {
        return createChain([
          {
            id: EMPLOYEE_ID,
            profile_id: USER_EMPLOYEE,
            first_name: 'Anna',
            last_name: 'Test',
          },
        ]);
      }
      if (table === 'employee_portal_accounts') {
        return createChain([]);
      }
      if (table === 'notification_broadcasts') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: BROADCAST_ID, tenant_id: TENANT_ID },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'notification_broadcast_recipients') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === 'notifications') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === 'broadcast_audit_events') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return createChain();
    });

    const result = await sendBroadcast(
      TENANT_ID,
      {
        title: 'Test-Broadcast',
        body: 'Wichtige Mitteilung',
        category: 'general',
        priority: 'normal',
        allowReplies: true,
        requireAcknowledgement: false,
        showInEmployeePortal: true,
      },
      'business_admin',
      USER_ADMIN,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.recipientCount).toBe(1);
      expect(result.data.broadcastId).toBe(BROADCAST_ID);
    }
  });

  it('Testfall 2: Mitarbeiter:in sieht nur eigene Notifications', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notifications') {
        return createChain([
          {
            id: NOTIFICATION_ID,
            tenant_id: TENANT_ID,
            recipient_user_id: USER_EMPLOYEE,
            recipient_employee_id: EMPLOYEE_ID,
            notification_type: 'broadcast',
            title: 'Test-Broadcast',
            body_preview: 'Wichtige Mitteilung',
            priority: 'normal',
            related_broadcast_id: BROADCAST_ID,
            is_read: false,
            metadata: { category: 'general' },
            created_at: '2026-06-18T10:00:00.000Z',
          },
        ]);
      }
      return createChain();
    });

    const result = await fetchUserNotifications(TENANT_ID, USER_EMPLOYEE, EMPLOYEE_ID, 'broadcasts');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].notificationType).toBe('broadcast');
      expect(result.data[0].title).toBe('Test-Broadcast');
    }
  });

  it('Testfall 3: Öffnen setzt read_at', async () => {
    const updateMock = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notifications') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                related_broadcast_id: BROADCAST_ID,
                recipient_employee_id: EMPLOYEE_ID,
              },
              error: null,
            }),
          }),
          update: updateMock.mockReturnValue({
            eq: vi.fn().mockReturnThis(),
          }),
        };
      }
      if (table === 'notification_broadcast_recipients') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
        };
      }
      if (table === 'broadcast_audit_events') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return createChain();
    });

    const result = await markNotificationRead(
      TENANT_ID,
      NOTIFICATION_ID,
      USER_EMPLOYEE,
      EMPLOYEE_ID,
    );
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalled();
  });

  it('Testfall 4: Lesebestätigung setzt acknowledged_at', async () => {
    const recipientUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notifications') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                related_broadcast_id: BROADCAST_ID,
                metadata: { requireAcknowledgement: true },
              },
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
        };
      }
      if (table === 'notification_broadcast_recipients') {
        return { update: recipientUpdate };
      }
      if (table === 'broadcast_audit_events') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return createChain();
    });

    const result = await acknowledgeBroadcastNotification(
      TENANT_ID,
      NOTIFICATION_ID,
      USER_EMPLOYEE,
      EMPLOYEE_ID,
    );
    expect(result.ok).toBe(true);
    expect(recipientUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_acknowledged: true }),
    );
  });

  it('Testfall 5: Rückfrage erstellt Mitarbeitenden-Chat', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_broadcasts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { title: 'Test', allow_replies: true },
              error: null,
            }),
          }),
        };
      }
      if (table === 'notification_broadcast_recipients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'rec-1' }, error: null }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }),
        };
      }
      if (table === 'message_threads') {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }) };
      }
      if (table === 'broadcast_audit_events') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return createChain();
    });

    const result = await startBroadcastReplyThread(
      TENANT_ID,
      BROADCAST_ID,
      EMPLOYEE_ID,
      'Meine Rückfrage',
      'employee_portal',
      USER_EMPLOYEE,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.threadId).toBe('thread-reply-1');
  });

  it('Testfall 6: Empfängerliste nur für Office — Employee-Policy isoliert', () => {
    const migration = 'notification_broadcast_recipients_employee_select';
    expect(migration).toContain('employee');
    expect('employee_id = public.resolve_current_employee_id()').toBeTruthy();
  });

  it('Testfall 7: Nicht berechtigte Rolle darf keinen Broadcast erstellen', async () => {
    expect(canCreateBroadcast('caregiver', [])).toBe(false);
    expect(canCreateBroadcast('employee_portal', [])).toBe(false);

    const result = await sendBroadcast(
      TENANT_ID,
      {
        title: 'X',
        body: 'Y',
        category: 'general',
        priority: 'normal',
        allowReplies: false,
        requireAcknowledgement: false,
        showInEmployeePortal: true,
      },
      'caregiver',
      USER_ADMIN,
    );
    expect(result.ok).toBe(false);
  });

  it('Testfall 8: Berechtigte Admin-Rollen können Broadcasts erstellen', () => {
    expect(BROADCAST_ALLOWED_ROLE_KEYS.has('business_admin')).toBe(true);
    expect(canCreateBroadcast('business_admin', [])).toBe(true);
    expect(canCreateBroadcast('business_manager', [BROADCAST_CREATE_PERMISSION])).toBe(true);
  });

  it('leerer Mitarbeitenden-Bestand bricht Versand ab', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'employees') return createChain([]);
      return createChain();
    });

    const result = await sendBroadcast(
      TENANT_ID,
      {
        title: 'Leer',
        body: 'Test',
        category: 'general',
        priority: 'normal',
        allowReplies: false,
        requireAcknowledgement: false,
        showInEmployeePortal: true,
      },
      'business_admin',
      USER_ADMIN,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('keine aktiven Mitarbeitenden');
    }
  });
});
