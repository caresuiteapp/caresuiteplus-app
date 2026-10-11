import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ notification: {} as any, notificationError: null as any, receiptError: null as any,
  mutations: [] as { table: string; payload: any }[] }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/office/broadcastauditservice', () => ({ logBroadcastAuditEvent: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: any, table: string) => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: () => Promise.resolve({ data: h.notification, error: null }),
    update: (payload: any) => { h.mutations.push({ table, payload }); return query; },
    then: (resolve: any) => Promise.resolve({ error: table === 'office_notifications' ? h.notificationError : h.receiptError }).then(resolve) };
  return query;
} }));
import { markNotificationRead, acknowledgeBroadcastNotification } from '@/lib/office/notificationservice';
beforeEach(() => {
  vi.clearAllMocks(); h.mutations = []; h.notificationError = null; h.receiptError = null;
  h.notification = { related_broadcast_id: 'broadcast-a', recipient_user_id: null, recipient_employee_id: 'employee-a', metadata: { requireAcknowledgement: true } };
});
describe('employee notification read and acknowledgement persistence', () => {
  it.each(['read', 'ack'] as const)('blocks %s mutations for a different employee recipient', async (action) => {
    h.notification.recipient_employee_id = 'employee-b';
    const result = action === 'read' ? await markNotificationRead('tenant-a', 'notification-a', 'user-a', 'employee-a')
      : await acknowledgeBroadcastNotification('tenant-a', 'notification-a', 'user-a', 'employee-a');
    expect(result.ok).toBe(false); expect(h.mutations).toEqual([]);
  });
  it('marks an employee-addressed notification and its read receipt', async () => {
    expect((await markNotificationRead('tenant-a', 'notification-a', 'user-a', 'employee-a')).ok).toBe(true);
    expect(h.mutations.map((item) => item.table)).toEqual(['office_notifications', 'notification_broadcast_recipients']);
    expect(h.mutations[1].payload.is_read).toBe(true);
  });
  it('returns a failed read receipt as failure so it can be retried', async () => {
    h.receiptError = { message: 'Network unavailable' };
    expect((await markNotificationRead('tenant-a', 'notification-a', 'user-a', 'employee-a')).ok).toBe(false);
  });
  it('does not persist a false acknowledgement when the recipient receipt fails', async () => {
    h.receiptError = { message: 'Network unavailable' };
    expect((await acknowledgeBroadcastNotification('tenant-a', 'notification-a', 'user-a', 'employee-a')).ok).toBe(false);
    expect(h.mutations.map((item) => item.table)).toEqual(['notification_broadcast_recipients']);
    h.receiptError = null;
    expect((await acknowledgeBroadcastNotification('tenant-a', 'notification-a', 'user-a', 'employee-a')).ok).toBe(true);
    expect(h.mutations.at(-1)).toMatchObject({ table: 'office_notifications', payload: { metadata: { isAcknowledged: true } } });
  });
  it('does not report success if final notification confirmation fails after its receipt', async () => {
    h.notificationError = { message: 'Network unavailable' };
    expect((await acknowledgeBroadcastNotification('tenant-a', 'notification-a', 'user-a', 'employee-a')).ok).toBe(false);
    expect(h.mutations.map((item) => item.table)).toEqual(['notification_broadcast_recipients', 'office_notifications']);
  });
});
