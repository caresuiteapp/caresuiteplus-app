// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveDesktopGridLayout } from '@/lib/platform/desktopGridLayout';

const memory = new Map<string, string>();
const api = { owner: 'a', width: 1440, scale: 1, push: vi.fn(), getItem: vi.fn(), multiSet: vi.fn() };
const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style ?? {};
const Box = (p: any) => <div data-testid={p.testID} id={p.nativeID} aria-hidden={p['aria-hidden']} style={flatten(p.style)}>{p.children}</div>;
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
  'expo-router': { useRouter: () => ({ push: api.push }) },
  '@react-native-async-storage/async-storage': { getItem: api.getItem, multiSet: api.multiSet },
  '@/components/googleWorkspace/GoogleWorkspaceWidget.web': { GoogleWorkspaceWidget: (p: any) => <div data-preview={p.preview}>{p.service}</div> },
  './DesktopWeatherLocationDialog.web': { DesktopWeatherLocationDialog: () => null },
  '@/lib/auth': { useAuth: () => ({ user: { id: api.owner }, profile: { displayName: 'Testverwaltung' }, signOut: vi.fn() }) },
  '@/components/portal/accessibility/PortalTextSizeControls': { PortalTextSizeControls: () => <button>Textgröße ändern</button> },
  '@/components/layout/TopbarProfileAvatar': { TopbarProfileAvatar: () => null },
  '@/design/web/WebFontScaleProvider': { useWebFontScale: () => ({ scale: api.scale }) },
  '@/lib/platform/desktopGridLayout': { resolveDesktopGridLayout },
  '@/hooks/useDesktopWeather': { useDesktopWeather: () => ({ status: 'idle', data: null, message: 'Standort verwenden', refresh: vi.fn() }) },
};
// Compile the actual Web component; images are omitted and service/host boundaries are simulated.
const compiled = buildSync({ entryPoints: ['src/liquid-command/screens/CommandCenterScreen.web.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.png': 'empty', '.jpg': 'empty' }, external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', compiled)((id: string) => {
  if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
  return dependencies[id];
}, loaded, loaded.exports);
const Desktop = loaded.exports.CommandCenterScreen;
const key = (owner = api.owner) => `caresuite.healthos.desktop-widgets.v3.${owner}`;
const sidebarKey = (owner = api.owner) => `caresuite.healthos.sidebar-open.v2.${owner}`;
let root: Root, host: HTMLDivElement;
const label = (text: string) => host.querySelector(`[aria-label="${text}"]`) as HTMLButtonElement | null;
const button = (text: string) => [...host.querySelectorAll<HTMLElement>('button, [role="button"]')].find(b => b.textContent === text)!;
const render = async () => { await act(async () => root.render(<Desktop />)); };
const click = async (b: HTMLElement | null) => { expect(b).toBeTruthy(); await act(async () => b!.click()); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  memory.clear(); api.owner = 'a'; api.width = 1440; api.scale = 1; vi.clearAllMocks();
  api.getItem.mockReset().mockImplementation(async (k: string) => memory.get(k) ?? null);
  api.multiSet.mockImplementation(async (values: string[][]) => { values.forEach(([k, v]) => memory.set(k, v)); });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Web desktop preferences and navigation', () => {
  it.each([{ ids: [] }, { ids: ['messages', 'clients', 'messages', 'unknown'] }])('preserves the explicitly stored widget list $ids', async ({ ids }) => {
    memory.set(key(), JSON.stringify(ids)); await render();
    expect(JSON.parse(memory.get(key())!)).toEqual(ids.length ? ['messages', 'clients'] : []);
    expect(host.textContent).toContain(`${ids.length ? 2 : 0}/12 aktiv`);
  });
  it('keeps a removed widget removed after remounting the desktop', async () => {
    await render(); await click(button('✎  Bearbeiten')); await click(label('Klient:innen entfernen'));
    expect(label('Klient:innen öffnen')).toBeNull();
    await act(async () => root.unmount()); root = createRoot(host); await render();
    expect(label('Klient:innen öffnen')).toBeNull(); expect(host.textContent).toContain('11/12 aktiv');
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
    await act(async () => resolve(null)); expect(host.textContent).toContain('12/12 aktiv');
    expect(JSON.parse(memory.get(key('a'))!)).toEqual(['messages']);
  });
  it('allows a failed preferences read to be retried without overwriting stored choices', async () => {
    memory.set(key(), JSON.stringify(['messages'])); api.getItem.mockRejectedValueOnce(new Error('Storage unavailable'));
    await render(); expect(host.textContent).toContain('Desktop-Einstellungen konnten nicht geladen werden');
    expect(api.multiSet).not.toHaveBeenCalled();
    await click(button('Erneut versuchen')); expect(host.textContent).toContain('1/12 aktiv');
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
    expect(label('Standort für Wetter verwenden')).not.toBeNull();
    await click(label('Apps und Widgets öffnen'));
    const field = label('Apps durchsuchen') as unknown as HTMLInputElement;
    await act(async () => { field.value = 'KeinTreffer123'; field.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(host.textContent).toContain('Keine passenden Apps');
    await click(button('Suche zurücksetzen')); expect(field.value).toBe('');
    expect(host.textContent).toContain('Übersicht · Arbeitsbereiche');
  });
});


const dialog = () => host.querySelector('[role="dialog"]')!;
const catalogButton = (text: string) => [...dialog().querySelectorAll<HTMLElement>('[role="button"], [role="tab"]')].find(b => b.textContent === text)!;
const typeInto = async (name: string, value: string) => {
  const input = label(name) as unknown as HTMLInputElement;
  await act(async () => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); });
};

