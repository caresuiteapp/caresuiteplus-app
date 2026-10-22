// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moduleDesktopStorageKey } from '@/liquid-command/navigation/moduleDesktop.web';
import { resolveDesktopGridLayout } from '@/lib/platform/desktopGridLayout';
import { desktopAreaStorageKey } from '@/liquid-command/navigation/desktopAreas';

const memory = new Map<string, string>();
const api = { owner: 'a', width: 1440, scale: 1, push: vi.fn(), getItem: vi.fn(), multiSet: vi.fn(), setItem: vi.fn() };
const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style ?? {};
const Box = (p: any) => <div data-testid={p.testID} id={p.nativeID} aria-label={p.accessibilityLabel} aria-hidden={p['aria-hidden']} style={flatten(p.style)}>{p.children}</div>;
const Pressable = (p: any) => <div role={p.accessibilityRole ?? "button"} aria-label={p.accessibilityLabel} aria-selected={p.accessibilityState?.selected} aria-expanded={p.accessibilityState?.expanded} aria-disabled={p.disabled} onClick={p.disabled ? undefined : p.onPress}>{p.children}</div>;
class Value {
  constructor(public value: number) {}
  setValue(value: number) { this.value = value; }
  interpolate({ outputRange }: any) { return this.value ? outputRange.at(-1) : outputRange[0]; }
}
const native = {
  View: Box, ScrollView: Box, ImageBackground: (p: any) => <div data-testid={p.testID}>{p.children}</div>,
  Text: (p: any) => <span>{p.children}</span>, Image: () => null, Pressable,
  TextInput: (p: any) => <input aria-label={p.accessibilityLabel} value={p.value} onInput={e => p.onChangeText(e.currentTarget.value)} />,
  Modal: (p: any) => p.visible ? <div role="dialog">{p.children}</div> : null,
  Platform: { OS: 'web' }, StyleSheet: { create: (s: any) => s, flatten, absoluteFill: {} },
  useWindowDimensions: () => ({ width: api.width, height: 900 }),
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
  Animated: { Value, View: Box, timing: (value: Value, { toValue }: any) => ({ start: () => value.setValue(toValue) }) },
  Easing: { out: (fn: any) => fn, cubic: (n: number) => n },
};
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native,
  '@/lib/platform/reactNativeWebCompat.web': { WebView: Box, WebPressable: Pressable, WebScrollView: Box },
  'expo-router': { usePathname: () => '/', useLocalSearchParams: () => ({}), useRouter: () => ({ push: api.push, setParams: vi.fn() }) },
  '@react-native-async-storage/async-storage': { getItem: api.getItem, multiSet: api.multiSet, setItem: api.setItem },
  '@/components/googleWorkspace/GoogleWorkspaceWidget.web': { GoogleWorkspaceWidget: (p: any) => <div data-preview={p.preview}>{p.service}</div> },
  './DesktopWeatherLocationDialog.web': { DesktopWeatherLocationDialog: () => null },
  '@/hooks/usePermissions': { usePermissions: () => ({ tenantId: 'tenant', roleKey: 'business_admin', can: () => true, hasModuleGate: (module: string) => ['office', 'assist'].includes(module) }) },
  '@/hooks/useModuleAccess': { useModuleAccess: () => ({}) },
  '@/lib/auth': { useAuth: () => ({ authReady: true, isAuthenticated: true, user: { id: api.owner }, profile: { displayName: 'Testverwaltung', roleKey: 'business_admin' }, signOut: vi.fn() }) },
  '@/components/portal/accessibility/PortalTextSizeControls.web': { PortalTextSizeControls: () => <button>Textgröße ändern</button> },
  '@/components/layout/TopbarProfileAvatar': { TopbarProfileAvatar: () => null },
  '@/design/web/WebFontScaleProvider': { useWebFontScale: () => ({ scale: api.scale, effectiveScale: api.scale * (api.width < 900 ? 0.9 : 1) }) },
  '@/lib/platform/desktopGridLayout': { resolveDesktopGridLayout },
  '@/hooks/useDesktopWeather.web': { useDesktopWeather: () => ({ status: 'idle', data: null, place: null, message: 'Standort verwenden', refresh: vi.fn() }) },
  '@/components/layout/platform/platformmodal': { PlatformModal: (p: any) => p.visible ? <div role="dialog" aria-label={p.title}>{p.headerActions}{p.children}{p.footerContent}</div> : null },
};
// Compile the actual Web component; images are omitted and service/host boundaries are simulated.
const compiled = buildSync({ entryPoints: ['src/liquid-command/screens/CommandCenterScreen.web.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.png': 'empty', '.jpg': 'empty', '.svg': 'empty' }, external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', compiled)((id: string) => {
  if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
  return dependencies[id];
}, loaded, loaded.exports);
const Desktop = loaded.exports.CommandCenterScreen;
const key = (owner = api.owner) => desktopAreaStorageKey('tenant', owner, 'office');
const sidebarKey = (owner = api.owner) => `caresuite.healthos.sidebar-open.v2.${owner}`;
let root: Root, host: HTMLDivElement;
const label = (text: string) => host.querySelector(`[aria-label="${text}"]`) as HTMLButtonElement | null;
const button = (text: string) => [...host.querySelectorAll<HTMLElement>('button, [role="button"]')].find(b => b.textContent === text)!;
const render = async () => { await act(async () => root.render(<Desktop />)); };
const click = async (b: HTMLElement | null | undefined) => { expect(b).toBeTruthy(); await act(async () => b!.click()); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  memory.clear(); api.owner = 'a'; api.width = 1440; api.scale = 1; vi.clearAllMocks();
  // Catalogue introductions have dedicated interaction tests. These cases
  // exercise established preferences after those introductions were seen.
  for (const owner of ['a', 'b']) { memory.set(`${key(owner)}.notes.v1`, '1'); memory.set(`${key(owner)}.document-catalog.v1`, '1'); }
  api.getItem.mockReset().mockImplementation(async (k: string) => memory.get(k) ?? null);
  api.setItem.mockImplementation(async (k: string, v: string) => { memory.set(k, v); });
  api.multiSet.mockImplementation(async (values: string[][]) => { values.forEach(([k, v]) => memory.set(k, v)); });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Web desktop preferences and navigation', () => {
  it('opens the help center from the top bar without changing desktop preferences', async () => {
    await render();
    const before = new Map(memory);
    await click(label('Hilfe & Anleitungen öffnen'));
    expect(api.push).toHaveBeenCalledWith('/hilfe');
    expect(memory).toEqual(before);
  });
  it.each([{ ids: [] }, { ids: ['messages', 'clients', 'messages', 'unknown'] }])('preserves the explicitly stored widget list $ids', async ({ ids }) => {
    memory.set(key(), JSON.stringify(ids)); await render();
    expect(JSON.parse(memory.get(key())!)).toEqual(ids.length ? ['messages', 'clients', 'unknown'] : []);
    expect(host.textContent).toContain(`${ids.length ? 2 : 0}/12 aktiv`);
  });
  it('keeps a removed widget removed after remounting the desktop', async () => {
    await render(); await click(label('Desktop bearbeiten')); await click(label('Klient:innen entfernen'));
    expect(label('Klient:innen öffnen')).toBeNull();
    await act(async () => root.unmount()); root = createRoot(host); await render();
    expect(label('Klient:innen öffnen')).toBeNull(); expect(host.textContent).toContain('9/12 aktiv');
  });
  it('does not expose or overwrite a previous account’s preferences while the next account loads', async () => {
    memory.set(key(), JSON.stringify(['messages'])); await render();
    await click(label('Apps und Widgets öffnen'));
    let resolve!: (value: string | null) => void;
    const pending = new Promise<string | null>(done => { resolve = done; });
    api.getItem.mockImplementation((k: string) => k === key('b') ? pending : Promise.resolve(null));
    api.owner = 'b'; await render();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(label('Nachrichten öffnen')).toBeNull(); expect(memory.has(key('b'))).toBe(false);
    await act(async () => resolve(null)); expect(host.textContent).toContain('10/12 aktiv');
    expect(JSON.parse(memory.get(key('a'))!)).toEqual(['messages']);
  });
  it('allows a failed preferences read to be retried without overwriting stored choices', async () => {
    memory.set(key(), JSON.stringify(['messages'])); api.getItem.mockImplementation((k: string) => k === key() ? Promise.reject(new Error('Storage unavailable')) : Promise.resolve(memory.get(k) ?? null));
    await render(); expect(host.textContent).toContain('Desktop-Einstellungen konnten nicht geladen werden');
    expect(api.multiSet).not.toHaveBeenCalled();
    api.getItem.mockImplementation(async (k: string) => memory.get(k) ?? null); await click(button('Erneut versuchen')); expect(host.textContent).toContain('1/12 aktiv');
  });
  it('keeps the compact menu separate from the saved wide-screen preference and closes it after navigation', async () => {
    memory.set(sidebarKey(), 'true'); api.width = 780; await render();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await click(label('Navigation öffnen')); expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await click(label('Seite Klient:innen öffnen')); expect(api.push).toHaveBeenCalledWith('/business/office/clients');
    expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(memory.get(sidebarKey())).toBe('true');
    api.width = 1440; await render(); expect(label('Navigation schließen')).not.toBeNull();
    api.width = 780; await render(); expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it('keeps text-size controls reachable in narrow windows and offers recovery from an empty search', async () => {
    api.width = 780; api.scale = 1.5; await render(); expect(button('Textgröße ändern')).toBeTruthy();
    expect(host.querySelector('[data-testid=desktop-clock-weather]')).not.toBeNull();
    expect(label('Wetterort ändern')).not.toBeNull();
    await click(label('Apps und Widgets öffnen'));
    const field = label('Apps durchsuchen') as unknown as HTMLInputElement;
    await typeInto('Apps durchsuchen', 'KeinTreffer123');
    expect(host.textContent).toContain('Keine passenden Apps');
    await click(button('Filter zurücksetzen')); expect(field.value).toBe('');
    expect(host.textContent).toContain('Ihre Arbeitsbereiche');
  });
});


const dialog = () => host.querySelector('[role="dialog"]')!;
const visibleText = (element: HTMLElement) => { const copy = element.cloneNode(true) as HTMLElement; copy.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove()); return copy.textContent?.trim(); };
const catalogButton = (text: string) => [...dialog().querySelectorAll<HTMLElement>('button, [role="button"], [role="tab"]')].find(b => visibleText(b) === text)!;
const areaTab = (text: string) => [...host.querySelectorAll<HTMLElement>('[data-testid="desktop-workspace-header"] [role="tab"]')].find(b => b.textContent === text)!;
const typeInto = async (name: string, value: string) => {
  const input = label(name) as unknown as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('App centre categories and distinct actions', () => {
  it('opens full apps without changing the desktop and lists every Workspace service', async () => {
    await render(); const before = memory.get(key()); await click(label('Apps und Widgets öffnen'));
    expect(catalogButton('Alle')).toBeTruthy(); await click(catalogButton('Workspace'));
    expect(dialog().textContent).toContain('Google Meet'); expect(dialog().textContent).toContain('Kontakte');
    expect(dialog().textContent).not.toContain('Desktop voll');
    expect(dialog().querySelector('[data-testid="center-widget-catalog"]')).toBeNull();
    await click(label('App Kontakte öffnen'));
    expect(api.push).toHaveBeenCalledWith('/business/connect/google-workspace?service=contacts');
    expect(memory.get(key())).toBe(before);
  });
  it('adds and removes widgets in place, paginates beyond twelve, and preserves the category', async () => {
    memory.set(key(), JSON.stringify(['clients','people','logbook','time','salary','billing','documents','messages','access','inventory','audit','office']));
    await render(); await click(label('Apps und Widgets öffnen')); await click(catalogButton('Widgets'));
    await click(catalogButton('Workspace'));
    expect(label('Gmail zum Desktop hinzufügen')?.disabled).toBe(false);
    expect(dialog().querySelector('[data-testid="center-app-catalog"]')).toBeNull();
    await click(label('Gmail zum Desktop hinzufügen'));
    expect(JSON.parse(memory.get(key())!)).toContain('google-gmail');
    expect(dialog().textContent).toContain('13 Widgets');
    expect(dialog().textContent).toContain('Auf 2 Seiten verteilt');
    expect(catalogButton('Workspace').getAttribute('aria-pressed')).toBe('true');
    await click(label('Gmail vom Desktop entfernen'));
    expect(JSON.parse(memory.get(key())!)).not.toContain('google-gmail'); expect(api.push).not.toHaveBeenCalled();
    await typeInto('Widgets durchsuchen', 'kein-treffer'); await click(catalogButton('Filter zurücksetzen'));
    expect(dialog().textContent).toContain('Ihr Desktop, Ihre Auswahl');
  });
  it('opens the Widgets tab when adding an empty desktop tile', async () => {
    memory.set(key(), '[]'); await render(); await click(label('Widget hinzufügen'));
    expect(dialog().querySelector('[data-testid="center-widget-catalog"]')).not.toBeNull();
  });
  it('finds released pages outside the old shortlist and opens their actual destination', async () => {
    await render(); await typeInto('Seiten in der Navigation suchen', 'Audit');
    expect(label('Seite Änderungsprotokoll öffnen')).not.toBeNull();
    expect(label('Seite Rechnungen öffnen')).toBeNull();
    await click(label('Seite Änderungsprotokoll öffnen'));
    expect(api.push).toHaveBeenCalledWith('/business/office/audit-log');
    await typeInto('Seiten in der Navigation suchen', 'Hilfe');
    expect(label('Seite Support & Hilfe öffnen')).toBeNull();
  });
});


describe('area desktops with the permitted navigation', () => {
  it('keeps area tabs and changes navigation with the selected desktop', async () => {
    await render();
    const header = host.querySelector('[data-testid=desktop-workspace-header]')!;
    expect(header.querySelector('[aria-label="Desktop-Modul auswählen"]')).toBeNull();
    expect(header.querySelectorAll('[role="tab"]')).toHaveLength(9);
    expect(label('Seite Rechnungen öffnen')).not.toBeNull();
    expect(label('Seite Einsätze öffnen')).toBeNull();
    await click(areaTab('Assist'));
    expect(label('Seite Einsätze öffnen')).not.toBeNull();
    expect(label('Seite Rechnungen öffnen')).not.toBeNull();
  });
  it('keeps an explicitly empty legacy desktop empty during migration', async () => {
    memory.set(`caresuite.healthos.desktop-widgets.v3.${api.owner}`, '[]'); await render();
    expect(JSON.parse(memory.get(key())!)).toEqual([]);
  });
  it('migrates previous Office and Assist choices separately and restores the selected area', async () => {
    const office = moduleDesktopStorageKey('tenant', api.owner, 'office');
    const assist = moduleDesktopStorageKey('tenant', api.owner, 'assist');
    memory.set(office, '["clients"]'); memory.set(assist, '["assignments"]');
    await render();
    expect(label('Klient:innen öffnen')).not.toBeNull();
    expect(label('Einsätze öffnen')).toBeNull();
    expect(JSON.parse(memory.get(key())!)).toEqual(['clients']);
    await click(areaTab('Assist'));
    expect(label('Einsätze öffnen')).not.toBeNull();
    expect(JSON.parse(memory.get(desktopAreaStorageKey('tenant', api.owner, 'assist'))!)).toEqual(['assignments']);
    await act(async () => root.unmount()); root = createRoot(host); await render();
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(label('Einsätze öffnen')).not.toBeNull();
    expect(memory.get(office)).toBe('["clients"]');
    expect(memory.get(assist)).toBe('["assignments"]');
  });
  it('keeps an overflow widget reachable on the next desktop page after migration', async () => {
    const ids = ['clients','people','logbook','time','salary','billing','documents','messages','access','inventory','audit','office','google-gmail'];
    memory.set(moduleDesktopStorageKey('tenant', api.owner, 'office'), JSON.stringify(ids));
    await render();
    expect(JSON.parse(memory.get(key())!)).toEqual(ids);
    expect(label('Gmail öffnen')).toBeNull();
    await click(label('Nächste Desktop-Seite'));
    expect(label('Gmail öffnen')).not.toBeNull();
    expect(host.textContent).toContain('2/2');
  });
  it('recovers omitted saved widgets only after an explicit action, keeping the current order', async () => {
    memory.set(key(), '["messages"]');
    memory.set(moduleDesktopStorageKey('tenant', api.owner, 'office'), '["clients","messages"]');
    await render(); expect(label('Klient:innen öffnen')).toBeNull();
    await click(label('Apps und Widgets öffnen')); await click(catalogButton('Widgets'));
    await click(catalogButton('Gespeicherte Widgets wiederherstellen'));
    expect(JSON.parse(memory.get(key())!)).toEqual(['messages', 'clients']);
    expect(memory.get(moduleDesktopStorageKey('tenant', api.owner, 'office'))).toBe('["clients","messages"]');
  });
});
