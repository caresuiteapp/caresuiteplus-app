import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createOpaqueToken, hashOpaqueToken } from '../_shared/crypto.ts';
import { getServiceClient, readClientMeta, tryInsert } from '../_shared/http.ts';
import { ensurePortalSupabaseAuth } from '../_shared/portalAuth.ts';
import { assertApplicationMfaDisabled, assertBusinessProfileActive, assertCanPairUser, assertEmployeeReady, assertTenantActive, createDeviceHandler, DeviceError, type DeviceActor, type DeviceDependencies, type DeviceRole } from './core.ts';

const internalRoles = new Set([
  'business_admin', 'business_manager', 'billing', 'dispatch', 'nurse', 'caregiver', 'counselor', 'akademie_admin',
  'owner', 'management', 'pdl', 'administration', 'quality_management', 'team_lead', 'dispatcher', 'readonly',
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => new DeviceError('not_authorized', 'Dieser Zugang kann die Bildschirmanmeldung nicht freigeben. Bitte melden Sie sich am Handy im passenden Bereich erneut an.', 403);

/** Called only after auth.getUser has verified the exact bearer token. */
function sessionClaims(token: string, userId: string): { id: string; aal: unknown } {
  try {
    const part = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    if (claims.sub !== userId || !uuidPattern.test(claims.session_id)) throw unavailable();
    return { id: claims.session_id, aal: claims.aal };
  } catch { throw unavailable(); }
}

function dependencies(): DeviceDependencies {
  // A fresh service client for every HTTP request; no user's session survives another request.
  const db = getServiceClient();
  const nowIso = () => new Date().toISOString();
  async function activeAuthSession(actor: DeviceActor) {
    const result = await db.rpc('tv_device_source_session_active', { p_session_id: actor.authSessionId, p_user_id: actor.authUserId });
    if (result.error || result.data !== true) throw unavailable();
  }
  async function currentUser(userId: string) {
    const result = await db.auth.admin.getUserById(userId);
    if (result.error || !result.data.user) throw unavailable();
    const user = result.data.user;
    if (user.banned_until && Date.parse(user.banned_until) > Date.now()) throw unavailable();
    // AAL2 cannot be reproduced with a magic-link grant. Never silently downgrade MFA.
    assertCanPairUser(user, 'aal1');
    const profile = await db.from('profiles').select('mfa_enabled').or(`auth_user_id.eq.${userId},id.eq.${userId}`).maybeSingle();
    if (profile.error || !profile.data) throw unavailable();
    assertApplicationMfaDisabled(profile.data);
    return user;
  }
  async function assertTenant(tenantId: string) {
    const result = await db.from('tenants').select('id,status').eq('id', tenantId).maybeSingle();
    if (result.error || !result.data) throw unavailable();
    const platform = await db.from('platform_tenants').select('status,lifecycle_status').eq('tenant_id', tenantId).maybeSingle();
    if (platform.error) throw unavailable();
    assertTenantActive(result.data, platform.data);
  }
  async function businessIdentity(userId: string) {
    const profile = await db.from('profiles').select('id,tenant_id,role_id,is_active,status').or(`auth_user_id.eq.${userId},id.eq.${userId}`).maybeSingle();
    if (profile.error || !profile.data?.tenant_id || !profile.data.role_id) throw unavailable();
    assertBusinessProfileActive(profile.data);
    const role = await db.from('roles').select('key').eq('id', profile.data.role_id).maybeSingle();
    if (role.error || !internalRoles.has(role.data?.key ?? '')) throw unavailable();
    const accounts = await db.from('tenant_users').select('id,tenant_id,status,must_change_password').eq('auth_user_id', userId);
    if (accounts.error) throw unavailable();
    // Legacy business users may only have a profile. If a managed account exists, its status wins.
    if ((accounts.data ?? []).some((account) => account.status !== 'active' || account.must_change_password)) throw unavailable();
    if ((accounts.data ?? []).length && !(accounts.data ?? []).some((account) => account.tenant_id === profile.data.tenant_id)) throw unavailable();
    await assertTenant(profile.data.tenant_id);
    return { tenantId: String(profile.data.tenant_id) };
  }
  async function portalIdentity(actor: DeviceActor) {
    if (!actor.portalSessionId || !actor.accountId) throw unavailable();
    const source = await db.from('portal_sessions').select('id,tenant_id,portal_type,employee_id,client_id,metadata')
      .eq('id', actor.portalSessionId).eq('status', 'active').gt('expires_at', nowIso()).maybeSingle();
    if (source.error || !source.data || source.data.tenant_id !== actor.tenantId || source.data.portal_type !== actor.role) throw unavailable();
    const accountId = source.data.metadata?.portal_account_id ?? source.data.metadata?.account_id ?? source.data.metadata?.portal_access_id;
    if (accountId !== actor.accountId) throw unavailable();
    const table = actor.role === 'employee' ? 'employee_portal_accounts' : 'client_portal_access';
    const columns = actor.role === 'employee'
      ? 'id,tenant_id,auth_user_id,employee_id,username,status,must_change_password,first_login_completed'
      : 'id,tenant_id,auth_user_id,client_id,portal_username,portal_enabled,status,two_factor_enabled';
    const result = await db.from(table).select(columns).eq('id', actor.accountId).eq('tenant_id', actor.tenantId).eq('auth_user_id', actor.authUserId).maybeSingle();
    if (result.error || !result.data) throw unavailable();
    const account = result.data as unknown as Record<string, any>;
    assertApplicationMfaDisabled(account);
    if (actor.role === 'employee') {
      assertEmployeeReady(account);
      if (account.employee_id !== source.data.employee_id) throw unavailable();
    } else if (account.portal_enabled !== true || account.status !== 'aktiv' || account.client_id !== source.data.client_id) throw unavailable();
    await assertTenant(actor.tenantId);
    return account;
  }
  async function revalidate(actor: DeviceActor) {
    const user = await currentUser(actor.authUserId);
    await activeAuthSession(actor);
    if (actor.role === 'administration') {
      if (user.app_metadata?.portal_type || user.app_metadata?.portal_account_id) throw unavailable();
      const current = await businessIdentity(actor.authUserId);
      if (current.tenantId !== actor.tenantId) throw unavailable();
    } else {
      if (user.app_metadata?.portal_type !== actor.role || user.app_metadata?.tenant_id !== actor.tenantId || user.app_metadata?.portal_account_id !== actor.accountId) throw unavailable();
      await portalIdentity(actor);
    }
  }
  async function authenticate(req: Request, role: DeviceRole, sourceToken?: string): Promise<DeviceActor> {
    const bearer = req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!bearer) throw unavailable();
    const verified = await db.auth.getUser(bearer);
    if (verified.error || !verified.data.user) throw unavailable();
    const claims = sessionClaims(bearer, verified.data.user.id);
    const user = await currentUser(verified.data.user.id);
    assertCanPairUser(user, claims.aal);
    let actor: DeviceActor;
    if (role === 'administration') {
      if (user.app_metadata?.portal_type || user.app_metadata?.portal_account_id) throw unavailable();
      const identity = await businessIdentity(user.id);
      actor = { role, authUserId: user.id, authSessionId: claims.id, tenantId: identity.tenantId };
    } else {
      if (!sourceToken || sourceToken.length < 16 || sourceToken.length > 256 || user.app_metadata?.portal_type !== role) throw unavailable();
      const sourceHash = await hashOpaqueToken(sourceToken);
      const source = await db.from('portal_sessions').select('id,tenant_id,metadata').in('session_token', [sourceHash, sourceToken])
        .eq('portal_type', role).eq('status', 'active').gt('expires_at', nowIso()).maybeSingle();
      if (source.error || !source.data) throw unavailable();
      const accountId = source.data.metadata?.portal_account_id ?? source.data.metadata?.account_id ?? source.data.metadata?.portal_access_id;
      if (typeof accountId !== 'string' || !uuidPattern.test(accountId)) throw unavailable();
      actor = { role, authUserId: user.id, authSessionId: claims.id, tenantId: source.data.tenant_id, accountId, portalSessionId: source.data.id };
    }
    await revalidate(actor);
    return actor;
  }
  return {
    now: Date.now, randomToken: createOpaqueToken, randomId: () => crypto.randomUUID(),
    verificationCode: () => {
      // Rejection sampling avoids modulo bias in the visual matching code.
      const random = new Uint32Array(1); let value: number;
      do { value = crypto.getRandomValues(random)[0]; } while (value >= 4_294_000_000);
      return String(value % 1_000_000).padStart(6, '0');
    },
    hash: hashOpaqueToken,
    async rateLimit(key, maximum, windowSeconds) {
      const result = await db.rpc('tv_device_rate_limit', { p_key: key, p_maximum: maximum, p_window_seconds: windowSeconds });
      if (result.error) throw new Error('rate_limit_unavailable');
      return result.data === true;
    },
    async create(row) {
      const result = await db.from('tv_device_login_requests').insert(row);
      if (result.error) throw new Error('device_create_unavailable');
    },
    async find(field, value) {
      const result = await db.from('tv_device_login_requests').select('*').eq(field, value).maybeSingle();
      if (result.error) throw new Error('device_lookup_unavailable');
      return result.data;
    },
    async transition(id, from, to, actor) {
      let query = db.from('tv_device_login_requests').update({ status: to, updated_at: nowIso(), ...(actor ? { actor } : {}) })
        .eq('id', id).in('status', from);
      if (to !== 'failed') query = query.gt('expires_at', nowIso());
      const result = await query.select('id').maybeSingle();
      if (result.error) throw new Error('device_transition_unavailable');
      return Boolean(result.data);
    },
    authenticate, revalidate,
    async issue(actor, req) {
      let accessToken: string | undefined; let refreshToken: string | undefined;
      const issuer = getServiceClient();
      let portalRowId: string | undefined;
      try {
        if (actor.role === 'administration') {
          const user = await currentUser(actor.authUserId);
          if (!user.email || !user.email_confirmed_at) throw unavailable();
          const link = await issuer.auth.admin.generateLink({ type: 'magiclink', email: user.email });
          if (link.error || !link.data.properties?.hashed_token || link.data.user?.id !== actor.authUserId) throw unavailable();
          const session = await issuer.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' });
          accessToken = session.data.session?.access_token; refreshToken = session.data.session?.refresh_token;
          if (session.error || !accessToken || !refreshToken || session.data.user?.id !== actor.authUserId) throw unavailable();
          await revalidate(actor);
          const meta = readClientMeta(req);
          await tryInsert(db, 'login_audit_events', { tenant_id: actor.tenantId, login_type: 'business', account_id: actor.authUserId, success: true, username_or_code_hint: 'TV QR', ip_address: meta.ipAddress, user_agent: meta.userAgent });
          return { supabaseAccessToken: accessToken, supabaseRefreshToken: refreshToken };
        }
        const account = await portalIdentity(actor);
        const employee = actor.role === 'employee';
        const subjectId = employee ? account.employee_id : account.client_id;
        const person = await db.from(employee ? 'employees' : 'clients').select('first_name,last_name').eq('id', subjectId).eq('tenant_id', actor.tenantId).maybeSingle();
        if (person.error || !person.data) throw unavailable();
        const displayName = [person.data.first_name, person.data.last_name].filter(Boolean).join(' ').trim() || String(employee ? account.username : account.portal_username);
        const session = await ensurePortalSupabaseAuth(issuer, {
          portalType: actor.role, accountId: actor.accountId!, tenantId: actor.tenantId,
          roleKey: employee ? 'employee_portal' : 'client_portal', displayName,
          linkTable: employee ? 'employee_portal_accounts' : 'client_portal_access', linkRowId: actor.accountId!,
          clientFirstName: employee ? undefined : person.data.first_name, clientLastName: employee ? undefined : person.data.last_name,
        });
        if (!session.ok) throw new Error('portal_session_unavailable');
        accessToken = session.accessToken; refreshToken = session.refreshToken;
        if (session.authUserId !== actor.authUserId) throw unavailable();
        const token = createOpaqueToken(); const now = nowIso();
        const expiresAt = new Date(Date.now() + (employee ? 12 : 8) * 60 * 60_000).toISOString();
        const meta = readClientMeta(req);
        const inserted = await db.from('portal_sessions').insert({
          tenant_id: actor.tenantId, portal_type: actor.role, status: 'active',
          employee_id: employee ? subjectId : null, client_id: employee ? null : subjectId,
          session_token: await hashOpaqueToken(token), started_at: now, last_seen_at: now, expires_at: expiresAt,
          ip_address: meta.ipAddress, user_agent: meta.userAgent,
          metadata: { portal_account_id: actor.accountId, ...(employee ? { account_id: actor.accountId } : { portal_access_id: actor.accountId }), token_format: 'sha256', device_login: true },
        }).select('id').single();
        if (inserted.error || !inserted.data) throw new Error('portal_session_unavailable');
        portalRowId = inserted.data.id;
        await revalidate(actor);
        await tryInsert(db, 'login_audit_events', { tenant_id: actor.tenantId, login_type: employee ? 'employee_portal' : 'client_portal', account_id: actor.accountId, success: true, username_or_code_hint: 'TV QR', ip_address: meta.ipAddress, user_agent: meta.userAgent });
        return {
          supabaseAccessToken: accessToken, supabaseRefreshToken: refreshToken,
          portalSession: { sessionToken: token, tenantId: actor.tenantId, loginType: employee ? 'employee_portal' : 'client_portal', roleKey: employee ? 'employee_portal' : 'client_portal', expiresAt, accountId: actor.accountId, displayName, mustChangePassword: false, ...(employee ? { employeeId: subjectId } : { clientId: subjectId }) },
        };
      } catch (error) {
        if (accessToken) await getServiceClient().auth.admin.signOut(accessToken, 'local').catch(() => undefined);
        if (portalRowId) await db.from('portal_sessions').update({ status: 'revoked', revoked_at: nowIso() }).eq('id', portalRowId);
        throw error;
      }
    },
  };
}

const allowedOrigins = (Deno.env.get('TV_DEVICE_LOGIN_ALLOWED_ORIGINS') || 'https://www.caresuiteplus.app,https://caresuiteplus.app')
  .split(',').map((value) => value.trim()).filter(Boolean);
serve((req) => createDeviceHandler(dependencies(), allowedOrigins)(req));
