import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = 'caresuite-platform-runtime-controls-20261007';
const open = { release, maintenanceMode: false, registrationEnabled: true, notice: '' };
const plain = value => JSON.parse(JSON.stringify(value));

async function fixture() {
  const calls = []; const handlers = [];
  let value = open, rpcError = null, offline = false, demo = false;
  const service = { rpc: async name => { calls.push({ rpc: name }); return { data: value, error: rpcError }; } };
  const context = createContext({ URL, Response, Request, AbortController, setTimeout, clearTimeout, console,
    Deno: { env: { get: () => 'configured-test-value' } },
    fetch: async (url, init) => { calls.push({ url, init }); if (offline) throw new Error('offline'); return new Response(JSON.stringify({ runtime: value }), { status: rpcError ? 503 : 200 }); },
  });
  const cache = new Map();
  const boundaries = {
    'https://deno.land/std@0.168.0/http/server.ts': { serve: handler => handlers.push(handler) },
    '@/lib/supabase/config': { getSupabaseConfig: () => ({ url: 'https://example.supabase.co', anonKey: 'sb_publishable_test' }), isDemoMode: () => demo, isSupabaseConfigured: () => true },
    '@/lib/services/mode': { getServiceMode: () => demo ? 'demo' : 'supabase' },
    '../_shared/http.ts': { corsHeaders: {}, getServiceClient: () => service, readClientMeta: () => ({}),
      jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Cache-Control': 'no-store' } }) },
    './provision.ts': { validateRegistrationBody: body => body.valid ? null : 'Ungültige Registrierungsdaten.',
      provisionBusinessRegistration: async () => { calls.push({ provision: true }); return { status: 201, body: { ok: true, tenantId: 'test-company' } }; } },
    '../registration-welcome-dispatch/worker.ts': { REGISTRATION_WELCOME_ENV_KEYS: [],
      dispatchRegistrationWelcomeEmails: async () => { calls.push({ mail: true }); return { configured: true }; } },
    '@/lib/catalogs/companyContactFunctionCatalog': { canonicalCompanyContactFunction: value => value },
    '@/lib/catalogs/companyRegistrationCatalog': { normalizeCompanyRegistrationSelection: value => value, validateCompanyRegistrationSelection: () => null },
    './businessRegistrationPolicy': { FREE_REGISTRATION_PRODUCTS: [], validateBusinessRegistration: () => null },
    '@/data/constants/testTenant': { DEMO_TENANT_ID: 'demo-test' },
    '@/lib/billing/moduleActivationService': { activateRegistrationModules: () => { throw new Error('unexpected demo write'); } },
    '@/lib/supabase/authService': { signInWithPassword: () => { throw new Error('unexpected authentication'); } },
    './businessAccessService.web': { checkBusinessAccess: () => { throw new Error('unexpected access check'); } },
    '@/lib/supabase/edgeFunctions': { invokeEdgeFunction: async () => { calls.push({ registrationRequest: true }); return { ok: false, error: 'unexpected registration' }; } },
    './accessStore': Object.fromEntries(['findTenantUserByUsername', 'getPasswordHash', 'getTenantUsers', 'listTenantUsernames', 'saveTenantUser', 'setPasswordHash'].map(name => [name, () => { throw new Error('unexpected account write/read'); }])),
    './loginAuditService': { recordLoginAuditEvent: () => { throw new Error('unexpected login event'); } },
    './passwordHash': { hashSecret: () => { throw new Error('unexpected password processing'); }, verifySecret: () => false },
    './temporaryPassword': { generateTemporaryPassword: () => { throw new Error('unexpected password generation'); } },
    './usernameGenerator': { pickUniqueUsername: () => { throw new Error('unexpected account provisioning'); } },
    '@/lib/platformConsole/platformObservation.web': { prepareRegistrationObservation: async () => { calls.push({ observation: true }); return null; }, finishRegistrationObservation: () => {} },
  };
  async function module(file) {
    if (cache.has(file)) return cache.get(file);
    const result = new SourceTextModule(stripTypeScriptTypes(await readFile(file, 'utf8')), { context, identifier: file }); cache.set(file, result);
    await result.link(async (specifier, importer) => {
      if (specifier === '@/lib/platformConsole/platformRuntime.web') return module(resolve(root, 'src/lib/platformConsole/platformRuntime.web.ts'));
      if (specifier === '@/lib/platformConsole/platformRuntimePolicy') return module(resolve(root, 'src/lib/platformConsole/platformRuntimePolicy.ts'));
      if (boundaries[specifier]) {
        const key = 'boundary:' + specifier;
        if (!cache.has(key)) {
          const values = boundaries[specifier];
          cache.set(key, new SyntheticModule(Object.keys(values), function () { for (const [name, value] of Object.entries(values)) this.setExport(name, value); }, { context }));
        }
        return cache.get(key);
      }
      assert.ok(specifier.startsWith('.'), 'Unexpected dependency: ' + specifier);
      return module(resolve(dirname(importer.identifier), specifier.endsWith('.ts') ? specifier : specifier + '.ts'));
    });
    await result.evaluate(); return result;
  }
  const policy = (await module(resolve(root, 'src/lib/platformConsole/platformRuntimePolicy.ts'))).namespace;
  const edge = (await module(resolve(root, 'supabase/functions/_shared/platformRuntime.ts'))).namespace;
  const client = (await module(resolve(root, 'src/lib/platformConsole/platformRuntime.web.ts'))).namespace;
  return { calls, policy, edge, client, service, handlers, module,
    settings: next => { value = next; }, failRpc: () => { rpcError = { message: 'private database details' }; },
    offline: () => { offline = true; }, demo: () => { demo = true; } };
}

test('runtime contract accepts only the expected typed public projection and strips extra fields', async () => {
  const f = await fixture();
  assert.deepEqual(plain(f.policy.parsePlatformRuntime({ ...open, secret: 'private', tenantId: 'private' })), open);
  assert.deepEqual(plain(f.edge.normalizePlatformRuntime({ ...open, secret: 'private' })), open);
  for (const value of [null, [], {}, { ...open, release: 'old' }, { ...open, maintenanceMode: 'false' }, { ...open, registrationEnabled: 1 }, { ...open, notice: {} }, { ...open, notice: 'x'.repeat(2001) }]) {
    assert.equal(f.policy.parsePlatformRuntime(value), null); assert.equal(f.edge.normalizePlatformRuntime(value), null);
  }
  assert.ok(f.edge.normalizePlatformRuntime({ ...open, notice: '🐇'.repeat(2000) }));
});
test('maintenance blocks ordinary website and software routes without a prefix bypass', async () => {
  const f = await fixture(), snapshot = { status: 'ready', settings: { ...open, maintenanceMode: true } };
  for (const path of ['/', '/auth', '/office', '/portal/employee', '/portal/client', '/landingpage/', '/caresuite', '/platform-fake', '/support-other'])
    assert.equal(f.policy.platformRuntimeBlock(path, snapshot), 'maintenance', path);
});
test('platform login, support, legal information and password recovery stay reachable during maintenance', async () => {
  const f = await fixture(), snapshot = { status: 'ready', settings: { ...open, maintenanceMode: true } };
  for (const path of ['/platform', '/platform/login', '/platform/system', '/support', '/impressum/', '/datenschutz?from=maintenance', '/nutzungsbedingungen', '/auth/forgot-password', '/auth/reset-password', '/auth/recovery-bridge'])
    assert.equal(f.policy.platformRuntimeBlock(path, snapshot), null, path);
});
test('paused registration affects all registration routes while existing logins remain available', async () => {
  const f = await fixture(), snapshot = { status: 'ready', settings: { ...open, registrationEnabled: false } };
  for (const path of ['/auth/register', '/auth/register-business/', '/liquid-command/access/register?step=2']) assert.equal(f.policy.platformRuntimeBlock(path, snapshot), 'registration');
  for (const path of ['/auth', '/office', '/portal/client']) assert.equal(f.policy.platformRuntimeBlock(path, snapshot), null);
});
test('unknown availability stops registration while failed rechecks retain the last known closure', async () => {
  const f = await fixture();
  assert.equal(f.policy.platformRuntimeBlock('/auth/register', { status: 'checking', settings: null }), 'checking');
  assert.equal(f.policy.platformRuntimeBlock('/auth/register', { status: 'failed', settings: null }), 'unavailable');
  assert.equal(f.policy.platformRuntimeBlock('/office', { status: 'failed', settings: { ...open, maintenanceMode: true } }), 'maintenance');
  assert.ok(f.policy.platformRegistrationError({ status: 'failed', settings: open }));
  assert.equal(f.policy.platformRegistrationError({ status: 'ready', settings: open }), null);
});
test('operational status fetch uses no visitor identity, token, cookie or registration payload', async () => {
  const f = await fixture(); await f.client.refreshPlatformRuntime();
  const call = f.calls.find(x => x.url);
  assert.equal(call.init.method, 'GET'); assert.equal(call.init.credentials, 'omit');
  assert.equal(call.init.cache, 'no-store'); assert.deepEqual(plain(call.init.headers), { apikey: 'sb_publishable_test' });
  assert.equal(call.init.body, undefined); assert.equal(f.client.getPlatformRuntimeSnapshot().status, 'ready');
});
test('concurrent runtime refreshes share one request and subscriptions can be removed', async () => {
  const f = await fixture(); let notifications = 0;
  const unsubscribe = f.client.subscribePlatformRuntime(() => { notifications++; });
  const first = f.client.refreshPlatformRuntime(), second = f.client.refreshPlatformRuntime();
  assert.equal(first, second); await first; assert.equal(f.calls.filter(x => x.url).length, 1); assert.equal(notifications, 1);
  unsubscribe(); await f.client.refreshPlatformRuntime(); assert.equal(notifications, 1);
});
test('offline and malformed status cannot silently reopen a confirmed maintenance closure', async () => {
  const f = await fixture(); f.settings({ ...open, maintenanceMode: true }); await f.client.refreshPlatformRuntime();
  f.settings({ ...open, release: 'old' }); await f.client.refreshPlatformRuntime();
  assert.equal(f.client.getPlatformRuntimeSnapshot().settings.maintenanceMode, true);
  f.offline(); await f.client.refreshPlatformRuntime();
  const snapshot = f.client.getPlatformRuntimeSnapshot(); assert.equal(snapshot.status, 'failed');
  assert.equal(f.policy.platformRuntimeBlock('/office', snapshot), 'maintenance');
});
test('demo runtime does not request or change production configuration', async () => {
  const f = await fixture(); f.demo(); await f.client.refreshPlatformRuntime(); assert.equal(f.calls.length, 0);
  assert.deepEqual(plain(f.client.getPlatformRuntimeSnapshot().settings), open);
});
test('server status returns only the bounded projection and configuration failures remain closed', async () => {
  const f = await fixture(); f.settings({ ...open, api_key: 'private' });
  assert.deepEqual(plain(await f.edge.readPlatformRuntimeSettings(f.service)), open);
  assert.deepEqual(f.calls, [{ rpc: 'platform_get_runtime_settings' }]);
  f.failRpc(); await assert.rejects(f.edge.readPlatformRuntimeSettings(f.service), /runtime_unavailable/);
});
test('the real public GET handler returns runtime settings without breaking observation readiness', async () => {
  const f = await fixture(); await f.module(resolve(root, 'supabase/functions/platform-observation/index.ts'));
  const response = await f.handlers[0](new Request('https://site.test/', { method: 'GET' }));
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.ready, true);
  assert.equal(body.release, 'caresuite-platform-operations-20261007'); assert.deepEqual(body.runtime, open);
  f.failRpc(); const unavailable = await f.handlers[0](new Request('https://site.test/'));
  assert.equal(unavailable.status, 503); assert.equal((await unavailable.json()).ready, false);
});
test('the real registration handler rejects maintenance and paused registration before provisioning or mail', async () => {
  for (const settings of [{ ...open, maintenanceMode: true }, { ...open, registrationEnabled: false }]) {
    const f = await fixture(); f.settings(settings); await f.module(resolve(root, 'supabase/functions/register-business-tenant/index.ts'));
    const response = await f.handlers[0](new Request('https://site.test/', { method: 'POST', body: JSON.stringify({ valid: true, adminPassword: 'never-provisioned' }) }));
    assert.equal(response.status, 503); const body = await response.json(); assert.equal(body.ok, false);
    assert.ok(['maintenance_active', 'registration_paused'].includes(body.code));
    assert.equal(f.calls.some(x => x.provision || x.mail), false); assert.equal(JSON.stringify(body).includes('never-provisioned'), false);
  }
});
test('an unavailable server configuration never creates a company or sends welcome mail', async () => {
  const f = await fixture(); f.failRpc(); await f.module(resolve(root, 'supabase/functions/register-business-tenant/index.ts'));
  const response = await f.handlers[0](new Request('https://site.test/', { method: 'POST', body: JSON.stringify({ valid: true }) }));
  assert.equal(response.status, 503); assert.equal(f.calls.some(x => x.provision || x.mail), false);
});
test('open registration keeps the existing provisioning and welcome delivery flow', async () => {
  const f = await fixture(); await f.module(resolve(root, 'supabase/functions/register-business-tenant/index.ts'));
  const response = await f.handlers[0](new Request('https://site.test/', { method: 'POST', body: JSON.stringify({ valid: true }) }));
  assert.equal(response.status, 201); assert.equal(f.calls.filter(x => x.provision).length, 1); assert.equal(f.calls.filter(x => x.mail).length, 1);
});
test('the real web registration service stops before collecting or transmitting form contents when paused', async () => {
  for (const settings of [{ ...open, maintenanceMode: true }, { ...open, registrationEnabled: false }]) {
    const f = await fixture(); f.settings(settings);
    const business = (await f.module(resolve(root, 'src/lib/auth/businessAuthService.web.ts'))).namespace;
    const result = await business.registerBusinessTenant({ adminPassword: 'private', companyName: 'private company' });
    assert.equal(result.ok, false); assert.equal(f.calls.some(x => x.registrationRequest || x.observation), false);
    assert.equal(JSON.stringify(f.calls).includes('private'), false);
  }
});
test('the real web registration service rejects an unconfirmed status before sending the registration request', async () => {
  const f = await fixture(); f.offline();
  const business = (await f.module(resolve(root, 'src/lib/auth/businessAuthService.web.ts'))).namespace;
  const result = await business.registerBusinessTenant({ adminPassword: 'private' });
  assert.equal(result.ok, false); assert.equal(f.calls.some(x => x.registrationRequest || x.observation), false);
});
