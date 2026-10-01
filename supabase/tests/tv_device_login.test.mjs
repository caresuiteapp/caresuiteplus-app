import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertApplicationMfaDisabled, assertBusinessProfileActive, assertCanPairUser, assertEmployeeReady, assertTenantActive, createDeviceHandler, DeviceError, DEVICE_TTL_MS } from '../functions/tv-device-login/core.ts';

const origin = 'https://www.caresuiteplus.app';
const userId = '11111111-1111-4111-8111-111111111111';
function harness(role = 'employee') {
  const rows = new Map(); let sequence = 0; let now = Date.parse('2026-10-01T00:00:00Z');
  const calls = { issued: 0, authenticated: 0, revalidated: 0, allowed: true, sourceActive: true, issueFailure: false, delayIssue: null };
  const actor = { role, tenantId: 'tenant', authUserId: userId, authSessionId: 'session-id', accountId: 'account-id', portalSessionId: 'portal-source' };
  const deps = {
    now: () => now,
    randomToken: () => (++sequence).toString(36).padStart(43, 'a'),
    randomId: () => `11111111-1111-4111-8111-${(++sequence).toString().padStart(12, '0')}`,
    verificationCode: () => '048392',
    hash: async (value) => `token-sha256:${createHash('sha256').update(value).digest('hex')}`,
    rateLimit: async () => calls.allowed,
    create: async (row) => { rows.set(row.id, structuredClone(row)); },
    find: async (field, value) => structuredClone([...rows.values()].find((row) => row[field] === value) ?? null),
    transition: async (id, from, to, identity) => {
      const row = rows.get(id);
      if (!row || !from.includes(row.status) || (to !== 'failed' && Date.parse(row.expires_at) <= now)) return false;
      row.status = to; if (identity) row.actor = structuredClone(identity); return true;
    },
    authenticate: async (req) => {
      calls.authenticated++;
      if (req.headers.get('authorization') !== 'Bearer fixture-phone-session') throw new DeviceError('not_authorized', 'Nicht autorisiert.', 403);
      return actor;
    },
    revalidate: async () => {
      calls.revalidated++;
      if (!calls.sourceActive) throw new DeviceError('not_authorized', 'Sitzung beendet.', 403);
    },
    issue: async () => {
      calls.issued++;
      if (calls.delayIssue) await calls.delayIssue;
      if (calls.issueFailure) throw new Error('fixture backend failure');
      return { supabaseAccessToken: 'new-tv-access-fixture', supabaseRefreshToken: 'new-tv-refresh-fixture', ...(role !== 'administration' ? { portalSession: { sessionToken: 'new-tv-portal-fixture' } } : {}) };
    },
  };
  const handle = createDeviceHandler(deps, [origin]);
  async function call(body, options = {}) {
    const response = await handle(new Request(`${origin}/functions/v1/tv-device-login`, {
      method: options.method ?? 'POST', headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.8', authorization: 'Bearer fixture-phone-session', ...options.headers },
      ...((options.method ?? 'POST') === 'POST' ? { body: JSON.stringify(body) } : {}),
    }));
    return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
  }
  const create = async () => (await call({ action: 'create', role })).body;
  const approve = async (grant, extra = {}) => call({ action: 'approve', userCode: grant.userCode, verificationCode: grant.verificationCode, confirmed: true, ...extra });
  const device = (grant, action = 'poll', extra = {}) => call({ action, id: grant.id, deviceSecret: grant.deviceSecret, ...extra });
  return { rows, calls, actor, call, create, approve, device, advance: (ms) => { now += ms; } };
}

