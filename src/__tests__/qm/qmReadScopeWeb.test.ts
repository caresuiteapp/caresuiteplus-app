import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), resolveProfile: vi.fn(),
  profile: null as Record<string, unknown> | null,
  overrides: [] as { permission_key: string }[], overrideError: null as unknown,
}));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getSession: mocks.getSession, getUser: mocks.getUser }, rpc: mocks.rpc,
}) }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: mocks.resolveProfile }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    const builder = {
      select: () => builder, eq: () => builder,
      maybeSingle: () => Promise.resolve({ data: mocks.profile, error: null }),
      then: (resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve({ data: table === 'role_permission_sets' ? mocks.overrides : mocks.profile, error: mocks.overrideError }).then(resolve, reject),
    };
    return builder;
  },
}));

import { confirmQmReadScope, type QmReadScope } from '@/lib/qm/confirmQmReadScope.web';

const scope: QmReadScope = {
  tenantId: 'tenant-current', profileId: 'profile-independent', authUserId: 'auth-user-separate',
  roleKey: 'business_admin', accessToken: 'current-token', expiresAt: null,
};
const nativeSession = { data: { session: { access_token: scope.accessToken, user: { id: scope.authUserId } } }, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(nativeSession);
  mocks.getUser.mockResolvedValue({ data: { user: { id: scope.authUserId, is_anonymous: false } }, error: null });
  mocks.resolveProfile.mockResolvedValue({ ok: true, data: scope.profileId });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.profile = {
    id: scope.profileId, tenant_id: scope.tenantId, auth_user_id: scope.authUserId,
    role_id: 'role-admin', is_active: true, status: 'active', roles: { id: 'role-admin', key: 'admin' },
  };
  mocks.overrides = []; mocks.overrideError = null;
});

describe('current own QM read authority', () => {
  it('accepts separate profile/auth IDs only after their actual binding and server role decision are confirmed', async () => {
    expect(await confirmQmReadScope(scope, () => true)).toEqual({ ok: true, data: undefined });
    expect(mocks.resolveProfile).toHaveBeenCalledWith(scope.tenantId);
    expect(mocks.getUser).toHaveBeenCalledWith(scope.accessToken);
    expect(mocks.rpc).toHaveBeenCalledWith('has_role_permission', {
      input_permission_key: 'qm.view', input_product_key: 'office', input_action: 'view',
    });
  });

  it('does not replace a denied database decision with a local admin exception', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await confirmQmReadScope(scope, () => true)).toMatchObject({ ok: false });
  });

  it.each([
    { auth_user_id: 'another-auth-user' }, { tenant_id: 'another-tenant' },
    { is_active: false }, { status: 'inactive' }, { roles: { id: 'role-admin', key: 'employee' } },
    { roles: { id: 'different-role', key: 'admin' } },
  ])('rejects an unbound, inactive, or mismatched profile (%j)', async patch => {
    mocks.profile = { ...mocks.profile, ...patch };
    expect(await confirmQmReadScope(scope, () => true)).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('requires every requested read permission in the server decision and a nonempty tenant override set', async () => {
    mocks.overrides = [{ permission_key: 'qm.view' }];
    expect(await confirmQmReadScope(scope, () => true, ['qm.view_versions'])).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.overrides.push({ permission_key: 'qm.view_versions' });
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect(await confirmQmReadScope(scope, () => true, ['qm.view_versions'])).toMatchObject({ ok: false });
    expect(mocks.rpc).toHaveBeenLastCalledWith('has_role_permission', {
      input_permission_key: 'qm.view_versions', input_product_key: 'office', input_action: 'view',
    });
  });

  it('does not interpret a failed override lookup as an empty unrestricted set', async () => {
    mocks.overrideError = { code: '42501' };
    expect(await confirmQmReadScope(scope, () => true)).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects a token change during confirmation and a foreign resolved profile', async () => {
    mocks.getSession.mockResolvedValueOnce(nativeSession).mockResolvedValueOnce({ data: { session: { access_token: 'new-token', user: { id: scope.authUserId } } }, error: null });
    expect(await confirmQmReadScope(scope, () => true)).toMatchObject({ ok: false });
    mocks.resolveProfile.mockResolvedValue({ ok: true, data: 'another-profile' });
    expect(await confirmQmReadScope(scope, () => true)).toMatchObject({ ok: false });
  });

  it('stops before later dispatches when its request owner is no longer current', async () => {
    let current = true;
    mocks.resolveProfile.mockImplementation(async () => { current = false; return { ok: true, data: scope.profileId }; });
    expect(await confirmQmReadScope(scope, () => current)).toMatchObject({ ok: false });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('never dispatches for an already expired scope', async () => {
    expect(await confirmQmReadScope({ ...scope, expiresAt: Date.now() - 1 }, () => true)).toMatchObject({ ok: false });
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});
