import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

// Bypass the unit-suite's null expo-router alias. Use the installed Android
// file selector and linking parser, with actual app filenames and catalogues.
// Page imports are inert; navigator lifecycle is tested separately.
const nodeRequire = createRequire(join(process.cwd(), 'package.json'));
const { getRoutes } = nodeRequire('expo-router/build/getRoutes');
const { getReactNavigationConfig } = nodeRequire('expo-router/build/getReactNavigationConfig');
const parserPath = nodeRequire.resolve('expo-router/build/fork/getStateFromPath');
const parserRequire = createRequire(parserPath), parser = { exports: {} as any };
new Function('require', 'module', 'exports', readFileSync(parserPath, 'utf8'))((id: string) => {
  // The parser uses only this function from the native UI export barrel.
  // Load that exact installed function without initializing native hosts.
  return id === '../react-navigation/native'
    ? nodeRequire('expo-router/build/react-navigation/core/validatePathConfig')
    : parserRequire(id);
}, parser, parser.exports);
const { getStateFromPath } = parser.exports;

const appRoot = join(process.cwd(), 'app'), keys: string[] = [];
function collectRoutes(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectRoutes(path);
    else if (/\.[jt]sx?$/.test(path)) keys.push('./' + relative(appRoot, path).replaceAll('\\', '/'));
  }
}
collectRoutes(appRoot);
const context = Object.assign((key: string) => ({ default: () => null, source: key }), {
  keys: () => keys, resolve: (key: string) => key, id: 'actual-native-app-files',
});
const routeTree = getRoutes(context, { platform: 'android', ignoreRequireErrors: true, ignoreEntryPoints: true });
const config = getReactNavigationConfig(routeTree, true);

// Exercise the installed imperative action builder as well as deep-link parsing.
// The store contains navigation state only; no page or device host is substituted.
let currentState: any;
const actionPath = nodeRequire.resolve('expo-router/build/global-state/getNavigationAction');
const actionRequire = createRequire(actionPath), actions = { exports: {} as any };
const redirectPath = nodeRequire.resolve('expo-router/build/getRoutesRedirects');
const redirectRequire = createRequire(redirectPath), redirects = { exports: {} as any };
new Function('require', 'module', 'exports', readFileSync(redirectPath, 'utf8'))((id: string) => id === 'expo-linking'
  ? { openURL: () => { throw Error('An internal page unexpectedly opened an external URL.'); } }
  : redirectRequire(id), redirects, redirects.exports);