for (const role of ['administration', 'employee', 'client']) {
  test(`complete ${role} flow issues only after explicit approval and independent claim`, async () => {
    const h = harness(role); const grant = await h.create();
    assert.equal(grant.ok, true); assert.notEqual(grant.userCode, grant.deviceSecret);
    const persisted = h.rows.get(grant.id);
    assert.equal(persisted.actor, null);
    assert.equal(JSON.stringify(persisted).includes(grant.userCode), false);
    assert.equal(JSON.stringify(persisted).includes(grant.deviceSecret), false);
    const inspected = await h.call({ action: 'inspect', userCode: grant.userCode });
    assert.deepEqual(Object.keys(inspected.body).sort(), ['ok', 'role', 'status', 'expiresAt', 'verificationCode'].sort());
    assert.equal((await h.device(grant, 'consume')).status, 409);
    assert.equal(h.calls.issued, 0);
    assert.equal((await h.approve(grant)).body.status, 'approved');
    assert.equal((await h.device(grant)).body.status, 'approved');
    assert.equal(h.calls.issued, 0);
    const consumed = await h.device(grant, 'consume');
    assert.equal(consumed.status, 200); assert.equal(consumed.body.status, 'consumed');
    assert.equal(consumed.body.supabaseAccessToken, 'new-tv-access-fixture');
    assert.equal(Boolean(consumed.body.portalSession), role !== 'administration');
    assert.equal(h.calls.issued, 1); assert.equal(h.calls.revalidated, 1);
    assert.equal((await h.device(grant, 'consume')).status, 409);
    assert.equal(h.calls.issued, 1);
    assert.equal(JSON.stringify([...h.rows.values()]).includes('fixture-phone-session'), false);
    assert.equal(JSON.stringify([...h.rows.values()]).includes('new-tv-access-fixture'), false);
    assert.equal(consumed.headers.get('cache-control'), 'no-store, max-age=0');
  });
}
test('a copied QR cannot poll or claim without the original TV secret', async () => {
  const h = harness(); const grant = await h.create(); await h.approve(grant);
  for (const action of ['poll', 'consume', 'cancel']) {
    const result = await h.device(grant, action, { deviceSecret: grant.userCode });
    assert.equal(result.status, 404);
  }
  assert.equal(h.calls.issued, 0);
  assert.equal((await h.device(grant)).body.status, 'approved');
});
test('no approval from GET, missing consent, wrong matching code or unauthenticated phone', async () => {
  const h = harness(); const grant = await h.create();
  assert.equal((await h.call({}, { method: 'GET' })).status, 405);
  assert.equal((await h.approve(grant, { confirmed: false })).body.code, 'confirmation_required');
  assert.equal((await h.approve(grant, { verificationCode: '000000' })).body.code, 'confirmation_required');
  assert.equal((await h.call({ action: 'approve', userCode: grant.userCode, verificationCode: grant.verificationCode, confirmed: true }, { headers: { authorization: '' } })).status, 403);
  assert.equal((await h.device(grant)).body.status, 'pending');
});
test('employee or client identity cannot approve an administration challenge', async () => {
  const h = harness('administration'); const grant = await h.create(); h.actor.role = 'employee';
  assert.equal((await h.approve(grant)).body.code, 'wrong_role');
  assert.equal((await h.device(grant)).body.status, 'pending');
  assert.equal(h.calls.issued, 0);
});
test('parallel consumes claim once, and cancellation cannot race a claimed grant', async () => {
  const h = harness(); const grant = await h.create(); await h.approve(grant);
  let release; h.calls.delayIssue = new Promise((resolve) => { release = resolve; });
  const first = h.device(grant, 'consume');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal((await h.device(grant, 'consume')).status, 409);
  assert.equal((await h.device(grant, 'cancel')).body.status, 'consumed');
  release(); assert.equal((await first).status, 200); assert.equal(h.calls.issued, 1);
});
test('parallel approvals cannot overwrite the first approved identity', async () => {
  const h = harness(); const grant = await h.create();
  const results = await Promise.all([h.approve(grant), h.approve(grant)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});
test('expired grants cannot be approved or consumed; polling reports expiry', async () => {
  const h = harness(); const grant = await h.create(); h.advance(DEVICE_TTL_MS);
  assert.equal((await h.device(grant)).body.status, 'expired');
  assert.equal((await h.approve(grant)).status, 410);
  const second = await h.create(); await h.approve(second); h.advance(DEVICE_TTL_MS);
  assert.equal((await h.device(second, 'consume')).status, 410); assert.equal(h.calls.issued, 0);
});
for (const status of ['denied', 'cancelled']) {
  test(`${status} grants are terminal and do not issue credentials`, async () => {
    const h = harness(); const grant = await h.create();
    const result = status === 'denied'
      ? await h.call({ action: 'deny', userCode: grant.userCode, verificationCode: grant.verificationCode, confirmed: true })
      : await h.device(grant, 'cancel');
    assert.equal(result.body.status, status);
    assert.equal((await h.approve(grant)).status, 409);
    assert.equal((await h.device(grant, 'consume')).status, 409);
    assert.equal(h.calls.issued, 0);
  });
}
test('source revocation after approval prevents session minting', async () => {
  const h = harness(); const grant = await h.create(); await h.approve(grant); h.calls.sourceActive = false;
  assert.equal((await h.device(grant, 'consume')).status, 403);
  assert.equal(h.calls.issued, 0); assert.equal((await h.device(grant)).body.status, 'failed');
});
test('minting failure becomes terminal and never returns a raw backend error', async () => {
  const h = harness(); const grant = await h.create(); await h.approve(grant); h.calls.issueFailure = true;
  const result = await h.device(grant, 'consume');
  assert.equal(result.status, 503); assert.equal(JSON.stringify(result.body).includes('fixture backend failure'), false);
  assert.equal((await h.device(grant)).body.status, 'failed');
  assert.equal((await h.device(grant, 'consume')).status, 409); assert.equal(h.calls.issued, 1);
});
test('rate limits and unapproved origins fail closed', async () => {
  const h = harness(); h.calls.allowed = false;
  assert.equal((await h.call({ action: 'create', role: 'employee' })).status, 429);
  assert.equal(h.rows.size, 0);
  h.calls.allowed = true;
  const result = await h.call({ action: 'create', role: 'employee' }, { headers: { origin: 'https://unapproved.example' } });
  assert.equal(result.status, 403); assert.equal(result.headers.get('access-control-allow-origin'), null);
  assert.equal(h.rows.size, 0);
});
test('MFA, anonymous identities, and incomplete first login cannot silently downgrade', () => {
  assert.doesNotThrow(() => assertCanPairUser({ factors: [] }, 'aal1'));
  for (const [user, aal] of [[{}, 'aal2'], [{}, undefined], [{ is_anonymous: true }, 'aal1'], [{ factors: [{ status: 'verified' }] }, 'aal1']]) {
    assert.throws(() => assertCanPairUser(user, aal), { code: 'mfa_required' });
  }
  assert.doesNotThrow(() => assertEmployeeReady({ status: 'active', must_change_password: false, first_login_completed: true }));
  for (const account of [{ status: 'blocked' }, { status: 'pending_first_login' }, { status: 'active', must_change_password: true, first_login_completed: true }, { status: 'active', must_change_password: false, first_login_completed: false }]) {
    assert.throws(() => assertEmployeeReady(account), { code: 'password_setup_required' });
  }
});
test('disabled legacy profiles and suspended tenant states cannot grant a new device', () => {
  assert.doesNotThrow(() => assertBusinessProfileActive({ is_active: true, status: 'active' }));
  for (const profile of [{ is_active: false, status: 'active' }, { is_active: true, status: 'blocked' }, {}, { is_active: true }]) {
    assert.throws(() => assertBusinessProfileActive(profile), { code: 'not_authorized' });
  }
  assert.doesNotThrow(() => assertTenantActive({ status: 'active' }, null));
  assert.doesNotThrow(() => assertTenantActive({ status: 'active' }, { status: 'active', lifecycle_status: 'onboarding' }));
  for (const state of ['suspended', 'locked', 'terminated', 'deleted_soft']) {
    assert.throws(() => assertTenantActive({ status: 'active' }, { status: state }), { code: 'not_authorized' });
  }
  for (const state of ['paused', 'offboarding', 'terminated']) {
    assert.throws(() => assertTenantActive({ status: 'active' }, { status: 'active', lifecycle_status: state }), { code: 'not_authorized' });
  }
  assert.throws(() => assertTenantActive({ status: 'blocked' }, null), { code: 'not_authorized' });
});
test('application-level MFA flags block QR even without a Supabase factor', () => {
  assert.doesNotThrow(() => assertApplicationMfaDisabled({ mfa_enabled: false, two_factor_enabled: false }));
  assert.throws(() => assertApplicationMfaDisabled({ mfa_enabled: true }), { code: 'mfa_required' });
  assert.throws(() => assertApplicationMfaDisabled({ two_factor_enabled: true }), { code: 'mfa_required' });
  assert.throws(() => assertApplicationMfaDisabled({ mfa_enabled: false, two_factor_enabled: true }), { code: 'mfa_required' });
});

test('completed managed business login resolves a stale invited profile in the same tenant', () => {
  const profile = { is_active: true, status: 'invited', tenant_id: 'business-tenant' };
  const account = { tenant_id: 'business-tenant', status: 'active', must_change_password: false };
  assert.doesNotThrow(() => assertBusinessProfileActive(profile, [account], true));
  assert.throws(() => assertBusinessProfileActive(profile, [account], false), { code: 'not_authorized' });
  assert.throws(() => assertBusinessProfileActive(profile, [account]), { code: 'not_authorized' });
  // A bare invitation, a different tenant or incomplete password setup is not a grant.
  for (const accounts of [[], [{ ...account, tenant_id: 'other-tenant' }],
    [{ ...account, must_change_password: true }], [{ ...account, must_change_password: undefined }],
    [{ ...account, status: 'pending_first_login' }], [{ ...account, status: 'blocked' }]]) {
    assert.throws(() => assertBusinessProfileActive(profile, accounts, true), { code: 'not_authorized' });
  }
  assert.throws(() => assertBusinessProfileActive({ ...profile, tenant_id: undefined }, [account], true), { code: 'not_authorized' });
});

test('managed account cannot reactivate a disabled or unknown profile', () => {
  const account = { tenant_id: 'business-tenant', status: 'active', must_change_password: false };
  for (const status of ['active', 'invited']) {
    assert.throws(() => assertBusinessProfileActive({ is_active: false, status, tenant_id: account.tenant_id }, [account], true), { code: 'not_authorized' });
  }
  for (const status of ['inactive', 'locked', 'blocked', 'archived', 'disabled', 'pending', '', undefined]) {
    assert.throws(() => assertBusinessProfileActive({ is_active: true, status, tenant_id: account.tenant_id }, [account], true), { code: 'not_authorized' });
  }
  for (const status of ['active', 'invited']) {
    assert.throws(() => assertBusinessProfileActive({ is_active: true, status, tenant_id: account.tenant_id },
      [account, { ...account, status: 'blocked' }], true), { code: 'not_authorized' });
  }
});

test('trial tenants can pair while tenant and platform suspensions still take precedence', () => {
  assert.doesNotThrow(() => assertTenantActive({ status: 'trial' }, { status: 'active', lifecycle_status: 'live' }));
  assert.doesNotThrow(() => assertTenantActive({ status: 'trial' }, null));
  for (const status of ['paused', 'cancelled', 'locked', 'blocked', 'suspended', 'terminated', 'expired', '', undefined]) {
    assert.throws(() => assertTenantActive({ status }, { status: 'active', lifecycle_status: 'live' }), { code: 'not_authorized' });
  }
  for (const status of ['blocked', 'suspended', 'locked', 'terminated', 'deleted_soft', undefined]) {
    assert.throws(() => assertTenantActive({ status: 'trial' }, { status, lifecycle_status: 'live' }), { code: 'not_authorized' });
  }
  for (const lifecycle_status of ['paused', 'offboarding', 'terminated']) {
    assert.throws(() => assertTenantActive({ status: 'trial' }, { status: 'active', lifecycle_status }), { code: 'not_authorized' });
  }
});
