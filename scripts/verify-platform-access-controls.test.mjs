import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const context = createContext({ console, URL, Date });
const cache = new Map();
const calls = [], signouts = [];
let mode = 'supabase', response = { data: { message: 'Änderung bestätigt', status: 'terminated' }, error: null }, throwNetwork = false;
const boundaries = {
  '@/lib/services/mode': { getServiceMode: () => mode },
  '@/lib/supabase/client': { getSupabaseClient: () => ({
    rpc: async (name, args) => { calls.push({ name, args }); if (throwNetwork) throw new Error('network'); return response; },
    auth: { signOut: async options => { signouts.push(options); return { error: null }; } },
  }) },
};
async function moduleAt(file) {
  if (cache.has(file)) return cache.get(file);
  const module = new SourceTextModule(stripTypeScriptTypes(await readFile(file, 'utf8')), { context, identifier: file });
  cache.set(file, module); return module;
}
async function link(specifier, importer) {
  if (boundaries[specifier]) {
    const key = 'boundary:' + specifier;
    if (!cache.has(key)) {
      const values = boundaries[specifier];
      cache.set(key, new SyntheticModule(Object.keys(values), function () {
        for (const [name, value] of Object.entries(values)) this.setExport(name, value);
      }, { context, identifier: key }));
    }
    return cache.get(key);
  }
  const path = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2) + '.ts') : resolve(dirname(importer.identifier), specifier + '.ts');
  return moduleAt(path);
}
async function real(relative) {
  const module = await moduleAt(resolve(root, relative));
  if (module.status === 'unlinked') await module.link(link);
  if (module.status !== 'evaluated') await module.evaluate();
  return module.namespace;
}
const model = await real('src/lib/platformConsole/platformAccessLifecycle.ts');
const service = await real('src/lib/platformConsole/platformAccessService.ts');
const accounts = await real('src/lib/platformConsole/platformAccountService.ts');
const login = await real('src/lib/auth/businessAccessService.web.ts');
const reset = () => { mode = 'supabase'; calls.length = 0; signouts.length = 0; throwNetwork = false; response = { data: { message: 'Änderung bestätigt', status: 'terminated' }, error: null }; };
const input = { tenantId: 'company-a', action: 'deactivate', expectedStatus: 'active', expectedUpdatedAt: '2026-10-07T08:00:00.000Z', confirmation: 'DEAKTIVIEREN', reason: ' Auftrag der Geschäftsführung ' };
const plain = value => JSON.parse(JSON.stringify(value));
test('company actions match the current lifecycle and deleted companies require restoration first', () => {
  assert.deepEqual(plain(model.tenantAccessActions('active')), ['suspend', 'deactivate', 'delete']);
  assert.deepEqual(plain(model.tenantAccessActions('terminated')), ['reactivate', 'delete']);
  assert.deepEqual(plain(model.tenantAccessActions('deleted_soft')), ['restore']);
  assert.deepEqual(plain(model.tenantAccessActions('suspended')), ['unsuspend', 'deactivate', 'delete']);
  assert.deepEqual(plain(model.tenantAccessActions('unknown')), []);
});
test('account deactivation is distinguished from an independently blocked or archived account', () => {
  assert.deepEqual(plain(model.accountAccessActions('inactive', 'blocked')), ['reactivate', 'delete']);
  assert.deepEqual(plain(model.accountAccessActions('active', 'blocked')), ['delete']);
  assert.deepEqual(plain(model.accountAccessActions('deleted', 'archived')), ['restore']);
  assert.deepEqual(plain(model.accountAccessActions('active', 'archived')), []);
});
test('removal requires the exact selected company/account name; deactivation is explicit', () => {
  assert.equal(model.tenantAccessConfirmation('delete', ' Firma A '), 'Firma A');
  assert.equal(model.accountAccessConfirmation('delete', ' Leitung A '), 'Leitung A');
  assert.equal(model.tenantAccessConfirmation('deactivate', 'Firma A'), 'DEAKTIVIEREN');
  assert.equal(model.accountAccessConfirmation('reactivate', 'Leitung A'), undefined);
  assert.match(model.tenantAccessDescription('delete', 'Firma A'), /keine endgültige Datenlöschung/);
});
test('company requests bind the displayed version and confirmation and trim the reason', async () => {
  reset(); assert.equal((await service.managePlatformTenantAccess(input)).ok, true);
  assert.deepEqual(plain(calls), [{ name: 'platform_manage_tenant_access', args: {
    p_tenant_id: 'company-a', p_action: 'deactivate', p_expected_status: 'active', p_expected_updated_at: input.expectedUpdatedAt,
    p_confirmation: 'DEAKTIVIEREN', p_reason: 'Auftrag der Geschäftsführung',
  } }]);
});
test('account requests remain scoped to the company and selected account without an Auth deletion', async () => {
  reset(); await service.managePlatformAccountAccess({ ...input, tenantUserId: 'account-a' });
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'platform_manage_account_access');
  assert.equal(calls[0].args.p_tenant_id, 'company-a'); assert.equal(calls[0].args.p_tenant_user_id, 'account-a');
  assert.equal(signouts.length, 0);
});
test('invalid version, missing reason and oversized reason never start a write', async () => {
  reset();
  for (const bad of [{ expectedUpdatedAt: '' }, { expectedUpdatedAt: 'invalid' }, { expectedStatus: '' }, { reason: 'x' }, { reason: 'x'.repeat(1001) }])
    assert.equal((await service.managePlatformTenantAccess({ ...input, ...bad })).ok, false);
  assert.equal(calls.length, 0);
});
test('preview mode never changes company or account access', async () => {
  reset(); mode = 'demo';
  assert.equal((await service.managePlatformTenantAccess(input)).ok, false);
  assert.equal((await service.managePlatformAccountAccess({ ...input, tenantUserId: 'account-a' })).ok, false);
  assert.equal(calls.length, 0);
});
test('server role denial and stale records are returned in German without reporting success', async () => {
  reset(); response = { data: null, error: { message: 'platform_forbidden', code: '42501' } };
  assert.match((await service.managePlatformTenantAccess(input)).error, /Rolle/);
  response = { data: null, error: { message: 'access_record_changed', code: '40001' } };
  assert.match((await service.managePlatformTenantAccess(input)).error, /zwischenzeitlich geändert/);
});
test('the last active owner receives a concrete German recovery instruction', async () => {
  reset(); response = { data: null, error: { message: 'last_tenant_owner_protected' } };
  assert.match((await service.managePlatformAccountAccess({ ...input, tenantUserId: 'account-a' })).error, /weiteres Geschäftsführungskonto/);
});
test('malformed server results and network interruptions do not confirm a change', async () => {
  reset(); response = { data: {}, error: null };
  assert.match((await service.managePlatformTenantAccess(input)).error, /nicht bestätigt/);
  throwNetwork = true;
  assert.match((await service.managePlatformTenantAccess(input)).error, /verbindung/i);
});
test('deleted accounts are requested explicitly without changing mail operation routes', async () => {
  reset(); response = { data: { items: [] }, error: null };
  await accounts.listPlatformAccounts('company-a'); await accounts.listPlatformAccounts('company-a', true);
  assert.equal(calls[0].name, 'platform_list_tenant_account_access');
  assert.equal(calls[0].args.p_include_deleted, false); assert.equal(calls[1].args.p_include_deleted, true);
});
test('active business access preserves the current session', async () => {
  reset(); response = { data: { allowed: true }, error: null };
  assert.equal((await login.checkBusinessAccess()).ok, true); assert.equal(signouts.length, 0);
});
test('deactivated business access ends only the current device session', async () => {
  reset(); response = { data: { allowed: false, message: 'Zugang deaktiviert' }, error: null };
  assert.equal((await login.checkBusinessAccess()).error, 'Zugang deaktiviert');
  assert.deepEqual(plain(signouts), [{ scope: 'local' }]);
});
test('an unavailable or malformed access check stops login and clears the local session', async () => {
  for (const bad of [{ data: null, error: { message: 'unavailable' } }, { data: {}, error: null }]) {
    reset(); response = bad;
    assert.equal((await login.checkBusinessAccess()).ok, false); assert.deepEqual(plain(signouts), [{ scope: 'local' }]);
  }
  reset(); throwNetwork = true;
  assert.equal((await login.checkBusinessAccess()).ok, false); assert.deepEqual(plain(signouts), [{ scope: 'local' }]);
});