new Function('require', 'module', 'exports', readFileSync(actionPath, 'utf8'))((id: string) => id === './store' ? {
  store: { assertIsReady() {}, navigationRef: { current: { getRootState: () => currentState } }, linking: { config, getStateFromPath }, getRouteInfo: () => ({}), redirects: [] },
} : id === '../getRoutesRedirects' ? redirects.exports : actionRequire(id), actions, actions.exports);
function navigators(state: any, path = 'root'): any {
  return { ...state, type: 'stack', key: path, index: state.index ?? state.routes.length - 1,
    routes: state.routes.map((route: any, index: number) => ({ ...route, key: `${path}:${index}`, ...(route.state ? { state: navigators(route.state, `${path}/${route.name}`) } : {}) })) };
}
function activeNames(state: any): string[] {
  const names: string[] = [];
  while (state?.routes?.length) { const route = state.routes[state.index ?? state.routes.length - 1]; names.push(route.name); state = route.state; }
  return names;
}
const nativePages = new Map<string, string>();
function collectNativePages(node: any, parent = '') {
  const path = `${parent}/${node.route ?? ''}`;
  if (node.type === 'route' && !node.generated && !node.contextKey.includes('/+not-found.')) {
    const href = '/' + path.split('/').filter((part: string) => part && part !== 'index' && !/^\(.+\)$/.test(part)).map((part: string) => /^\[\.\.\./.test(part) ? 'fixture-one/fixture-two' : /^\[.+\]$/.test(part) ? 'fixture-id' : part).join('/');
    nativePages.set(href, node.contextKey);
  }
  for (const child of node.children ?? []) collectNativePages(child, path);
}
collectNativePages(routeTree);

const catalogueCode = buildSync({
  stdin: { contents: `
    export { buildDesktopApps } from './src/liquid-command/navigation/desktopAppCatalogModel';
    export { WIDGETS } from './src/liquid-command/screens/administrationDesktopCatalog';
    export { DESKTOP_AREAS } from './src/liquid-command/navigation/desktopAreas';
    export { buildDesktopAreaNavigation } from './src/liquid-command/navigation/moduleDesktopModel';
    export { nativeAdministrationRoute } from './src/liquid-command/navigation/nativeAdministrationModel';
    export { filterDesktopCatalogEntries } from './src/liquid-command/navigation/appsWidgetsCatalogModel.shared';
    export { liquidPortalNavigation } from './src/liquid-command/navigation/portalCatalog';
  `, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'cjs', platform: 'node',
  loader: { '.png': 'empty', '.jpg': 'empty' }, external: ['react-native'],
}).outputFiles[0].text;
const catalogue = { exports: {} as any };
new Function('require', 'module', 'exports', catalogueCode)((id: string) => {
  if (id === 'react-native') return { Platform: { OS: 'android' } };
  throw Error('Unexpected catalogue dependency: ' + id);
}, catalogue, catalogue.exports);
const source = catalogue.exports;
type Case = { role: string; label: string; href: string; origins?: string[] };
const desktopCases: Case[] = [];
for (const role of ['business_admin', 'business_manager', 'billing', 'dispatch']) {
  const access = { roleKey: role, can: () => true, hasModuleGate: () => true };
  const apps = source.buildDesktopApps(source.WIDGETS, role).map((app: any) => ({ ...app, route: source.nativeAdministrationRoute(app.route) }));
  for (const area of source.DESKTOP_AREAS.filter((area: any) => ['office', 'assist', 'settings', 'premium', 'robotics'].includes(area.key))) {
    const active = source.filterDesktopCatalogEntries(apps, area.key, access);
    for (const app of active) desktopCases.push({ role, label: `Apps/${area.key}/${app.label}`, href: app.route });
    for (const group of source.buildDesktopAreaNavigation(active, area.key)) {
      for (const app of group.items) desktopCases.push({ role, label: `Navigation/${area.key}/${app.label}`, href: app.route });
    }
  }
}
// The parser is independent of menu placement. Retain every originating
// Apps/navigation entry while parsing each role/destination pair once.
const unique = new Map<string, Case>();
for (const row of desktopCases) {
  const key = JSON.stringify([row.role, row.href]), previous = unique.get(key);
  if (previous) previous.origins!.push(row.label);
  else unique.set(key, { ...row, origins: [row.label] });
}
const cases: Case[] = [...unique.values()];
for (const [kind, items] of Object.entries(source.liquidPortalNavigation) as [string, any[]][]) {
  for (const item of items) cases.push({ role: `${kind}_portal`, label: item.label, href: item.route });
}
cases.push(
  { role: 'family_portal', label: 'Akademie-Familienportal', href: '/portal/client/akademie?view=overview' },
  { role: 'employee_portal', label: 'Ausführung mit Original-ID', href: '/portal/employee/assignments/fixture-assignment/execute?resume=1' },
  { role: 'client_portal', label: 'Einsatz mit Original-ID', href: '/portal/client/appointments/fixture-appointment?from=calendar' },
);

function resolve(href: string) {
  let state = getStateFromPath(href, config), node = routeTree, leaf: any;
  expect(state, href).toBeTruthy();
  while (state?.routes?.length) {
    leaf = state.routes[state.index ?? state.routes.length - 1];
    expect(leaf.name, href).not.toContain('+not-found');
    node = node.children.find((child: any) => child.route === leaf.name);
    expect(node, href + ': ' + leaf.name).toBeTruthy();
    state = leaf.state;
  }
  return { node, leaf };
}

function selectedPagePattern(contextKey: string): RegExp {
  const segments = contextKey.replace(/^\.\//, '').replace(/(?:\.(?:android|native))?\.[jt]sx?$/, '').split('/')
    .filter(segment => segment !== 'index' && !/^\(.+\)$/.test(segment));
  return new RegExp('^/' + segments.map(segment => /^\[\.\.\./.test(segment) ? '.+' : /^\[.+\]$/.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '/?$');
}

describe('installed Expo Router resolves the actual native application catalogue', () => {
  it.each([...nativePages])('selects an actual page for application path %s (%s)', (href) => {
    const { node } = resolve(href);
    expect(node.type).toBe('route'); expect(node.generated).not.toBe(true);
    expect(href).toMatch(selectedPagePattern(node.contextKey));
  });
  it('selects and loads every Web receiver without executing Android or native route modules', () => {
    const webContext = Object.assign((key: string) => {
      if (/\.(?:native|android|ios)\.[jt]sx?$/.test(key)) throw Error('Native route executed in Web: ' + key);
      return { default: () => null, source: key };
    }, { keys: () => keys, resolve: (key: string) => key, id: 'actual-web-app-files' });
    const tree = getRoutes(webContext, { platform: 'web', ignoreRequireErrors: false, ignoreEntryPoints: true });
    const receivers: string[] = [];
    function inspect(node: any) {
      if (!node.generated) {
        expect(node.contextKey).not.toMatch(/\.(?:native|android|ios)\.[jt]sx?$/);
        expect(node.loadRoute().source).toBe(node.contextKey);
        receivers.push(node.contextKey);
      }
      for (const child of node.children) inspect(child);
    }
    inspect(tree);
    expect(receivers.length).toBeGreaterThan(600);
    expect(receivers).toContain('./akademie/auswertungen.web.tsx');
  });
  it('includes every active catalogue and navigation entry plus representative portal links', () => {
    expect(new Set(desktopCases.map(row => row.href)).size).toBeGreaterThan(40);
    expect(cases.flatMap(row => row.origins ?? []).some(label => label.startsWith('Apps/'))).toBe(true);
    expect(cases.flatMap(row => row.origins ?? []).some(label => label.startsWith('Navigation/'))).toBe(true);
    expect(cases.reduce((count, row) => count + (row.origins?.length ?? 0), 0)).toBe(desktopCases.length);
    expect(new Set(cases.map(row => row.role)).size).toBe(7);
  });
  it.each(cases)('$role $label resolves $href to its native page and retains parameters', ({ href }) => {
    const url = new URL(href, 'https://fixture.invalid');
    url.searchParams.set('auditKeep', 'a/b &?');
    url.searchParams.append('auditRepeated', 'one'); url.searchParams.append('auditRepeated', 'two');
    const { node, leaf } = resolve(url.pathname + url.search);
    expect(node.type).toBe('route'); expect(node.generated).not.toBe(true);
    expect(url.pathname, node.contextKey).toMatch(selectedPagePattern(node.contextKey));
    expect(leaf.params.auditKeep).toBe('a/b &?'); expect(leaf.params.auditRepeated).toEqual(['one', 'two']);
    for (const key of new Set(url.searchParams.keys())) {
      const values = url.searchParams.getAll(key);
      expect(leaf.params[key], href + ': ' + key).toEqual(values.length === 1 ? values[0] : values);
    }
    if (url.pathname !== '/business') expect(node.contextKey).not.toMatch(/business\/\(tabs\)\/index/);
    if (url.pathname.includes('/fixture-assignment/')) expect(leaf.params.id).toBe('fixture-assignment');
    if (url.pathname.includes('/fixture-appointment')) expect(leaf.params.id).toBe('fixture-appointment');
  });
  it.each(cases)('$role $label builds its correct imperative target from desktop, Office and QM', ({ href }) => {
    for (const origin of ['/business', '/office', '/office/qm']) {
      currentState = navigators(getStateFromPath(origin, config));
      const action = actions.exports.getNavigateAction(href, {}, 'PUSH');
      expect(action?.type).toBe('PUSH');
      let target: any;
      function find(state: any) { if (state.key === action.target) target = state; for (const route of state.routes) if (route.state) find(route.state); }
      find(currentState); expect(target, `${origin} -> ${href}`).toBeTruthy();
      const intended = activeNames(getStateFromPath(href, config));
      const payload: string[] = [action.payload.name]; let params = action.payload.params;
      while (params?.screen) { payload.push(params.screen); params = params.params; }
      expect(intended.slice(-payload.length), `${origin} -> ${href}`).toEqual(payload);
    }
  });
  it('selects actual native source files for the previously misdirected destinations', () => {
    for (const [href, file] of [
      ['/business/office/clients', './business/office/clients/index.native.tsx'],
      ['/business/office/documents', './business/office/documents/index.native.tsx'],
      ['/business/connect/google-workspace?tab=calendar', './business/connect/google-workspace.native.tsx'],
      ['/unternehmen', './unternehmen.native.tsx'], ['/office/notizen', './office/notizen.native.tsx'],
    ]) expect(resolve(href).node.contextKey).toBe(file);
  });
});
