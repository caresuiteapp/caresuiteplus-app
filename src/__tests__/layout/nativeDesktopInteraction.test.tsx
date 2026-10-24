// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MODULES, buildModuleDesktopNavigation, moduleDesktopStorageKey, buildDesktopAreaNavigation } from '@/liquid-command/navigation/moduleDesktopModel';
import { DESKTOP_AREAS, desktopAreaForRoute, desktopAreaStorageKey } from '@/liquid-command/navigation/desktopAreas';
import { nativeAdministrationRoute } from '@/liquid-command/navigation/nativeAdministrationModel';
import type { DesktopApp } from '@/liquid-command/navigation/desktopAppCatalogModel';
import { canShowDesktopCatalogRoute, desktopCatalogAreaForRoute, filterDesktopCatalogEntries } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { moveNativeDesktopWidget, nativeDesktopLayout } from '@/liquid-command/navigation/nativeDesktopLayout';
const memory = new Map<string, string>();
const api = { owner: 'a', tenant: 'tenant-a', width: 390, scale: 1, modules: ['office', 'assist'], push: vi.fn(), signOut: vi.fn(), getItem: vi.fn(), multiGet: vi.fn(), multiSet: vi.fn(), setItem: vi.fn() };
const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style ?? {};
const Box = (p: any) => <div data-testid={p.testID}>{p.children}</div>;
const native = {
  View: Box, ScrollView: Box, ImageBackground: Box, SafeAreaView: Box, KeyboardAvoidingView: Box, Image: () => null, ActivityIndicator: () => <span>Loading</span>,
  Text: (p: any) => <span>{p.children}</span>, TextInput: (p: any) => <input aria-label={p.accessibilityLabel} value={p.value} onInput={e => p.onChangeText(e.currentTarget.value)} />,
  Pressable: (p: any) => <button data-testid={p.testID} aria-label={p.accessibilityLabel} aria-selected={p.accessibilityState?.selected} disabled={p.disabled} onClick={p.onPress}>{p.children}</button>,
  Modal: (p: any) => p.visible ? <div role="dialog">{p.children}</div> : null,
  Platform: { OS: 'android' }, StyleSheet: { create: (s: any) => s, flatten }, useWindowDimensions: () => ({ width: api.width, height: 844, fontScale: api.scale }),
};
const dependencies: Record<string, unknown> = {
  '@/components/portal/accessibility/PortalTextSizeControls': { PortalTextSizeControls: () => null },
  '@/components/layout/TopbarProfileAvatar': { TopbarProfileAvatar: () => null },
  '../components/DesktopCatalogArtwork': { DesktopCatalogArtwork: () => null },
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: Box, useSafeAreaInsets: () => ({ left: 0, right: 0, top: 24, bottom: 16 }) },
  'expo-linear-gradient': { LinearGradient: Box }, '@expo/vector-icons/Feather': { __esModule: true, default: () => null },
  'expo-router': { useRouter: () => ({ push: api.push }) }, '@react-native-async-storage/async-storage': api,
  '@/lib/auth': { useAuth: () => ({ user: { id: api.owner, email: `${api.owner}@example.invalid` }, profile: { displayName: 'Verwaltung', roleKey: 'business_admin' }, signOut: api.signOut }) },
  '@/hooks/usePermissions': { usePermissions: () => ({ tenantId: api.tenant, roleKey: 'business_admin', can: () => true }) },
  '@/hooks/useModuleAccess': { useModuleAccess: () => ({ hasGate: (key: string) => api.modules.includes(key) }) },
  '@/hooks/useDesktopWeather.native': { useDesktopWeather: () => ({ data: null, place: null, message: 'Ort wählen', choosePlace: vi.fn() }) },
  './DesktopWeatherLocationDialog.native': { DesktopWeatherLocationDialog: () => null },
  '@/components/googleWorkspace/GoogleWorkspaceWidget.native': { GoogleWorkspaceWidget: (p: any) => <span>{p.service}</span> },
};
const compiled = buildSync({ entryPoints: ['src/liquid-command/screens/CommandCenterScreen.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.png': 'empty', '.jpg': 'empty' }, external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any }; new Function('require', 'module', 'exports', compiled)((id: string) => { if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`); return dependencies[id]; }, loaded, loaded.exports);
const Desktop = loaded.exports.CommandCenterScreen;
const catalogBundle = buildSync({ stdin: { contents: "export { buildDesktopApps } from './src/liquid-command/navigation/desktopAppCatalogModel'; export { WIDGETS } from './src/liquid-command/screens/administrationDesktopCatalog';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node', loader: { '.png': 'empty', '.jpg': 'empty' }, external: ['react-native'] }).outputFiles[0].text;
const catalog = { exports: {} as any };
new Function('require', 'module', 'exports', catalogBundle)((id: string) => { if (id === 'react-native') return native; throw new Error(`Unexpected catalog dependency ${id}`); }, catalog, catalog.exports);
const navigationCases = DESKTOP_AREAS.flatMap(module => buildDesktopAreaNavigation(
  [...new Map(filterDesktopCatalogEntries<DesktopApp>(catalog.exports.buildDesktopApps(catalog.exports.WIDGETS, 'business_admin').map((app: any) => ({ ...app, route: nativeAdministrationRoute(app.route) })), module.key, { roleKey: 'business_admin', can: () => true, hasModuleGate: () => true }).map(app => [app.route, app])).values()],
  module.key,
).flatMap(group => group.items).map(app => ({ module, app })));
let root: Root, host: HTMLDivElement;
const button = (label: string) => [...(host.querySelector('[role="dialog"]') ?? host).querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent === label);
const click = async (label: string) => { expect(button(label), label).toBeTruthy(); await act(async () => button(label)!.click()); };
const key = (area: 'office' | 'assist' = 'office') => desktopAreaStorageKey(api.tenant, api.owner, area);
const render = async () => { await act(async () => root.render(<Desktop />)); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; memory.clear(); api.owner = 'a'; api.tenant = 'tenant-a'; api.modules = ['office', 'assist']; api.width = 390; api.scale = 1; vi.clearAllMocks();
  api.getItem.mockReset().mockImplementation(async (k: string) => memory.get(k) ?? null); api.multiGet.mockReset().mockImplementation(async (keys: string[]) => keys.map(k => [k, memory.get(k) ?? null]));
  api.setItem.mockReset().mockImplementation(async (k: string, value: string) => { memory.set(k, value); }); api.multiSet.mockReset().mockImplementation(async (entries: string[][]) => { entries.forEach(([k, value]) => memory.set(k, value)); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('Native administration desktop interactions', () => {
  it.each(navigationCases)('opens $app.label in $module.label through the actual native navigation', async ({ module, app }) => {
    api.modules = DESKTOP_MODULES.map(item => item.key);
    await render();
    await click(module.label);
    await click('Navigation');
    await act(async () => host.querySelector<HTMLButtonElement>(`[data-testid="native-navigation-${app.id}"]`)!.click());
    expect(api.push).toHaveBeenLastCalledWith(nativeAdministrationRoute(app.route));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it('opens the current native desktop and searches its module navigation', async () => { await render(); expect(host.querySelector('[data-testid="native-administration-desktop"]')).toBeTruthy(); await click('Navigation'); const input = host.querySelector<HTMLInputElement>('[aria-label="Seiten suchen"]')!; await act(async () => { input.value = 'Rechnungen'; input.dispatchEvent(new Event('input', { bubbles: true })); }); await click('Rechnungen öffnen'); expect(api.push).toHaveBeenCalledWith('/business/office/invoices'); });
  it('preserves a deliberately empty desktop', async () => { memory.set(key(), '[]'); await render(); expect(host.textContent).toContain('Ihr Desktop ist frei'); expect(api.multiSet).not.toHaveBeenCalled(); });
  it('does not overwrite saved selections after a storage failure and supports retry', async () => { memory.set(key(), '["clients"]'); api.multiGet.mockRejectedValueOnce(new Error('storage locked')); await render(); expect(host.textContent).toContain('gespeicherte Auswahl bleibt erhalten'); expect(api.multiSet).not.toHaveBeenCalled(); await click('Erneut laden'); expect(host.querySelector('[data-testid="native-administration-desktop"]')).toBeTruthy(); expect(memory.get(key())).toBe('["clients"]'); });
  it('stores widget removal and ordering under the current tenant and account', async () => { memory.set(key(), '["clients","people","billing"]'); await render(); await click('Desktop bearbeiten'); await click('Personal nach vorne verschieben'); expect(JSON.parse(memory.get(key())!)).toEqual(['people', 'clients', 'billing']); await click('Klient:innen vom Desktop entfernen'); expect(JSON.parse(memory.get(key())!)).toEqual(['people', 'billing']); });
  it('migrates old widgets into separate areas without modifying the legacy selection', async () => {
    const office=moduleDesktopStorageKey(api.tenant, api.owner, 'office'); const assist=moduleDesktopStorageKey(api.tenant, api.owner, 'assist');
    memory.set(office, '["clients"]'); memory.set(assist, '["proofs"]'); await render();
    expect(button('Office')).toBeTruthy(); expect(button('Assist')).toBeTruthy(); expect(button('Klient:innen öffnen')).toBeTruthy();
    expect(JSON.parse(memory.get(key())!)).toEqual(['document-catalog', 'clients']);
    await click('Assist'); expect(host.textContent).toContain('Nachweise'); expect(button('Klient:innen öffnen')).toBeUndefined();
    expect(JSON.parse(memory.get(key('assist'))!)).toEqual(['proofs']); expect(memory.get(office)).toBe('["clients"]');
  });
  it('preserves the previous selection when migration cannot be saved and retries it', async () => {
    const previous = moduleDesktopStorageKey(api.tenant, api.owner, 'office');
    memory.set(previous, '["clients"]');
    api.multiSet.mockRejectedValueOnce(new Error('storage locked'));
    await render();
    expect(host.textContent).toContain('gespeicherte Auswahl bleibt erhalten');
    expect(memory.get(key())).toBeUndefined();
    expect(memory.get(previous)).toBe('["clients"]');
    await click('Erneut laden');
    expect(host.querySelector('[data-testid="native-administration-desktop"]')).toBeTruthy();
    expect(memory.get(key())).toBe('["document-catalog","clients"]');
  });
  it('clears the previous desktop on a tenant or account switch', async () => { memory.set(key(), '["clients"]'); await render(); api.owner = 'b'; api.tenant = 'tenant-b'; memory.set(key(), '[]'); await render(); expect(host.textContent).toContain('Ihr Desktop ist frei'); expect(memory.get(desktopAreaStorageKey('tenant-a', 'a', 'office'))).toBe('["clients"]'); });
  it('pins an Office widget on Assist without changing the Office desktop', async () => {
    memory.set(key(), '["people"]'); memory.set(key('assist'), '[]');
    await render(); await click('Assist'); await click('Apps und Widgets öffnen'); await click('Widgets');
    const dialog = host.querySelector('[role="dialog"]')!;
    const title = [...dialog.querySelectorAll('span')].find(item => item.textContent === 'Klient:innen');
    expect(title).toBeTruthy();
    const card = title!.parentElement!;
    const add = [...card.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Zum Desktop hinzufügen');
    expect(add).toBeTruthy(); await act(async () => add!.click());
    expect(JSON.parse(memory.get(key('assist'))!)).toContain('clients');
    expect(memory.get(key())).toBe('["people"]');
  });
  it('keeps dismissed widget suggestions hidden after reopening the desktop', async () => {
    memory.set(key(), '[]'); await render();
    const dismiss = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label')?.endsWith('als Vorschlag ausblenden'));
    expect(dismiss).toBeTruthy(); const label = dismiss!.getAttribute('aria-label')!;
    await act(async () => dismiss!.click());
    expect(button(label)).toBeUndefined(); expect(JSON.parse(memory.get(`${key()}.dismissed-suggestions.v1`)!)).toHaveLength(1);
    await act(async () => root.unmount()); root = createRoot(host); await render();
    expect(button(label)).toBeUndefined(); expect(memory.get(key())).toBe('[]');
  });
});
describe('Native desktop geometry', () => {
  it.each([[320,2],[360,2],[390,2],[412,2],[480,3]])('matches Web card thresholds at %d pixels', (width, columns) => { expect(nativeDesktopLayout(width).columns).toBe(columns); });
  it('reserves the same readable width for suggestions as Web', () => { expect(nativeDesktopLayout(390, 1, true).columns).toBe(1); expect(nativeDesktopLayout(1280, 1, true).columns).toBe(3); });
  it('provides a single column for enlarged accessibility text', () => { expect(nativeDesktopLayout(360, 2).columns).toBe(1); });
  it.each([320, 360, 390, 600, 768, 844, 1024, 1280, 1920].flatMap(width => [1, 1.3, 1.6, 2].map(scale => [width, scale])))('fits width %d with font scale %d without clipping the grid', (width, scale) => { const layout = nativeDesktopLayout(width, scale); const occupied = layout.cardWidth * layout.columns + layout.gap * (layout.columns - 1) + 2 * layout.padding + (layout.sidebar ? layout.sidebarWidth + layout.gap : 0); expect(occupied).toBeLessThanOrEqual(width + 0.001); expect(layout.cardWidth).toBeGreaterThan(0); if (width < 900 * scale) expect(layout.sidebar).toBe(false); });
  it('keeps widget ordering intact at both boundaries', () => { expect(moveNativeDesktopWidget(['a', 'b'], 'a', -1)).toEqual(['a', 'b']); expect(moveNativeDesktopWidget(['a', 'b'], 'b', 1)).toEqual(['a', 'b']); });
});
