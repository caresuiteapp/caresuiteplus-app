// @vitest-environment happy-dom
import React, { act, forwardRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { desktopAreaStorageKey } from '@/liquid-command/navigation/desktopAreas';

const memory = new Map<string, string>();
const api = { user: 'user-a', tenant: 'tenant-a', push: vi.fn(), setParams: vi.fn(), getItem: vi.fn(), setItem: vi.fn(), multiSet: vi.fn() };
const Box = forwardRef<HTMLDivElement, any>((props, ref) => <div ref={ref} data-testid={props.testID}>{props.children}</div>);
const Pressable = forwardRef<HTMLDivElement, any>((props, ref) => <div ref={ref} role={props.accessibilityRole ?? 'button'} aria-label={props.accessibilityLabel} aria-disabled={props.disabled} onClick={props.disabled ? undefined : props.onPress}>{props.children}</div>);
const native = {
  Platform: { OS: 'web' }, StyleSheet: { create: (value: any) => value, flatten: (value: any): any => Array.isArray(value) ? Object.assign({}, ...value.map(native.StyleSheet.flatten)) : value ?? {} },
  Image: () => null, ImageBackground: Box, Text: (props: any) => <span>{props.children}</span>,
  TextInput: (props: any) => <input aria-label={props.accessibilityLabel} value={props.value} onInput={event => props.onChangeText(event.currentTarget.value)} />,
  Modal: (props: any) => props.visible ? <div role="dialog">{props.children}</div> : null,
  useWindowDimensions: () => ({ width: 1440, height: 1000 }),
};
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native,
  '@/lib/platform/reactNativeWebCompat.web': { WebView: Box, WebPressable: Pressable, WebScrollView: Box },
  'expo-router': { useRouter: () => ({ push: api.push, setParams: api.setParams }), usePathname: () => '/Desktop', useLocalSearchParams: () => ({}) },
  '@react-native-async-storage/async-storage': api,
  '@/lib/auth': { useAuth: () => ({ authReady: true, isAuthenticated: true, user: { id: api.user }, profile: { roleKey: 'business_admin' }, signOut: vi.fn() }) },
  '@/hooks/usePermissions': { usePermissions: () => ({ tenantId: api.tenant, roleKey: 'business_admin', can: () => true, hasModuleGate: (module: string) => module === 'office' }) },
  '@/hooks/useModuleAccess': { useModuleAccess: () => ({}) },
  '@/hooks/useDesktopWeather.web': { useDesktopWeather: () => ({ data: null, place: null, message: 'Standort wählen' }) },
  '@/design/web/WebFontScaleProvider': { useWebFontScale: () => ({ scale: 1, effectiveScale: 1 }) },
  '@/components/portal/accessibility/PortalTextSizeControls.web': { PortalTextSizeControls: () => null },
  '@/components/help/HelpButton.web': { HelpButton: () => null },
  '@/components/layout/TopbarProfileAvatar': { TopbarProfileAvatar: () => null },
  '@/components/googleWorkspace/GoogleWorkspaceWidget.web': { GoogleWorkspaceWidget: () => null },
  '@/components/layout/platform/platformmodal': { PlatformModal: (props: any) => props.visible ? <div role="dialog" aria-label={props.title}>{props.children}{props.footerContent}</div> : null },
  './DesktopWeatherLocationDialog.web': { DesktopWeatherLocationDialog: () => null },
};
const bundle = buildSync({ entryPoints: ['src/liquid-command/screens/CommandCenterScreen.web.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.png': 'empty', '.jpg': 'empty' }, external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', bundle)((id: string) => {
  if (!(id in dependencies)) throw new Error(`Unexpected desktop dependency: ${id}`);
  return dependencies[id];
}, loaded, loaded.exports);
const Desktop = loaded.exports.CommandCenterScreen;
const key = () => desktopAreaStorageKey(api.tenant, api.user, 'office');
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; memory.clear(); api.user = 'user-a'; api.tenant = 'tenant-a'; vi.clearAllMocks();
  api.getItem.mockReset().mockImplementation(async (name: string) => memory.get(name) ?? null);
  api.setItem.mockReset().mockImplementation(async (name: string, value: string) => { memory.set(name, value); });
  api.multiSet.mockReset().mockImplementation(async (entries: [string, string][]) => { entries.forEach(([name, value]) => memory.set(name, value)); });
  memory.set(`${key()}.document-catalog.v1`, '1');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<Desktop />)); };
const click = async (label: string) => { const button = host.querySelector<HTMLElement>(`[aria-label="${label}"]`); expect(button, label).toBeTruthy(); await act(async () => button!.click()); };

describe('Office Notes in the actual Web desktop', () => {
  it('introduces and opens the widget, then respects removal after a full remount', async () => {
    memory.set(key(), '["clients","people"]'); await render();
    expect(JSON.parse(memory.get(key())!)).toEqual(['clients', 'people', 'notes']);
    expect(memory.get(`${key()}.notes.v1`)).toBe('1');
    await click('Notizen öffnen'); expect(api.push).toHaveBeenCalledWith('/office/notizen');
    await click('Desktop bearbeiten'); await click('Notizen entfernen');
    expect(JSON.parse(memory.get(key())!)).toEqual(['clients', 'people']);
    await act(async () => root.unmount()); root = createRoot(host); await render();
    expect(host.querySelector('[aria-label="Notizen öffnen"]')).toBeNull();
    expect(JSON.parse(memory.get(key())!)).toEqual(['clients', 'people']);
    const search = host.querySelector<HTMLInputElement>('[aria-label="Seiten in der Navigation suchen"]')!;
    await act(async () => { search.value = 'Notizen'; search.dispatchEvent(new Event('input', { bubbles: true })); });
    await click('Seite Notizen öffnen'); expect(api.push).toHaveBeenLastCalledWith('/office/notizen');
  });

  it('keeps a chosen empty desktop empty while making Notes discoverable', async () => {
    memory.set(key(), '[]'); await render();
    expect(memory.get(key())).toBe('[]'); expect(memory.get(`${key()}.notes.v1`)).toBe('1');
    expect(host.querySelector('[aria-label="Notizen öffnen"]')).toBeNull();
    await click('Seite Notizen öffnen'); expect(api.push).toHaveBeenCalledWith('/office/notizen');
  });

  it('does not overwrite preferences or mark introduction after a failed read', async () => {
    memory.set(key(), '["clients"]'); api.getItem.mockImplementation(async (name: string) => { if (name === key()) throw new Error('storage unavailable'); return memory.get(name) ?? null; });
    await render(); expect(memory.get(key())).toBe('["clients"]'); expect(memory.has(`${key()}.notes.v1`)).toBe(false); expect(api.multiSet).not.toHaveBeenCalled();
  });
});
