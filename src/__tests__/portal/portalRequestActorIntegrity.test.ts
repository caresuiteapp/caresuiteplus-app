import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getUser: vi.fn(), insert: vi.fn(), history: vi.fn(), activity: vi.fn(), notify: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getUser: h.getUser },
  from: (table: string) => table === 'portal_requests'
    ? { insert: (payload: Record<string, unknown>) => {
      h.insert(payload);
      return { select: () => ({ single: async () => ({ data: { ...payload, id: 'persisted-request' }, error: null }) }) };
    } }
    : { insert: h.history },
}) }));
vi.mock('@/lib/portal/assist/portalActivityService', () => ({ logPortalActivity: h.activity }));
vi.mock('@/lib/portal/assist/portalAssistEvents', () => ({ stubEmployeeNotificationForRequest: h.notify }));
import { createPortalRequest } from '@/lib/portal/assist/portalRequestService';

const input = {
  tenantId: 'tenant', clientId: 'client', portalUserId: 'portal-access-account',
  requestType: 'stammdaten' as const, title: 'Adresse ändern',
};
beforeEach(() => {
  vi.clearAllMocks();
  h.getUser.mockResolvedValue({ data: { user: { id: 'authenticated-profile' } }, error: null });
  h.history.mockResolvedValue({ error: null });
  h.activity.mockResolvedValue(undefined);
  h.notify.mockResolvedValue(undefined);
});

describe('portal request authenticated author', () => {
  it('stores the authenticated profile rather than an access-account foreign key', async () => {
    const result = await createPortalRequest(input);
    expect(result.ok && result.data.portalUserId).toBe('authenticated-profile');
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ portal_user_id: 'authenticated-profile' }));
    expect(h.history).toHaveBeenCalledWith(expect.objectContaining({ changed_by: 'authenticated-profile' }));
    expect(h.activity).toHaveBeenCalledWith(expect.objectContaining({ portalUserId: 'authenticated-profile' }));
  });

  it.each([
    { data: { user: null }, error: null },
    { data: { user: null }, error: { message: 'Session expired' } },
  ])('does not write when authentication cannot be confirmed', async (auth) => {
    h.getUser.mockResolvedValue(auth);
    expect((await createPortalRequest(input)).ok).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it('keeps a confirmed saved request successful when optional follow-up recording rejects', async () => {
    h.history.mockRejectedValue(new Error('history unavailable'));
    h.activity.mockRejectedValue(new Error('activity unavailable'));
    h.notify.mockRejectedValue(new Error('notification unavailable'));
    const result = await createPortalRequest(input);
    expect(result.ok && result.data.id).toBe('persisted-request');
    expect(h.insert).toHaveBeenCalledTimes(1);
  });
});