describe('App centre categories and distinct actions', () => {
  it('opens full apps without changing the desktop and lists every Workspace service', async () => {
    await render(); const before = memory.get(key()); await click(label('Apps und Widgets öffnen'));
    expect(catalogButton('Alle')).toBeUndefined(); await click(catalogButton('Workspace'));
    expect(dialog().textContent).toContain('Google Meet'); expect(dialog().textContent).toContain('Kontakte');
    expect(dialog().textContent).not.toContain('Desktop voll');
    expect(dialog().querySelector('[data-testid="widget-catalog"]')).toBeNull();
    await click(label('App Kontakte öffnen'));
    expect(api.push).toHaveBeenCalledWith('/business/connect/google-workspace?service=contacts');
    expect(memory.get(key())).toBe(before);
  });
  it('removes and adds desktop widgets in place, enforces capacity, and preserves the category', async () => {
    await render(); await click(label('Apps und Widgets öffnen')); await click(catalogButton('Widgets'));
    await click(catalogButton('Workspace'));
    expect(label('Gmail zum Desktop hinzufügen')?.getAttribute('aria-disabled')).toBe('true');
    expect(dialog().querySelector('[data-testid="app-catalog"]')).toBeNull();
    await click(catalogButton('Versorgung')); await click(label('Klient:innen vom Desktop entfernen'));
    expect(dialog().textContent).toContain('11 von 12'); expect(api.push).not.toHaveBeenCalled();
    await click(catalogButton('Workspace')); await click(label('Gmail zum Desktop hinzufügen'));
    expect(JSON.parse(memory.get(key())!)).toContain('google-gmail');
    expect(dialog().textContent).toContain('12 von 12');
    await click(label('Gmail vom Desktop entfernen'));
    expect(JSON.parse(memory.get(key())!)).not.toContain('google-gmail'); expect(api.push).not.toHaveBeenCalled();
    await typeInto('Widgets durchsuchen', 'kein-treffer'); await click(catalogButton('Suche zurücksetzen'));
    expect(dialog().textContent).toContain('Workspace · Desktop-Widgets');
  });
  it('opens the Widgets tab when adding an empty desktop tile', async () => {
    memory.set(key(), '[]'); await render(); await click(label('Widget hinzufügen'));
    expect(dialog().querySelector('[data-testid="widget-catalog"]')).not.toBeNull();
  });
  it('finds pages outside the old shortlist and opens their actual destination', async () => {
    await render(); await typeInto('Seiten in der Navigation suchen', 'MD-Prüfbereitschaft');
    expect(label('Seite MD-Prüfbereitschaft öffnen')).not.toBeNull();
    expect(label('Seite Rechnungen öffnen')).toBeNull();
    await click(label('Seite MD-Prüfbereitschaft öffnen'));
    expect(api.push).toHaveBeenCalledWith('/pflege/md-pruefbereitschaft');
    await typeInto('Seiten in der Navigation suchen', 'Kontakte');
    await click(label('Seite Kontakte öffnen'));
    expect(api.push).toHaveBeenLastCalledWith('/business/connect/google-workspace?service=contacts');
  });
});
