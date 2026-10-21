import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
const f = vi.hoisted(() => ({ edge: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/supabase/edgeFunctions', () => ({ invokeEdgeFunction: f.edge }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: f.rpc }) }));
vi.mock('@/lib/supabase/authService', () => ({ toGermanAuthError: () => 'Ungültig' }));
vi.mock('react-native-url-polyfill/auto', () => ({}));
import { loginClientPortal } from '@/lib/auth/clientPortalAuthService';
import { isPortalSupabaseIdentityAligned } from '@/lib/auth/portalSupabaseAuth';
import { manageAcademyFamilyAccess } from '@/lib/clients/academyFamilyAccessService';
import { resolveAcademyFamilyIdentity } from '../../../supabase/functions/_shared/academyFamilyIdentity';
import { ensurePortalSupabaseAuth } from '../../../supabase/functions/_shared/portalAuth';
import { createPdfUploadHandler, type PdfClient } from '../../../supabase/functions/_shared/pdfUploadHandler';

const account = 'account'; const tenant = 'tenant'; const contact = 'contact';
const identity = { accountId: account, tenantId: tenant, contactId: contact, clientId: 'represented-client', displayName: 'Eva Kontakt', firstName: 'Eva', lastName: 'Kontakt', username: 'ekontakt', accessGeneration: 1 };
const loginData = () => ({ portalAccountId: account, tenantId: tenant, clientId: null, relativeContactId: contact, portalType: 'academy_family', accessScope: 'academy', accessGeneration: 1, displayName: 'Eva Kontakt', sessionToken: '0123456789abcdef0123456789', expiresAt: '2099-01-01T00:00:00Z' });
beforeEach(() => vi.clearAllMocks());

describe('personal Academy family identity', () => {
  it('maps the verified login to its own contact identity without representing the client', async () => {
    f.edge.mockResolvedValue({ ok: true, data: loginData() });
    const login = await loginClientPortal('ekontakt', '123456');
    expect(login.ok).toBe(true); if (!login.ok) return;
    expect(login.data.portalSession).toMatchObject({ portalType: 'academy_family', accessScope: 'academy', loginType: 'relative_portal', roleKey: 'family_portal', relativeContactId: contact, clientId: null, displayName: 'Eva Kontakt' });
    expect(f.edge).toHaveBeenCalledWith('client-portal-login', { username: 'ekontakt', code: '123456' });
  });
  it.each([{ relativeContactId: undefined }, { accessScope: undefined }, { clientId: 'represented-client' }])('rejects an incomplete or broadened family login: %j', async patch => {
    f.edge.mockResolvedValue({ ok: true, data: { ...loginData(), ...patch } });
    expect((await loginClientPortal('ekontakt', '123456')).ok).toBe(false);
  });
  it('keeps native portal login unchanged and explains that the new family learning access opens in the browser', async () => {
    const original = Platform.OS;
    try {
      (Platform as { OS: string }).OS = 'android';
      f.edge.mockResolvedValue({ ok: true, data: loginData() });
      const family = await loginClientPortal('ekontakt', '123456');
      expect(family.ok).toBe(false); if (!family.ok) expect(family.error).toContain('Browser');
      f.edge.mockResolvedValue({ ok: true, data: { ...loginData(), portalType: 'client', clientId: 'client' } });
      const client = await loginClientPortal('self', '123456');
      expect(client.ok).toBe(true); if (client.ok) expect(client.data.portalSession?.roleKey).toBe('client_portal');
    } finally { (Platform as { OS: string }).OS = original; }
  });
  it('does not align a client JWT or another contact JWT with an academy-only session', async () => {
    f.edge.mockResolvedValue({ ok: true, data: loginData() });
    const login = await loginClientPortal('ekontakt', '123456'); if (!login.ok || !login.data.portalSession) throw new Error('Fixture');
    const session = { user: { app_metadata: { tenant_id: tenant, role_key: 'family_portal', portal_type: 'academy_family', portal_account_id: account, access_scope: 'academy', relative_contact_id: contact, academy_access_generation: 1 } } } as unknown as Session;
    expect(isPortalSupabaseIdentityAligned(session, login.data.portalSession)).toBe(true);
    session.user.app_metadata.portal_type = 'client';
    expect(isPortalSupabaseIdentityAligned(session, login.data.portalSession)).toBe(false);
    session.user.app_metadata.portal_type = 'academy_family'; session.user.app_metadata.relative_contact_id = 'another-contact';
    expect(isPortalSupabaseIdentityAligned(session, login.data.portalSession)).toBe(false);
  });
  it('resolves only the exact server-validated account, tenant and contact before mint or refresh', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: identity, error: null });
    expect(await resolveAcademyFamilyIdentity({ rpc }, account, tenant, contact)).toEqual(identity);
    expect(rpc).toHaveBeenCalledWith('academy_family_auth_identity', { p_account: account, p_tenant: tenant, p_contact: contact });
    for (const patch of [{ contactId: 'other' }, { tenantId: 'other' }, { accountId: 'other' }]) {
      rpc.mockResolvedValue({ data: { ...identity, ...patch }, error: null });
      expect(await resolveAcademyFamilyIdentity({ rpc }, account, tenant, contact)).toBeNull();
    }
    rpc.mockResolvedValue({ data: identity, error: { message: 'inactive or boundary unavailable' } });
    expect(await resolveAcademyFamilyIdentity({ rpc }, account, tenant, contact)).toBeNull();
  });
  it('refuses a client mint for a family account and refuses mint after access generation changed', async () => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { portal_enabled: true, status: 'aktiv', account_kind: 'academy_family' }, error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    const admin = { createUser: vi.fn() };
    const client = { from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ data: { ...identity, accessGeneration: 2 }, error: null }), auth: { admin } };
    const base = { accountId: account, tenantId: tenant, displayName: 'Eva Kontakt', linkTable: 'client_portal_access' as const, linkRowId: account };
    const wrongRole = await ensurePortalSupabaseAuth(client as never, { ...base, portalType: 'client', roleKey: 'client_portal' });
    expect(wrongRole.ok).toBe(false); expect(client.rpc).not.toHaveBeenCalled();
    const stale = await ensurePortalSupabaseAuth(client as never, { ...base, portalType: 'academy_family', roleKey: 'family_portal', relativeContactId: contact, accessGeneration: 1 });
    expect(stale.ok).toBe(false); expect(admin.createUser).not.toHaveBeenCalled();
  });
  function familyAuthFixture(generation = 1) {
    type User = { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> };
    const users = new Map<string, User>();
    const row = { auth_user_id: null as string | null, portal_enabled: true, status: 'aktiv', account_kind: 'academy_family', access_generation: generation };
    const bind = vi.fn();
    function from(table: string) {
      let patch: Record<string, unknown> | null = null;
      const q = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: table === 'client_portal_access' ? { ...row } : table === 'roles' ? { id: 'family-role' } : { id: 'profile' }, error: null }),
        update: (value: Record<string, unknown>) => { patch = value; return q; },
        then: (resolve: (result: { error: null }) => unknown) => {
          if (table === 'client_portal_access' && patch) { Object.assign(row, patch); bind(patch); }
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return q;
    }
    const admin = {
      createUser: vi.fn(async (input: Omit<User, 'id'>) => {
        if ([...users.values()].some(value => value.email === input.email)) return { data: { user: null }, error: { message: 'User already registered' } };
        const user = { ...input, id: `auth-${users.size + 1}` }; users.set(user.id, structuredClone(user));
        return { data: { user: structuredClone(user) }, error: null };
      }),
      getUserById: vi.fn(async (id: string) => ({ data: { user: users.has(id) ? structuredClone(users.get(id)) : null }, error: null })),
      listUsers: vi.fn(async () => ({ data: { users: [...users.values()].map(value => structuredClone(value)) }, error: null })),
      updateUserById: vi.fn(async (id: string, patch: Partial<User>) => {
        const user = { ...users.get(id)!, ...patch }; users.set(id, structuredClone(user));
        return { data: { user: structuredClone(user) }, error: null };
      }),
      generateLink: vi.fn(async ({ email }: { email: string }) => ({ data: { properties: { hashed_token: email } }, error: null })),
    };
    const refreshClaims = (authId: string) => ({ sub: authId, app_metadata: structuredClone(users.get(authId)!.app_metadata) });
    const client = { from, rpc: async () => ({ data: { ...identity, accessGeneration: row.access_generation }, error: null }), auth: { admin,
      verifyOtp: async ({ token_hash }: { token_hash: string }) => {
        const user = [...users.values()].find(value => value.email === token_hash)!;
        return { data: { session: { access_token: JSON.stringify(refreshClaims(user.id)), refresh_token: `refresh-for-${user.id}`, expires_at: 2_000_000_000 } }, error: null };
      },
    } };
    const input = () => ({ portalType: 'academy_family' as const, accountId: account, tenantId: tenant, roleKey: 'family_portal', displayName: identity.displayName,
      relativeContactId: contact, accessGeneration: row.access_generation, linkTable: 'client_portal_access' as const, linkRowId: account });
    return { users, row, bind, admin, client, input, refreshClaims };
  }
  it('uses a separate GoTrue Auth identity per access generation so an older refresh token cannot inherit renewed claims', async () => {
    const fixture = familyAuthFixture();
    const first = await ensurePortalSupabaseAuth(fixture.client as never, fixture.input());
    expect(first.ok).toBe(true); if (!first.ok) return;
    const oldClaims = fixture.refreshClaims(first.authUserId);
    fixture.row.access_generation = 2; // The separately tested SQL rotates/revokes the account.
    const second = await ensurePortalSupabaseAuth(fixture.client as never, fixture.input());
    expect(second.ok).toBe(true); if (!second.ok) return;
    expect(second.authUserId).not.toBe(first.authUserId);
    expect(fixture.row.auth_user_id).toBe(second.authUserId);
    expect(fixture.users.get(first.authUserId)?.email).toContain('.g1@');
    expect(fixture.users.get(second.authUserId)?.email).toContain('.g2@');
    expect(fixture.refreshClaims(first.authUserId)).toEqual(oldClaims);
    expect(fixture.refreshClaims(second.authUserId).app_metadata.academy_access_generation).toBe(2);
    const third = await ensurePortalSupabaseAuth(fixture.client as never, fixture.input());
    expect(third.ok && third.authUserId).toBe(second.authUserId);
    expect(fixture.admin.createUser).toHaveBeenCalledTimes(2);
  });
  it.each(['linked', 'email-collision'])('never upgrades a mismatched Auth user with the expected future-generation email (%s)', async mode => {
    const fixture = familyAuthFixture(2);
    fixture.users.set('old-auth', { id: 'old-auth', email: `portal.academy_family.${account}.g2@caresuite-portal.local`,
      app_metadata: { portal_type: 'academy_family', role_key: 'family_portal', tenant_id: tenant, portal_account_id: account,
        access_scope: 'academy', relative_contact_id: contact, academy_access_generation: 1 }, user_metadata: {} });
    if (mode === 'linked') fixture.row.auth_user_id = 'old-auth';
    const before = fixture.refreshClaims('old-auth');
    const result = await ensurePortalSupabaseAuth(fixture.client as never, fixture.input());
    expect(result.ok).toBe(false); expect(fixture.admin.updateUserById).not.toHaveBeenCalled(); expect(fixture.bind).not.toHaveBeenCalled();
    expect(fixture.refreshClaims('old-auth')).toEqual(before);
  });
  it('uses controlled setup RPC and rejects a receipt belonging to a different contact', async () => {
    f.rpc.mockResolvedValue({ data: { access: { id: account, tenant_id: tenant, client_id: 'client', contact_id: 'other', account_kind: 'academy_family', access_scope: 'academy', portal_username: 'ekontakt', portal_enabled: true, status: 'aktiv' } }, error: null });
    await expect(manageAcademyFamilyAccess({ tenantId: tenant, clientId: 'client', contactId: contact, firstName: 'Eva', lastName: 'Kontakt', action: 'setup' })).rejects.toThrow('ausgewählten Person');
    expect(f.rpc).toHaveBeenCalledWith('academy_family_access_manage', expect.objectContaining({ p_tenant: tenant, p_client: 'client', p_contact: contact, p_action: 'setup', p_code_hash: expect.any(String) }));
  });
  it('rejects the PDF edge request before any general RPC, profile lookup or service-role operation', async () => {
    const rpc = vi.fn(); const service = vi.fn();
    const handler = createPdfUploadHandler({ userClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'auth-family', app_metadata: { portal_type: 'academy_family' } } }, error: null }) }, rpc }) as unknown as PdfClient,
      serviceClient: service, respond: (body, status = 200) => new Response(JSON.stringify(body), { status }), corsHeaders: {} });
    const response = await handler(new Request('https://example.test/render-document-pdf', { method: 'POST', headers: { Authorization: 'Bearer verified-family-token' }, body: '{}' }));
    expect(response.status).toBe(403); expect(rpc).not.toHaveBeenCalled(); expect(service).not.toHaveBeenCalled();
  });
});
