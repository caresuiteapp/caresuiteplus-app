// Uses the project's existing TypeScript compiler and Node's built-in test runner.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.env.CARESUITE_TYPESCRIPT_PATH || 'typescript');
const root = path.resolve(__dirname, '..');
const code = 'a'.repeat(43);

function load(relative, globals = {}, mocks = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: (id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, URL, Date, JSON, Error, TypeError, DOMException, AbortController, setTimeout, clearTimeout, ...globals });
  return exports;
}
function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}
function api(fetch, session = null) {
  return load('src/lib/auth/tvDeviceLogin.web.ts', { fetch }, {
    '@/lib/supabase/config': { getSupabaseConfig: () => ({ url: 'https://project.example', anonKey: 'public-key' }), isDemoMode: () => false },
    '@/lib/supabase/client': { getSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session } }) } }) },
  });
}
const success = (data) => new Response(JSON.stringify({ ok: true, ...data }), { status: 200 });

test('phone return is fixed to same-origin confirmation, preserves first password setup', () => {
  const sessionStorage = storage();
  const flow = load('src/lib/auth/tvDeviceLoginReturn.web.ts', { window: { sessionStorage } });
  assert.equal(flow.rememberTvLoginReturn(code, 'employee', new Date(Date.now() + 120_000).toISOString()), true);
  assert.equal(flow.resolveTvLoginReturn('/portal/employee'), `/device/confirm?code=${code}`);
  assert.equal(flow.resolveTvLoginReturn('/auth/employee-first-login?accountId=123'), '/auth/employee-first-login?accountId=123');
  flow.clearTvLoginReturn();
  assert.equal(flow.resolveTvLoginReturn('/portal/employee'), '/portal/employee');
});
test('return storage rejects external URLs, expired challenges and invalid roles', () => {
  const sessionStorage = storage();
  const flow = load('src/lib/auth/tvDeviceLoginReturn.web.ts', { window: { sessionStorage } });
  assert.equal(flow.rememberTvLoginReturn('https://evil.example/', 'employee', new Date(Date.now() + 60_000).toISOString()), false);
  assert.equal(flow.rememberTvLoginReturn(code, 'admin', new Date(Date.now() + 60_000).toISOString()), false);
  assert.equal(flow.rememberTvLoginReturn(code, 'client', new Date(Date.now() - 1).toISOString()), false);
  sessionStorage.setItem('caresuite.tv.login-return.v1', JSON.stringify({ code, role: 'client', expiresAt: Date.now() - 10 }));
  assert.equal(flow.getTvLoginReturnPath(), null);
  assert.equal(sessionStorage.getItem('caresuite.tv.login-return.v1'), null);
});
test('storage failure stays recoverable without an arbitrary redirect', () => {
  const flow = load('src/lib/auth/tvDeviceLoginReturn.web.ts', { window: { sessionStorage: { setItem() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); }, removeItem() {} } } });
  assert.equal(flow.rememberTvLoginReturn(code, 'client', new Date(Date.now() + 60_000).toISOString()), false);
  assert.equal(flow.resolveTvLoginReturn('/portal/client'), '/portal/client');
});
test('QR contains only public challenge code, never the TV secret or auth session', () => {
  const flow = api(async () => { throw new Error('not called'); });
  assert.equal(flow.tvConfirmationUrl(code, 'https://www.caresuiteplus.app'), `https://www.caresuiteplus.app/device/confirm?code=${code}`);
  assert.throws(() => flow.tvConfirmationUrl('//evil.example?token=secret', 'https://www.caresuiteplus.app'));
});
test('invalid public code is rejected before any network request', async () => {
  let calls = 0;
  const flow = api(async () => { calls++; return success({}); });
  await assert.rejects(flow.inspectTvLogin('bad-code'), /ungültig/);
  assert.equal(calls, 0);
});
test('approval requires current authenticated JWT and binds portal token in POST only', async () => {
  const calls = [];
  const fetch = async (url, options) => { calls.push({ url, options }); return success({}); };
  await assert.rejects(api(fetch).decideTvLogin(code, '123456', 'approve', 'portal-session'), /zuerst.*anmelden/);
  assert.equal(calls.length, 0);
  const flow = api(fetch, { access_token: 'authenticated-jwt' });
  await flow.decideTvLogin(code, '123456', 'approve', 'portal-session');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer authenticated-jwt');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
  assert.deepEqual(JSON.parse(calls[0].options.body), { action: 'approve', userCode: code, verificationCode: '123456', confirmed: true, portalSessionToken: 'portal-session' });
  assert.equal(calls[0].url, 'https://project.example/functions/v1/tv-device-login');
});
test('missing service fails clearly and cannot present a successful challenge', async () => {
  const flow = api(async () => new Response('Not found', { status: 404 }));
  await assert.rejects(flow.createTvLogin('client'), /QR-Anmeldung ist derzeit nicht verfügbar/);
});
test('malformed server roles, status and challenge payloads fail closed', async () => {
  const flow = api(async () => success({ role: 'admin', status: 'pending', verificationCode: '123456', expiresAt: new Date(Date.now() + 60_000).toISOString() }));
  await assert.rejects(flow.inspectTvLogin(code), /nicht verfügbar/);
  await assert.rejects(flow.pollTvLogin({ id: 'id', deviceSecret: 'secret' }), /nicht verfügbar/);
  await assert.rejects(flow.createTvLogin('client'), /nicht verfügbar/);
});
