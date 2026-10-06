import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { test } from 'node:test';

// Executes the real TypeScript policy and service without installing dependencies.
// Network/database boundaries are replaced; no production records are written.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const context = createContext({ URL, console });
const cache = new Map();
const calls = [];
let systemRows = [];
const request = (name, result = {}) => async (...args) => {
  calls.push({ name, args });
  return { ok: true, data: result };
};
const boundaries = {
  './index': {
    platformRoleHasCapability: () => true,
    PLATFORM_ROLE_LABELS: { platform_owner: 'Inhaber', platform_readonly: 'Lesezugriff' },
    listPlatformPlans: request('plans'), listPlatformAddonsCatalog: request('addons'),
    listPlatformDiscountCatalog: request('discounts'), listPlatformInvoices: request('billing'),
    listPlatformPayments: request('payments'), listPlatformPlanVersions: request('planVersions'),
    listPlatformAddonVersions: request('addonVersions'),
    listPlatformModules: request('modules', [{ module_key: 'office', module_name: 'Unternehmensverwaltung' }]),
    listPlatformSystemSettings: async () => { calls.push({ name: 'settings' }); return { ok: true, data: systemRows }; },
    setPlatformFeatureFlag: request('flag'), registerPlatformRelease: request('release'),
    updatePlatformSystemSetting: request('setting'),
  },
  './platformSupabaseClient': {
    platformRpc: async (...args) => { calls.push({ name: 'rpc', args }); return { data: {}, error: null }; },
  },
  './platformCompanyDirectoryService': {
    listPlatformCompanies: async () => { calls.push({ name: 'directory' }); return { ok: true, data: { items: [] } }; },
  },
  '@/lib/services/mode': { getServiceMode: () => 'supabase' },
};
async function getModule(file) {
  if (cache.has(file)) return cache.get(file);
  const source = stripTypeScriptTypes(await readFile(file, 'utf8'), { mode: 'strip' });
  const module = new SourceTextModule(source, { context, identifier: file });
  cache.set(file, module);
  return module;
}
async function linker(specifier, importer) {
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
  assert.ok(specifier.startsWith('.'), 'Unexpected dependency: ' + specifier);
  return getModule(resolve(dirname(importer.identifier), specifier + '.ts'));
}
async function realModule(relative) {
  const module = await getModule(resolve(root, relative));
  if (module.status === 'unlinked') await module.link(linker);
  if (module.status !== 'evaluated') await module.evaluate();
  return module.namespace;
}
const policy = await realModule('src/lib/platformConsole/platformFreePolicy.ts');
const capabilities = await realModule('src/lib/platformConsole/platformCapabilities.ts');
const service = await realModule('src/lib/platformConsole/consoleWorkspaceService.ts');
const navigation = await realModule('src/lib/platformConsole/platformNavigation.ts');
const retired = ['plans', 'addons', 'discounts', 'billing', 'payments'];
const roles = ['platform_owner', 'platform_admin', 'platform_billing', 'platform_support', 'platform_developer', 'platform_readonly'];
const commercial = ['plans.read', 'plans.write', 'discounts.read', 'discounts.write', 'billing.read', 'billing.write', 'payments.read', 'payments.write'];
const empty = { rows: [], tenants: [], related: [], warnings: [], hasMore: false };
const query = { search: '', status: '', tenantId: '', offset: 0 };

