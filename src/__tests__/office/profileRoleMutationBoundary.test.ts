import { beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ rpc: vi.fn(), directWrite: vi.fn(), role: { id: 'role' } as { id: string } | null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: f.rpc, from: (table: string) => {
  const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
    maybeSingle: async () => ({ data: f.role, error: null }),
    update: (value: unknown) => { f.directWrite(value); return query; },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  if (!['profiles', 'roles'].includes(table)) throw new Error('Unexpected table');
  return query;
} }) }));
import { updateProfileRoleKey } from '@/lib/supabase/profileRoleBridge';

beforeEach(() => {
  vi.clearAllMocks(); f.role = { id: 'role' };
  f.rpc.mockResolvedValue({ data: { tenant_id: 'tenant', profile_id: 'profile', role_id: 'role' }, error: null });
});
describe('verified role mutation', () => {
  it('uses and verifies the scoped server receipt', async () => {
    expect(await updateProfileRoleKey('tenant', 'profile', 'business_admin')).toEqual({ ok: true, data: undefined });
    expect(f.rpc).toHaveBeenCalledWith('care_security_set_profile_role', { p_tenant: 'tenant', p_profile: 'profile', p_role: 'role' });
    expect(f.directWrite).not.toHaveBeenCalled();
  });
  it('never retries a denied or failing server mutation through direct table access', async () => {
    f.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Denied' } });
    expect((await updateProfileRoleKey('tenant', 'profile', 'business_admin')).ok).toBe(false);
    f.rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'Broken dependency' } });
    expect((await updateProfileRoleKey('tenant', 'profile', 'business_admin')).ok).toBe(false);
    expect(f.directWrite).not.toHaveBeenCalled();
  });
  it('keeps pre-migration compatibility only for an absent RPC', async () => {
    f.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Function absent' } });
    expect((await updateProfileRoleKey('tenant', 'profile', 'business_admin')).ok).toBe(true);
    expect(f.directWrite).toHaveBeenCalledOnce();
  });
  it('reports a missing role or mismatched receipt without an unconfirmed success', async () => {
    f.role = null; expect((await updateProfileRoleKey('tenant', 'profile', 'business_admin')).ok).toBe(false);
    expect(f.rpc).not.toHaveBeenCalled();
    f.role = { id: 'role' }; f.rpc.mockResolvedValue({ data: { tenant_id: 'foreign' }, error: null });
    expect((await updateProfileRoleKey('tenant', 'profile', 'business_admin')).ok).toBe(false);
    expect(f.directWrite).not.toHaveBeenCalled();
  });
});
