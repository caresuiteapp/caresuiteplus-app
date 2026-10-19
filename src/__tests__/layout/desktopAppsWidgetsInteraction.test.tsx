// @vitest-environment happy-dom
import React, { act, forwardRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { desktopAreaStorageKey, type DesktopAreaKey } from '@/liquid-command/navigation/desktopAreas';

const memory = new Map<string, string>();
const api = {
  user: 'user-a', tenant: 'tenant-a', width: 1440, scale: 1,
  denied: new Set<string>(), modules: new Set(['office', 'assist']),
  push: vi.fn(), getItem: vi.fn(), setItem: vi.fn(), multiSet: vi.fn(),
};
const Box = forwardRef<HTMLDivElement, any>((props, ref) => <div ref={ref} data-testid={props.testID} id={props.nativeID} aria-label={props.accessibilityLabel}>{props.children}</div>);
const Pressable = forwardRef<HTMLButtonElement, any>((props, ref) => <button type="button" ref={ref} role={props.accessibilityRole} aria-label={props.accessibilityLabel} aria-selected={props.accessibilityState?.selected} aria-disabled={props.disabled} disabled={props.disabled} onClick={props.disabled ? undefined : props.onPress}>{props.children}</button>);
const native = {
  Platform: { OS: 'web' },
  StyleSheet: { create: (value: any) => value, flatten: (value: any): any => Array.isArray(value) ? Object.assign({}, ...value.map(native.StyleSheet.flatten)) : value ?? {} },
  Image: () => null, ImageBackground: Box, Text: (props: any) => <span>{props.children}</span>,
  TextInput: (props: any) => <input aria-label={props.accessibilityLabel} value={props.value} onInput={event => props.onChangeText(event.currentTarget.value)} />,
  Modal: (props: any) => props.visible ? <div role="dialog">{props.children}</div> : null,
  useWindowDimensions: () => ({ width: api.width, height: 1000 }),
};
// The existing modal host is a boundary here: these checks exercise the actual
// centre, desktop and storage hook, not native modal focus trapping or geometry.
const PlatformModal = (props: any) => props.visible ? <div role="dialog" aria-modal="true" aria-label={props.title}>
  <h1>{props.title}</h1>{props.subtitle ? <p>{props.subtitle}</p> : null}
  {props.headerActions}{props.children}{props.footerContent}
</div> : null;
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native,
  '@/lib/platform/reactNativeWebCompat.web': { WebView: Box, WebPressable: Pressable, WebScrollView: Box },
  'expo-router': { useRouter: () => ({ push: api.push }) },
  '@react-native-async-storage/async-storage': api,
  '@/lib/auth': { useAuth: () => ({ user: { id: api.user }, profile: { roleKey: 'business_admin' }, signOut: vi.fn() }) },
  '@/hooks/usePermissions': { usePermissions: () => ({ tenantId: api.tenant, roleKey: 'business_admin', can: (permission: string) => !api.denied.has(permission), hasModuleGate: (module: string) => api.modules.has(module) }) },
  '@/hooks/useModuleAccess': { useModuleAccess: () => ({}) },
  '@/hooks/useDesktopWeather.web': { useDesktopWeather: () => ({ data: null, place: null, message: 'Standort wählen' }) },
  '@/design/web/WebFontScaleProvider': { useWebFontScale: () => ({ scale: api.scale, effectiveScale: api.scale }) },
  '@/components/portal/accessibility/PortalTextSizeControls.web': { PortalTextSizeControls: () => null },
  '@/components/help/HelpButton.web': { HelpButton: () => null },
  '@/components/layout/TopbarProfileAvatar': { TopbarProfileAvatar: () => null },
  '@/components/googleWorkspace/GoogleWorkspaceWidget.web': { GoogleWorkspaceWidget: (props: any) => <div data-preview={props.preview}>{props.service}</div> },
  '@/components/layout/platform/platformmodal': { PlatformModal },
  './DesktopWeatherLocationDialog.web': { DesktopWeatherLocationDialog: () => null },
};
const bundle = buildSync({ entryPoints: ['src/liquid-command/screens/CommandCenterScreen.web.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.png': 'empty', '.jpg': 'empty' }, external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', bundle)((id: string) => {
  if (!(id in dependencies)) throw new Error(`Unexpected desktop dependency: ${id}`);
  return dependencies[id];
}, loaded, loaded.exports);
const Desktop = loaded.exports.CommandCenterScreen;
const key = (area: DesktopAreaKey = 'office', tenant = api.tenant, user = api.user) => desktopAreaStorageKey(tenant, user, area);
const selectionKey = () => `caresuite.healthos.active-area.v1.${encodeURIComponent(JSON.stringify([api.tenant, api.user]))}`;
const chooseArea = (area: DesktopAreaKey) => memory.set(selectionKey(), area);
const seed = (ids: string[], area: DesktopAreaKey = 'office') => {
  memory.set(key(area), JSON.stringify(ids));
  if (area === 'office') {
    memory.set(`${key()}.document-catalog.v1`, '1');
    memory.set(`${key()}.notes.v1`, '1');
  }
};
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  memory.clear(); api.user = 'user-a'; api.tenant = 'tenant-a'; api.width = 1440; api.scale = 1;
  api.denied.clear(); api.modules = new Set(['office', 'assist']); vi.clearAllMocks();
  api.getItem.mockReset().mockImplementation(async (name: string) => memory.get(name) ?? null);
  api.setItem.mockReset().mockImplementation(async (name: string, value: string) => { memory.set(name, value); });
  api.multiSet.mockReset().mockImplementation(async (entries: [string, string][]) => { entries.forEach(([name, value]) => memory.set(name, value)); });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<Desktop />)); };
