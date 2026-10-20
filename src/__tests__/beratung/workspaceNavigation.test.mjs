import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
async function navigation(platform, enabled) {
  const result = await build({
    stdin: { contents: `
      export * from './src/lib/modules/constants';
      export * from './src/liquid-command/navigation/moduleCatalog';
      export * from './src/liquid-command/navigation/desktopAppCatalogModel';
      export * from './src/liquid-command/navigation/appsWidgetsCatalogModel.web';
      export * from './src/lib/navigation/routes';
      export { buildCatalogWorkspace } from './src/lib/catalog/catalogWorkspaceModel.web';
      export { filterCompanyCatalog } from './src/lib/tenant/tenantServiceCatalogEditor';
    `, resolveDir: root, loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'esm',
    define: { 'process.env.EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED': JSON.stringify(String(enabled)) },
    tsconfigRaw: { compilerOptions: { baseUrl: root, paths: { '@/*': ['src/*'] } } },
    plugins: [{ name: 'platform', setup(b) {
      b.onResolve({ filter: /^react-native$/ }, () => ({ path: 'platform', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const Platform={OS:${JSON.stringify(platform)}};`, loader: 'js' }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}

for (const [platform, enabled] of [['web', false], ['web', true], ['android', true], ['ios', true]]) {
  test(`consultation navigation: ${platform}, release=${enabled}`, async () => {
    const n = await navigation(platform, enabled);
    const released = platform === 'web' && enabled;
    assert.equal(n.isUnreleasedModuleKey('beratung'), !released);
    assert.ok(n.SPECIALTY_MODULE_KEYS.includes('beratung'));
    // Releasing visit documentation must not release the unfinished price catalog.
    const catalogItems = ['assist', 'pflege', 'stationaer', 'beratung'].map(moduleKey => ({
      id: moduleKey, moduleKey, serviceKey: `${moduleKey}.test`, name: 'Leistung',
      description: '', category: 'service', unit: 'hour', isActive: true, sortOrder: 1,
      defaultPriceNet: null, defaultTaxMode: 'none',
    }));
    assert.deepEqual(n.filterCompanyCatalog(catalogItems, 'all', '').map(item => item.moduleKey), ['assist']);
    assert.deepEqual(n.buildCatalogWorkspace([], [], ['assist', 'pflege', 'stationaer', 'beratung'], true, '2026-10-19').catalogs.map(item => item.moduleKey), ['assist']);
    for (const module of ['pflege', 'stationaer', 'akademie']) {
      assert.equal(n.isUnreleasedModuleKey(module), true);
      assert.equal(n.getUnreleasedModuleKeyFromPath(`/${module}/detail`), module);
    }
    for (const path of ['/beratung', '/beratung/', '/beratung/arbeitsplatz', '/beratung/arbeitsplatz/00000000-0000-4000-8000-000000000001?visit=visit']) {
      assert.equal(n.getUnreleasedModuleKeyFromPath(path), released ? null : 'beratung');
    }
    for (const path of ['/beratung/faelle', '/beratung/protokolle/new', '/beratung/arbeitsplatz-alt', '/beratung/arbeitsplatz/id/alt']) {
      assert.equal(n.getUnreleasedModuleKeyFromPath(path), 'beratung');
    }
    const required = ['office.access', 'beratung.access', 'beratung.cases.view', 'office.clients.view_sensitive'];
    const access = { roleKey: 'counselor', hasModuleGate: key => key === 'beratung', can: key => required.includes(key) };
    assert.equal(n.canShowDesktopCatalogRoute('/beratung/arbeitsplatz', access), released);
    assert.equal(n.canShowDesktopCatalogRoute('/beratung/arbeitsplatz', { ...access, hasModuleGate: () => false }), false);
    assert.equal(n.canShowDesktopCatalogRoute('/beratung/arbeitsplatz', { ...access, roleKey: 'employee_portal' }), false);
    for (const denied of required) {
      assert.equal(n.canShowDesktopCatalogRoute('/beratung/arbeitsplatz', { ...access, can: key => key !== denied && required.includes(key) }), false);
    }
    const apps = n.buildDesktopApps([], 'counselor').filter(app => app.route.startsWith('/beratung'));
    if (released) {
      assert.deepEqual(apps.map(app => app.route), ['/beratung/arbeitsplatz']);
      assert.deepEqual(n.liquidWorkAreas.beratung.map(area => area.route), ['/beratung/arbeitsplatz']);
      assert.equal(n.getRouteByPath('/beratung/arbeitsplatz/id').productKey, 'beratung');
      assert.ok(n.getRouteByPath('/beratung/arbeitsplatz/id').allowedRoles.includes('counselor'));
    } else assert.deepEqual(apps, []);
  });
}