test('commercial permissions stay denied for every role, including the owner', () => {
  for (const role of [...roles, null, undefined]) for (const capability of commercial) {
    assert.equal(capabilities.platformRoleHasCapability(role, capability), false, `${role}: ${capability}`);
  }
  assert.equal(capabilities.platformRoleHasCapability('platform_owner', 'tenants.write'), true);
  assert.equal(capabilities.platformRoleHasCapability('platform_admin', 'modules.write'), true);
  assert.equal(capabilities.platformRoleHasCapability('platform_support', 'support.write'), true);
  assert.equal(capabilities.platformRoleHasCapability('platform_developer', 'flags.write'), true);
  assert.equal(capabilities.platformRoleHasCapability('platform_readonly', 'tenants.write'), false);
});
for (const section of retired) test(`old ${section} links never load catalogs or offer actions`, async () => {
  calls.length = 0;
  assert.deepEqual(JSON.parse(JSON.stringify(await service.loadConsoleData(section, query, 'platform_owner'))), empty);
  assert.equal(service.consoleActions(section, null, empty).length, 0);
  assert.equal(service.consoleActions(section, { plan_key: 'legacy', addon_key: 'legacy', status: 'active' }, empty).length, 0);
  assert.equal((await service.loadConsoleVersions(section, { plan_key: 'legacy', addon_key: 'legacy' })).length, 0);
  assert.equal(calls.length, 0);
});
test('navigation keeps accounts and support, with no commercial pages', () => {
  const paths = Array.from(navigation.PLATFORM_NAV_ITEMS, item => item.path);
  for (const section of retired) assert.ok(!paths.includes('/platform/' + section));
  for (const path of ['/platform/tenants', '/platform/modules', '/platform/feature-flags', '/platform/support', '/platform/users', '/platform/audit']) assert.ok(paths.includes(path));
  assert.match(policy.PLATFORM_FREE_USAGE, /vollständig kostenlos/);
  assert.match(policy.PLATFORM_FUTURE_PREMIUM, /derzeit nicht verfügbar/);
});
test('function administration still saves a catalog change', async () => {
  calls.length = 0;
  const loaded = await service.loadConsoleData('modules', query, 'platform_owner');
  assert.equal(loaded.rows[0].module_name, 'Unternehmensverwaltung');
  await service.consoleActions('modules', null, empty)[0].run({ key: 'office', name: 'Unternehmensverwaltung', category: '', description: '', status: 'available' }, 'Funktionsbeschreibung geprüft');
  assert.equal(calls.at(-1).args[0], 'platform_save_module_catalog');
  assert.equal(calls.at(-1).args[1].p_status, 'available');
});
test('scoped releases preserve company validation and explicit verification state', async () => {
  calls.length = 0;
  const flag = service.consoleActions('feature-flags', null, empty)[0];
  await assert.rejects(flag.run({ key: 'feature_v2', scope: 'tenant', tenant: '', enabled: 'true', rollout: '100' }, 'Freigabe geprüft'));
  await assert.rejects(flag.run({ key: 'feature_v2', scope: 'global', enabled: 'true', rollout: '101' }, 'Freigabe geprüft'));
  assert.equal(calls.length, 0);
  await flag.run({ key: 'feature_v2', scope: 'tenant', tenant: 'company-a', enabled: 'true', rollout: '100' }, 'Freigabe geprüft');
  assert.equal(calls.at(-1).args[3].tenantId, 'company-a');
  await service.consoleActions('releases', null, empty)[0].run({ version: 'Test', environment: 'preview', status: 'ready', commit: 'abcdef0', url: '', migration: '', build: 'not_checked', smoke: 'failed', visual: 'not_checked', notes: '' }, 'Prüfstand dokumentiert');
  assert.equal(calls.at(-1).args[0].checks.smoke, 'failed');
  assert.equal(calls.at(-1).args[0].checks.visual, 'not_checked');
});
test('trial and payment settings are hidden; free usage cannot be switched off in the UI', async () => {
  calls.length = 0;
  systemRows = [{ setting_key: 'default_trial_days', value: 14 }, { setting_key: 'invoice_due_days', value: 14 }, { setting_key: 'free_platform_enabled', value: true }, { setting_key: 'maintenance_mode', value: false }];
  const loaded = await service.loadConsoleData('system', query, 'platform_owner');
  assert.deepEqual(Array.from(loaded.rows, row => row.setting_key), ['free_platform_enabled', 'maintenance_mode']);
  for (const row of systemRows.slice(0, 3)) assert.equal(service.consoleActions('system', row, empty).length, 0);
  assert.equal(service.consoleActions('system', systemRows[3], empty).length, 1);
});
