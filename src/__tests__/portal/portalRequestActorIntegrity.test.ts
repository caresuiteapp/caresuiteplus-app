import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), profile: vi.fn(), submit: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getUser: h.getUser },
  rpc: h.rpc,
  from: (table: string) => table === 'profiles'
    ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: h.profile }) }) }) }
    : (() => { throw new Error(`Unexpected client-side write: ${table}`); })(),
}) }));
import { createPortalRequest } from '@/lib/portal/assist/portalRequestService';

const input = {
  tenantId: 'tenant', clientId: 'client', portalUserId: 'portal-access-account',
  requestType: 'stammdaten' as const, title: 'Adresse ändern',
};
beforeEach(() => {
  vi.clearAllMocks();
  h.getUser.mockResolvedValue({ data: { user: { id: 'verified-auth-user' } }, error: null });
  h.rpc.mockImplementation(async (name: string,args:Record<string,unknown>) => name==='portal_submit_request'
    ? h.submit(args) : ({ data: name === 'current_tenant_id' ? 'tenant' : 'authenticated-profile', error: null }));
  h.profile.mockResolvedValue({ data: { id: 'authenticated-profile', tenant_id: 'tenant', auth_user_id: 'verified-auth-user' }, error: null });
  h.submit.mockImplementation(async (args:Record<string,unknown>) => ({data:{
    id:args.p_request_id,tenant_id:args.p_tenant_id,client_id:args.p_client_id,portal_user_id:'authenticated-profile',
    request_type:args.p_request_type,title:args.p_title,payload:args.p_payload,
    office_thread_id:'confirmed-thread',office_message_id:'confirmed-message',office_delivered_at:'2026-11-05T09:00:00Z',
  },error:null}));
});

describe('portal request authenticated author', () => {
  it('stores the authenticated profile rather than an access-account foreign key', async () => {
    const result = await createPortalRequest(input);
    expect(result.ok && result.data.portalUserId).toBe('authenticated-profile');
    expect(h.submit).toHaveBeenCalledWith(expect.objectContaining({ p_tenant_id:'tenant',p_client_id:'client' }));
    expect(h.submit.mock.calls[0][0]).not.toHaveProperty('portal_user_id');
  });

  it.each([
    { data: { user: null }, error: null },
    { data: { user: null }, error: { message: 'Session expired' } },
  ])('does not write when authentication cannot be confirmed', async (auth) => {
    h.getUser.mockResolvedValue(auth);
    expect((await createPortalRequest(input)).ok).toBe(false);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: null },
    { data: { id: 'authenticated-profile', tenant_id: 'other-tenant', auth_user_id: 'verified-auth-user' }, error: null },
    { data: { id: 'authenticated-profile', tenant_id: 'tenant', auth_user_id: 'other-auth-user' }, error: null },
    { data: null, error: { message: 'profile unavailable' } },
  ])('does not write when the resolved profile row is missing or belongs to another identity', async (profile) => {
    h.profile.mockResolvedValue(profile);
    expect((await createPortalRequest(input)).ok).toBe(false);
    expect(h.submit).not.toHaveBeenCalled();
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
    expect(h.submit).not.toHaveBeenCalled();
  });

  it('supports an older profile whose id equals the verified auth user without auth_user_id', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'authenticated-profile' } }, error: null });
    h.profile.mockResolvedValue({ data: { id: 'authenticated-profile', tenant_id: 'tenant', auth_user_id: null }, error: null });
    expect((await createPortalRequest(input)).ok).toBe(true);
    expect(h.submit).toHaveBeenCalledOnce();
  });

  it('does not write after a thrown identity lookup', async () => {
    h.getUser.mockRejectedValue(new Error('network unavailable'));
    expect((await createPortalRequest(input)).ok).toBe(false);
    expect(h.submit).not.toHaveBeenCalled();
  });

  it('returns the server receipt without any optional browser-side follow-up writes', async () => {
    const result = await createPortalRequest(input);
    expect(result.ok && result.data.officeThreadId).toBe('confirmed-thread');
    expect(result.ok && result.data.officeDeliveredAt).toBeTruthy();
    expect(h.submit).toHaveBeenCalledTimes(1);
  });

  it.each(['office_thread_id','office_message_id','office_delivered_at'])('does not claim delivery without %s',async field=>{
    const original=h.submit.getMockImplementation()!;
    h.submit.mockImplementation(async(args:Record<string,unknown>)=>{const result=await original(args);return {...result,data:{...result.data,[field]:null}};});
    expect((await createPortalRequest(input)).ok).toBe(false);
  });
  it('keeps the submission ID after a lost network response and reuses it on retry',async()=>{
    h.submit.mockRejectedValueOnce(new Error('network unavailable'));
    expect((await createPortalRequest(input)).ok).toBe(false);
    expect((await createPortalRequest({...input})).ok).toBe(true);
    expect(h.submit.mock.calls[0][0].p_request_id).toBe(h.submit.mock.calls[1][0].p_request_id);
  });
  it('uses a single submission ID for simultaneous clicks and a new one after confirmed completion',async()=>{
    const results=await Promise.all([createPortalRequest(input),createPortalRequest({...input})]);
    expect(results.every(r=>r.ok)).toBe(true);
    expect(h.submit.mock.calls[0][0].p_request_id).toBe(h.submit.mock.calls[1][0].p_request_id);
    await createPortalRequest(input);
    expect(h.submit.mock.calls[2][0].p_request_id).not.toBe(h.submit.mock.calls[0][0].p_request_id);
  });
  it('rejects a receipt for a different client or author',async()=>{
    const original=h.submit.getMockImplementation()!;
    h.submit.mockImplementation(async(args:Record<string,unknown>)=>{const result=await original(args);return {...result,data:{...result.data,client_id:'another-client'}};});
    expect((await createPortalRequest(input)).ok).toBe(false);
  });
});
