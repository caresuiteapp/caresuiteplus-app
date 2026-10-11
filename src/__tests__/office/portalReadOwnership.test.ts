import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ detail: vi.fn(), update: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/office/portalofficemessageservice', () => ({ fetchPortalOfficeThreadDetail: h.detail }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: h.from }) }));
import { markPortalThreadMessagesRead } from '@/lib/office/messagereadservice';
import type { PortalActor } from '@/lib/office/portalofficemessageservice';
const actor: PortalActor = { audience: 'employee', roleKey: 'employee_portal', employeeId: 'employee-a', clientId: null, profileId: 'account-a', displayName: 'Person A' };
beforeEach(() => {
  vi.clearAllMocks();
  h.from.mockImplementation(() => {
    const query = { update: h.update, eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) };
    h.update.mockImplementation(() => query); return query;
  });
});
describe('portal read acknowledgements require an owned thread', () => {
  it.each(['foreign-direct', 'foreign-group', 'deleted-thread'])('never attempts mutations for %s', async (threadId) => {
    h.detail.mockResolvedValue({ ok: false, error: 'Chat nicht gefunden.' });
    expect((await markPortalThreadMessagesRead('tenant-a', threadId, actor)).ok).toBe(false);
    expect(h.detail).toHaveBeenCalledWith('tenant-a', threadId, actor); expect(h.from).not.toHaveBeenCalled(); expect(h.update).not.toHaveBeenCalled();
  });
  it('acknowledges an authorized thread and resets its unread count after authorization', async () => {
    h.detail.mockResolvedValue({ ok: true, data: { id: 'own-thread' } });
    expect((await markPortalThreadMessagesRead('tenant-a', 'own-thread', actor)).ok).toBe(true);
    expect(h.from).toHaveBeenCalledWith('messages'); expect(h.from).toHaveBeenCalledWith('message_threads');
    expect(h.update).toHaveBeenCalledTimes(2);
    expect(h.detail.mock.invocationCallOrder[0]).toBeLessThan(h.update.mock.invocationCallOrder[0]);
  });
});
