// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moduleDesktopStorageKey } from '@/liquid-command/navigation/moduleDesktopModel';
import { moveNativeDesktopWidget, nativeDesktopLayout } from '@/liquid-command/navigation/nativeDesktopLayout';
const memory = new Map<string, string>();
const api = { owner: 'a', tenant: 'tenant-a', width: 390, scale: 1, modules: ['office', 'assist'], push: vi.fn(), signOut: vi.fn(), getItem: vi.fn(), multiGet: vi.fn(), multiSet: vi.fn(), setItem: vi.fn() };
const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style ?? {};
const Box = (p: any) => <div data-testid={p.testID}>{p.children}</div>;
const native = {
  View: Box, ScrollView: Box, ImageBackground: Box, SafeAreaView: Box, KeyboardAvoidingView: Box, Image: () => null, ActivityIndicator: () => <span>Loading</span>,
  Text: (p: any) => <span>{p.children}</span>, TextInput: (p: any) => <input aria-label={p.accessibilityLabel} value={p.value} onInput={e => p.onChangeText(e.currentTarget.value)} />,
  Pressable: (p: any) => <button aria-label={p.accessibilityLabel} aria-selected={p.accessibilityState?.selected} disabled={p.disabled} onClick={p.onPress}>{p.children}</button>,
  Modal: (p: any) => p.visible ? <div role="dialog">{p.children}</div> : null,
  Platform: { OS: 'android' }, StyleSheet: { create: (s: any) => s, flatten }, useWindowDimensions: () => ({ width: api.width, height: 844, fontScale: api.scale }),
};
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: Box, useSafeAreaInsets: () => ({ left: 0, right: 0, top: 24, bottom: 16 }) },
  'expo-router': { useRouter: () => ({ push: api.push }) }, '@react-native-async-storage/async-storage': api,
  '@/lib/auth': { useAuth: () => ({ user: { id: api.owner, email: `${api.owner}@example.invalid` }, profile: { displayName: 'Verwaltung', roleKey: 'business_admin' }, signOut: api.signOut }) },
  '@/hooks/usePermissions': { usePermissions: () => ({ tenantId: api.tenant, can: () => true }) },
  '@/hooks/useModuleAccess': { useModuleAccess: () => ({ hasGate: (key: string) => api.modules.includes(key) }) },
  '@/hooks/useDesktopWeather.native': { useDesktopWeather: () => ({ data: null, place: null, message: 'Ort wählen', choosePlace: vi.fn() }) },
  './DesktopWeatherLocationDialog.native': { DesktopWeatherLocationDialog: () => null },
  '@/components/googleWorkspace/GoogleWorkspaceWidget.native': { GoogleWorkspaceWidget: (p: any) => <span>{p.service}</span> },
};
const compiled = buildSync({ entryPoints: ['src/liquid-command/screens/CommandCenterScreen.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.png': 'empty', '.jpg': 'empty' }, external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any }; new Function('require', 'module', 'exports', compiled)((id: string) => { if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`); return dependencies[id]; }, loaded, loaded.exports);
const Desktop = loaded.exports.CommandCenterScreen;
let root: Root, host: HTMLDivElement;
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent === label);
const click = async (label: string) => { expect(button(label), label).toBeTruthy(); await act(async () => button(label)!.click()); };
const key = (module: 'office' | 'assist' = 'office') => moduleDesktopStorageKey(api.tenant, api.owner, module);
const render = async () => { await act(async () => root.render(<Desktop />)); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; memory.clear(); api.owner = 'a'; api.tenant = 'tenant-a'; api.modules = ['office', 'assist']; api.width = 390; api.scale = 1; vi.clearAllMocks();
  api.getItem.mockReset().mockImplementation(async (k: string) => memory.get(k) ?? null); api.multiGet.mockReset().mockImplementation(async (keys: string[]) => keys.map(k => [k, memory.get(k) ?? null]));
  api.setItem.mockReset().mockImplementation(async (k: string, value: string) => { memory.set(k, value); }); api.multiSet.mockReset().mockImplementation(async (entries: string[][]) => { entries.forEach(([k, value]) => memory.set(k, value)); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('Native administration desktop interactions', () => {
  it('opens the current native desktop and searches its module navigation', async () => { await render(); expect(host.querySelector('[data-testid="native-administration-desktop"]')).toBeTruthy(); await click('Navigation'); const input = host.querySelector<HTMLInputElement>('[aria-label="Seiten suchen"]')!; await act(async () => { input.value = 'Rechnungen'; input.dispatchEvent(new Event('input', { bubbles: true })); }); await click('Rechnungen öffnen'); expect(api.push).toHaveBeenCalledWith('/business/office/invoices'); });
  it('preserves a deliberately empty desktop', async () => { memory.set(key(), '[]'); await render(); expect(host.textContent).toContain('Ihr Desktop ist frei'); expect(api.multiSet).not.toHaveBeenCalled(); });
  it('does not overwrite saved selections after a storage failure and supports retry', async () => { memory.set(key(), '["clients"]'); api.multiGet.mockRejectedValueOnce(new Error('storage locked')); await render(); expect(host.textContent).toContain('gespeicherte Auswahl bleibt erhalten'); expect(api.multiSet).not.toHaveBeenCalled(); await click('Erneut laden'); expect(host.querySelector('[data-testid="native-administration-desktop"]')).toBeTruthy(); expect(memory.get(key())).toBe('["clients"]'); });
  it('stores widget removal and ordering under the current tenant, account and module', async () => { memory.set(key(), '["clients","people","billing"]'); await render(); await click('Desktop bearbeiten'); await click('Personal nach vorne verschieben'); expect(JSON.parse(memory.get(key())!)).toEqual(['people', 'clients', 'billing']); await click('Klient:innen vom Desktop entfernen'); expect(JSON.parse(memory.get(key())!)).toEqual(['people', 'billing']); });
  it('loads independent module settings and exposes only entitled modules', async () => { memory.set(key(), '["clients"]'); memory.set(key('assist'), '["proofs"]'); await render(); expect(button('Pflegedienst Ambulant')).toBeUndefined(); await click('Assist'); expect(host.textContent).toContain('Nachweise'); expect(button('Klient:innen öffnen')).toBeUndefined(); expect(memory.get(key())).toBe('["clients"]'); });
  it('clears the previous desktop on a tenant or account switch', async () => { memory.set(key(), '["clients"]'); await render(); api.owner = 'b'; api.tenant = 'tenant-b'; memory.set(key(), '[]'); await render(); expect(host.textContent).toContain('Ihr Desktop ist frei'); expect(memory.get(moduleDesktopStorageKey('tenant-a', 'a', 'office'))).toBe('["clients"]'); });
});
describe('Native desktop geometry', () => {
  it.each([320, 360, 390, 600, 768, 844, 1024, 1280, 1920].flatMap(width => [1, 1.3, 1.6, 2].map(scale => [width, scale])))('fits width %d with font scale %d without clipping the grid', (width, scale) => { const layout = nativeDesktopLayout(width, scale); const occupied = layout.cardWidth * layout.columns + layout.gap * (layout.columns - 1) + 2 * layout.padding + (layout.sidebar ? layout.sidebarWidth + layout.gap : 0); expect(occupied).toBeLessThanOrEqual(width + 0.001); expect(layout.cardWidth).toBeGreaterThan(0); if (width < 980 * scale) expect(layout.sidebar).toBe(false); });
  it('keeps widget ordering intact at both boundaries', () => { expect(moveNativeDesktopWidget(['a', 'b'], 'a', -1)).toEqual(['a', 'b']); expect(moveNativeDesktopWidget(['a', 'b'], 'b', 1)).toEqual(['a', 'b']); });
});
