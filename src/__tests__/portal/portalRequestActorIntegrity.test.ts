import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), profile: vi.fn(), insert: vi.fn(), history: vi.fn(), activity: vi.fn(), notify: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getUser: h.getUser },
  rpc: h.rpc,
  from: (table: string) => table === 'profiles'
    ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: h.profile }) }) }) }
    : table === 'portal_requests'
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
  h.getUser.mockResolvedValue({ data: { user: { id: 'verified-auth-user' } }, error: null });
  h.rpc.mockImplementation(async (name: string) => ({ data: name === 'current_tenant_id' ? 'tenant' : 'authenticated-profile', error: null }));
  h.profile.mockResolvedValue({ data: { id: 'authenticated-profile', tenant_id: 'tenant', auth_user_id: 'verified-auth-user' }, error: null });
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

  it.each([
    { data: null, error: null },
    { data: { id: 'authenticated-profile', tenant_id: 'other-tenant', auth_user_id: 'verified-auth-user' }, error: null },
    { data: { id: 'authenticated-profile', tenant_id: 'tenant', auth_user_id: 'other-auth-user' }, error: null },
    { data: null, error: { message: 'profile unavailable' } },
  ])('does not write when the resolved profile row is missing or belongs to another identity', async (profile) => {
    h.profile.mockResolvedValue(profile);
    expect((await createPortalRequest(input)).ok).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.history).not.toHaveBeenCalled();
    expect(h.activity).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'resolve_current_profile_id', data: null, error: null },
    { name: 'resolve_current_profile_id', data: 'authenticated-profile', error: { message: 'unavailable' } },
    { name: 'current_tenant_id', data: 'other-tenant', error: null },
    { name: 'current_tenant_id', data: null, error: { message: 'unavailable' } },
  ])('does not write when canonical identity cannot be resolved', async (failure) => {
    h.rpc.mockImplementation(async (name: string) => name === failure.name
      ? { data: failure.data, error: failure.error }
      : { data: name === 'current_tenant_id' ? 'tenant' : 'authenticated-profile', error: null });
    expect((await createPortalRequest(input)).ok).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it('supports an older profile whose id equals the verified auth user without auth_user_id', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'authenticated-profile' } }, error: null });
    h.profile.mockResolvedValue({ data: { id: 'authenticated-profile', tenant_id: 'tenant', auth_user_id: null }, error: null });
    expect((await createPortalRequest(input)).ok).toBe(true);
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ portal_user_id: 'authenticated-profile' }));
  });

  it('does not write after a thrown identity lookup', async () => {
    h.getUser.mockRejectedValue(new Error('network unavailable'));
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