const remount = async () => { await act(async () => root.unmount()); root = createRoot(host); await render(); };
const label = (name: string) => host.querySelector<HTMLElement>(`[aria-label="${name}"]`);
const dialog = () => host.querySelector<HTMLElement>('[role="dialog"]')!;
const click = async (element: HTMLElement | null | undefined) => { expect(element).toBeTruthy(); await act(async () => element!.click()); };
const clickLabel = async (name: string) => { await click(label(name)); };
const visibleText = (element: HTMLElement) => {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
  return copy.textContent?.trim();
};
const tab = (text: string, container: ParentNode = dialog()) => [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(element => visibleText(element) === text)!;
const button = (text: string, container: ParentNode = dialog()) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent?.trim() === text)!;
const type = async (name: string, value: string) => {
  const input = label(name) as HTMLInputElement;
  expect(input).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
const open = async (name = 'Apps') => { await clickLabel('Apps und Widgets öffnen'); if (name !== 'Apps') await click(tab(name)); };
const savedIds = (area: DesktopAreaKey = 'office') => JSON.parse(memory.get(key(area))!) as string[];

describe('Apps and Widgets in the actual Web desktop', () => {
  it('opens Settings with usable apps, searches all categories and recovers from an empty result', async () => {
    chooseArea('settings'); await render(); await open();
    expect(dialog().textContent).toContain('Einstellungen');
    expect(label('App Datenschutz öffnen')).toBeTruthy();
    await type('Apps durchsuchen', 'Datenschutz');
    expect(label('App Datenschutz öffnen')).toBeTruthy();
    expect(label('App Einstellungen öffnen')).toBeNull();
    await type('Apps durchsuchen', '___nicht_vorhanden___');
    expect(dialog().textContent).toContain('Keine passenden Apps');
    await click(button('Filter zurücksetzen'));
    expect((label('Apps durchsuchen') as HTMLInputElement).value).toBe('');
    expect(label('App Datenschutz öffnen')).toBeTruthy();
  });

  it('opens an app without pinning it and does not close when typing inside the centre', async () => {
    seed(['clients']); await render(); await open();
    const before = memory.get(key());
    await type('Apps durchsuchen', 'Notizen');
    expect(dialog()).toBeTruthy();
    await clickLabel('App Notizen öffnen');
    expect(api.push).toHaveBeenCalledWith('/office/notizen');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(memory.get(key())).toBe(before);
  });

  it('adds, reorders and removes widgets in place, then restores the saved order', async () => {
    seed(['clients']); await render(); await open('Widgets');
    await clickLabel('Notizen zum Desktop hinzufügen');
    expect(savedIds()).toEqual(['clients', 'notes']); expect(dialog()).toBeTruthy();
    await clickLabel('Notizen nach vorne verschieben');
    expect(savedIds()).toEqual(['notes', 'clients']);
    await clickLabel('Klient:innen vom Desktop entfernen');
    expect(savedIds()).toEqual(['notes']);
    expect(api.push).not.toHaveBeenCalled();
    await remount();
    expect(label('Notizen öffnen')).toBeTruthy(); expect(label('Klient:innen öffnen')).toBeNull();
    expect(savedIds()).toEqual(['notes']);
  });

  it('keeps more than twelve saved widgets reachable and preserves their exact order', async () => {
    const ids = ['clients', 'people', 'logbook', 'time', 'salary', 'billing', 'documents', 'messages', 'access', 'inventory', 'audit', 'notes', 'google-gmail'];
    seed(ids); await render();
    expect(savedIds()).toEqual(ids); expect(label('Gmail öffnen')).toBeNull();
    await clickLabel('Nächste Desktop-Seite'); expect(label('Gmail öffnen')).toBeTruthy();
    await open('Widgets'); await clickLabel('Gmail nach vorne verschieben');
    expect(savedIds()).toEqual([...ids.slice(0, 11), 'google-gmail', 'notes']);
    await remount();
    expect(label('Gmail öffnen')).toBeTruthy();
    await clickLabel('Nächste Desktop-Seite'); expect(label('Notizen öffnen')).toBeTruthy();
  });

  it('retains a background choice after a failed write and retries without reloading preferences', async () => {
    seed(['clients']); await render(); await open('Hintergründe');
    const backgroundKey = `caresuite.healthos.desktop-background.v1.${api.user}`;
    const oldBackground = memory.get(backgroundKey);
    api.multiSet.mockRejectedValueOnce(new Error('Storage unavailable'));
    await clickLabel('Silberblüten als Desktop-Hintergrund verwenden');
    expect(dialog().querySelector('[role="alert"]')).toBeTruthy();
    expect(memory.get(backgroundKey)).toBe(oldBackground);
    const reads = api.getItem.mock.calls.length;
    await click(button('Speichern erneut versuchen'));
    expect(api.getItem).toHaveBeenCalledTimes(reads);
    expect(memory.get(backgroundKey)).toBe('silberblueten');
    expect(dialog().querySelector('[role="alert"]')).toBeNull();
    await remount(); await open('Hintergründe');
    expect(label('Silberblüten als Desktop-Hintergrund verwenden')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps unsaved choices when leaving is cancelled, allows retry and leaves only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    try {
      seed(['clients']); await render(); await open('Widgets');
      api.multiSet.mockRejectedValueOnce(new Error('Storage unavailable'));
      await clickLabel('Notizen zum Desktop hinzufügen');
      await click(tab('Apps')); await clickLabel('App Notizen öffnen');
      expect(confirm).toHaveBeenCalledTimes(1); expect(api.push).not.toHaveBeenCalled();
      expect(dialog()).toBeTruthy(); expect(savedIds()).toEqual(['clients']);
      await click(tab('Widgets'));
      expect(label('Notizen vom Desktop entfernen')).toBeTruthy();
      await click(button('Speichern erneut versuchen'));
      expect(savedIds()).toEqual(['clients', 'notes']); expect(confirm).toHaveBeenCalledTimes(1);
      api.multiSet.mockRejectedValueOnce(new Error('Storage unavailable'));
      await clickLabel('Klient:innen vom Desktop entfernen');
      await click(tab('Apps')); await clickLabel('App Notizen öffnen');
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(api.push).toHaveBeenCalledOnce(); expect(api.push).toHaveBeenCalledWith('/office/notizen');
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    } finally { confirm.mockRestore(); }
  });

  it('shows one document catalog app and opens quality management at its canonical destination', async () => {
    seed([]); await render(); await open();
    expect(dialog().querySelectorAll('[aria-label="App Dokumentenkatalog öffnen"]')).toHaveLength(1);
    expect(dialog().querySelectorAll('[aria-label="App Qualitätsmanagement öffnen"]')).toHaveLength(1);
    await clickLabel('App Qualitätsmanagement öffnen');
    expect(api.push).toHaveBeenCalledWith('/office/qm');
    expect(savedIds()).toEqual([]);
  });

  it('separates widget selections by area, tenant and person', async () => {
    seed(['clients']); seed(['assignments'], 'assist'); await render();
    await click(tab('Assist', host));
    expect(label('Einsätze öffnen')).toBeTruthy(); expect(label('Klient:innen öffnen')).toBeNull();
    await open('Widgets'); await clickLabel('Einsätze vom Desktop entfernen');
    expect(savedIds('assist')).toEqual([]); expect(savedIds()).toEqual(['clients']);
    await clickLabel('Center schließen'); await click(tab('Office', host));
    expect(label('Klient:innen öffnen')).toBeTruthy();
    const firstTenantKey = key(); api.tenant = 'tenant-b'; seed(['notes']); await render();
    expect(label('Notizen öffnen')).toBeTruthy(); expect(label('Klient:innen öffnen')).toBeNull();
    const secondTenantKey = key(); api.user = 'user-b'; seed(['messages']); await render();
    expect(label('Nachrichten öffnen')).toBeTruthy(); expect(label('Notizen öffnen')).toBeNull();
    expect(memory.get(firstTenantKey)).toBe('["clients"]'); expect(memory.get(secondTenantKey)).toBe('["notes"]');
  });

  it('preserves an explicitly empty desktop and never overwrites a failed read', async () => {
    memory.set(key(), '[]'); await render();
    expect(savedIds()).toEqual([]); expect(label('Dokumentenkatalog öffnen')).toBeNull();
    await open('Widgets'); expect(label('Notizen zum Desktop hinzufügen')).toBeTruthy();
    await act(async () => root.unmount()); root = createRoot(host);
    api.multiSet.mockClear(); api.getItem.mockImplementation(async (name: string) => { if (name === key()) throw new Error('Read failed'); return memory.get(name) ?? null; });
    await render();
    expect(host.textContent).toContain('Desktop-Einstellungen konnten nicht geladen werden');
    expect(api.multiSet).not.toHaveBeenCalled(); expect(memory.get(key())).toBe('[]');
  });

  it('keeps an explicitly empty previous desktop empty during migration', async () => {
    memory.set(`caresuite.healthos.desktop-widgets.v2.${api.user}`, '[]');
    await render();
    expect(savedIds()).toEqual([]);
    expect(label('Fahrtenbuch öffnen')).toBeNull();
    expect(label('Dokumentenkatalog öffnen')).toBeNull();
  });

  it('does not expose forbidden document apps or activate an unreleased area', async () => {
    api.denied.add('office.documents.view'); seed([]); await render(); await open();
    expect(label('App Dokumentenkatalog öffnen')).toBeNull();
    await click(tab('Widgets')); expect(label('Dokumentenkatalog zum Desktop hinzufügen')).toBeNull();
    await clickLabel('Center schließen'); await click(tab('Pflege', host)); await open();
    expect(dialog().querySelector('[aria-label^="App "]')).toBeNull();
    expect(api.push).not.toHaveBeenCalled();
  });

  it('hides a saved widget after permission loss without deleting that saved choice', async () => {
    seed(['clients', 'document-catalog']); await render();
    expect(label('Dokumentenkatalog öffnen')).toBeTruthy();
    api.denied.add('office.documents.view'); await render();
    expect(label('Dokumentenkatalog öffnen')).toBeNull();
    await open('Widgets'); await clickLabel('Klient:innen vom Desktop entfernen');
    expect(savedIds()).toEqual(['document-catalog']);
    expect(label('Dokumentenkatalog zum Desktop hinzufügen')).toBeNull();
    api.denied.delete('office.documents.view'); await remount();
    expect(label('Dokumentenkatalog öffnen')).toBeTruthy();
    expect(label('Klient:innen öffnen')).toBeNull();
  });

  it('renders icons for apps, widgets and workflows and checks creation permission before offering an intake workflow', async () => {
    seed(['clients']); await render(); await open();
    const apps = dialog().querySelector('[data-testid="center-app-catalog"]')!;
    expect(apps.children.length).toBeGreaterThan(0);
    [...apps.children].forEach(card => expect(card.querySelector('svg[aria-hidden="true"]')).toBeTruthy());
    await click(tab('Widgets'));
    const widgets = dialog().querySelector('[data-testid="center-widget-catalog"]')!;
    expect(widgets.children.length).toBeGreaterThan(0);
    [...widgets.children].forEach(card => expect(card.querySelector('svg[aria-hidden="true"]')).toBeTruthy());
    await click(tab('Workflows'));
    const intake = label('Klient:in aufnehmen: Ablauf öffnen');
    expect(intake?.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    await click(intake);
    expect(api.push).toHaveBeenCalledWith('/business/office/clients/new');
    expect(savedIds()).toEqual(['clients']);
    api.denied.add('office.clients.create'); await render(); await open('Workflows');
    expect(label('Klient:in aufnehmen: Ablauf öffnen')).toBeNull();
  });

  it('shows an empty workflow state in Settings and supports keyboard tab changes', async () => {
    chooseArea('settings'); api.width = 390; api.scale = 1.5; await render(); await open();
    const apps = tab('Apps');
    await act(async () => { apps.focus(); apps.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(tab('Widgets').getAttribute('aria-selected')).toBe('true'); expect(document.activeElement).toBe(tab('Widgets'));
    await click(tab('Workflows')); expect(dialog().textContent).toMatch(/keine.*(?:Workflows|Abläufe)/i);
    const workflows = tab('Workflows');
    await act(async () => { workflows.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    expect(tab('Hintergründe').getAttribute('aria-selected')).toBe('true');
    expect(label('Hintergründe durchsuchen')).toBeTruthy();
    await clickLabel('Center schließen'); expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
});
