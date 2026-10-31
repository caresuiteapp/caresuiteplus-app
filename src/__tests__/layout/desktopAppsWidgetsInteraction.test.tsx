// @vitest-environment happy-dom
import React, { act, forwardRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_AREAS, desktopAreaStorageKey, type DesktopAreaKey } from '@/liquid-command/navigation/desktopAreas';
import { desktopStorageKey } from '@/liquid-command/navigation/moduleDesktop.web';

const memory = new Map<string, string>();
const api = {
  user: 'user-a', tenant: 'tenant-a', width: 1440, scale: 1,
  denied: new Set<string>(), modules: new Set(['office', 'assist']),
  push: vi.fn(), getItem: vi.fn(), setItem: vi.fn(), multiSet: vi.fn(),
  centerRequest: undefined as string | undefined, authReady: true, setParams: vi.fn(),
};
const Box = forwardRef<HTMLDivElement, any>((props, ref) => <div ref={ref} data-testid={props.testID} id={props.nativeID} aria-label={props.accessibilityLabel}>{props.children}</div>);
const Pressable = forwardRef<HTMLButtonElement, any>((props, ref) => <button type="button" ref={ref} role={props.accessibilityRole} aria-label={props.accessibilityLabel} aria-selected={props.accessibilityState?.selected} aria-disabled={props.disabled} disabled={props.disabled} onClick={props.disabled ? undefined : props.onPress}>{props.children}</button>);
const native = {
  Platform: { OS: 'web' },
  StyleSheet: { create: (value: any) => value, flatten: (value: any): any => Array.isArray(value) ? Object.assign({}, ...value.map(native.StyleSheet.flatten)) : value ?? {} },
  Image: (props: any) => <img alt="" data-native-image-source={JSON.stringify(props.source)} />, ImageBackground: Box, Text: (props: any) => <span>{props.children}</span>,
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
  'expo-router': { useRouter: () => ({ push: api.push, setParams: api.setParams }), usePathname: () => '/Desktop', useLocalSearchParams: () => ({ center: api.centerRequest }) },
  '@react-native-async-storage/async-storage': api,
  '@/lib/auth': { useAuth: () => ({ authReady: api.authReady, isAuthenticated: true, user: { id: api.user }, profile: { roleKey: 'business_admin' }, signOut: vi.fn() }) },
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
  api.centerRequest = undefined; api.authReady = true;
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
const workspaceHeader = () => host.querySelector<HTMLElement>('[data-testid="desktop-workspace-header"]')!;
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
const desktopChoice = (area: DesktopAreaKey) => {
  const areaName = DESKTOP_AREAS.find(candidate => candidate.key === area)!.label;
  return dialog().querySelector<HTMLButtonElement>(`[aria-label="${areaName}-Desktop auswählen"]`)!;
};
const selectDesktop = async (area: DesktopAreaKey) => { await click(desktopChoice(area)); };
const expectSelectedDesktop = (area: DesktopAreaKey) => {
  const chooser = dialog().querySelector('[role="group"][aria-label="Desktop im Katalog wechseln"]')!;
  expect(chooser).toBeTruthy();
  expect(chooser.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  expect(desktopChoice(area).getAttribute('aria-pressed')).toBe('true');
};
const open = async (name = 'Apps') => { await clickLabel('Apps und Widgets öffnen'); if (name !== 'Apps') await click(tab(name)); };
const savedIds = (area: DesktopAreaKey = 'office') => JSON.parse(memory.get(key(area))!) as string[];
const catalogRoute = (catalog: 'app' | 'widget', route: string) => dialog().querySelector<HTMLElement>(`[data-testid="center-${catalog}-catalog"] [data-artwork-route="${route}"]`);
const officeClientAction = (name: string) => catalogRoute('widget', '/business/office/clients')?.closest('article')?.querySelector<HTMLElement>(`[aria-label="${name}"]`);
const suggestions = () => [...host.querySelectorAll<HTMLElement>('[data-testid="desktop-widget-suggestion"]')];
const suggestedRoute = (route: string) => suggestions().find(card => card.dataset.widgetRoute === route);
const acceptSuggestion = (card: HTMLElement | undefined) => card?.querySelector<HTMLButtonElement>('button[aria-label$=" übernehmen"]');
const dismissSuggestion = (card: HTMLElement | undefined) => card?.querySelector<HTMLButtonElement>('button[aria-label$=" ausblenden"]');
const savedDismissals = (area: DesktopAreaKey = 'office') => JSON.parse(memory.get(`${key(area)}.dismissed-suggestions.v1`) ?? '[]') as string[];

describe('Apps and Widgets in the actual Web desktop', () => {
  it.each(DESKTOP_AREAS)('offers optional recommendations on the $label desktop and saves a one-click selection', async area => {
    api.modules.add(area.key); chooseArea(area.key); seed([], area.key);
    await render();
    const cards = suggestions();
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(6);
    expect(savedIds(area.key)).toEqual([]);
    expect(workspaceHeader().textContent).toContain('0/12 aktiv');
    expect(host.querySelector('[data-preview]')).toBeNull();
    for (const card of cards) {
      expect(card.textContent).toContain(`Für ${area.label} empfohlen`);
      expect(card.querySelector('[data-testid="desktop-catalog-artwork"] img')).toBeTruthy();
      expect(acceptSuggestion(card)).toBeTruthy();
      expect(dismissSuggestion(card)?.getAttribute('title')).toBe('Vorschlag ausblenden');
    }
    const id = cards[0].dataset.widgetId!;
    await click(acceptSuggestion(cards[0]));
    expect(savedIds(area.key)).toEqual([id]);
    expect(workspaceHeader().textContent).toContain('1/12 aktiv');
    expect(suggestions().some(card => card.dataset.widgetId === id)).toBe(false);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(api.push).not.toHaveBeenCalled();
    await remount();
    expect(savedIds(area.key)).toEqual([id]);
    expect(suggestions().some(card => card.dataset.widgetId === id)).toBe(false);
  });

  it('dismisses only the chosen recommendation, keeps its slot empty and still allows a manual placement', async () => {
    seed(['notes']); await render();
    const route = '/business/office/clients';
    const card = suggestedRoute(route)!;
    expect(card).toBeTruthy();
    const slot = card.parentElement!;
    const otherSlots = suggestions().filter(item => item !== card).map(item => ({ route: item.dataset.widgetRoute!, slot: item.parentElement }));
    const count = suggestions().length;
    const dismiss = dismissSuggestion(card)!;
    dismiss.focus();
    await act(async () => { dismiss.click(); dismiss.click(); });

    expect(suggestedRoute(route)).toBeUndefined();
    expect(suggestions()).toHaveLength(count - 1);
    const add = slot.querySelector('[aria-label="Widget hinzufügen"]');
    expect(add).toBeTruthy();
    expect(document.activeElement).toBe(add);
    for (const other of otherSlots) expect(suggestedRoute(other.route)?.parentElement).toBe(other.slot);
    expect(savedIds()).toEqual(['notes']);
    expect(workspaceHeader().textContent).toContain('1/12 aktiv');
    expect(savedDismissals()).toEqual([route]);
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Klient:innen als Vorschlag auf Office ausgeblendet.');
    expect(api.push).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();

    await remount();
    expect(suggestedRoute(route)).toBeUndefined();
    expect(suggestions()).toHaveLength(count - 1);
    expect(savedIds()).toEqual(['notes']);
    await open('Widgets');
    await click(officeClientAction('Klient:innen zum Desktop hinzufügen'));
    expect(savedIds()).toEqual(['notes', 'clients']);
    expect(savedDismissals()).toEqual([route]);
  });

  it('keeps dismissals separate by desktop, tenant and person and retains them through permission changes', async () => {
    const route = '/business/office/clients';
    api.modules.add('beratung'); chooseArea('beratung'); seed([], 'beratung'); seed([]);
    await render();
    await click(dismissSuggestion(suggestedRoute(route)));
    const originalKey = `${key('beratung')}.dismissed-suggestions.v1`;
    expect(savedDismissals('beratung')).toEqual([route]);
    await click(tab('Office', workspaceHeader()));
    expect(suggestedRoute(route)).toBeTruthy();
    expect(savedDismissals()).toEqual([]);
    await click(tab('Beratung', workspaceHeader()));
    expect(suggestedRoute(route)).toBeUndefined();

    api.tenant = 'tenant-b'; chooseArea('beratung'); seed([], 'beratung'); await render();
    expect(suggestedRoute(route)).toBeTruthy();
    expect(savedDismissals('beratung')).toEqual([]);
    api.tenant = 'tenant-a'; api.user = 'user-b'; chooseArea('beratung'); seed([], 'beratung'); await render();
    expect(suggestedRoute(route)).toBeTruthy();
    expect(savedDismissals('beratung')).toEqual([]);
    expect(JSON.parse(memory.get(originalKey)!)).toEqual([route]);

    api.user = 'user-a'; chooseArea('beratung'); await render();
    expect(suggestedRoute(route)).toBeUndefined();
    api.denied.add('office.clients.view'); await render();
    expect(savedDismissals('beratung')).toEqual([route]);
    api.denied.delete('office.clients.view'); await render();
    expect(suggestedRoute(route)).toBeUndefined();
    expect(savedDismissals('beratung')).toEqual([route]);
    expect(savedIds('beratung')).toEqual([]);
  });

  it('keeps a recommendation hidden after a failed save and persists the dismissal on retry', async () => {
    seed([]); await render();
    const route = '/business/office/clients';
    api.multiSet.mockRejectedValueOnce(new Error('Storage unavailable'));
    await click(dismissSuggestion(suggestedRoute(route)));
    expect(suggestedRoute(route)).toBeUndefined();
    expect(savedDismissals()).toEqual([]);
    expect(savedIds()).toEqual([]);
    expect(host.textContent).toContain('Ihre letzte Auswahl wurde noch nicht gespeichert.');
    await click(button('Erneut speichern', host));
    expect(savedDismissals()).toEqual([route]);
    expect(host.textContent).not.toContain('Ihre letzte Auswahl wurde noch nicht gespeichert.');
    await remount();
    expect(suggestedRoute(route)).toBeUndefined();
    expect(savedIds()).toEqual([]);
  });

  it('adds a recommendation only once on rapid repeated clicks and still opens the full widget chooser', async () => {
    seed([]); await render();
    const first = suggestions()[0];
    const id = first.dataset.widgetId!;
    const title = first.querySelector('h3')!.textContent!;
    const accept = acceptSuggestion(first)!;
    accept.focus();
    expect(document.activeElement).toBe(accept);
    await act(async () => { accept.click(); accept.click(); });
    expect(savedIds()).toEqual([id]);
    expect(workspaceHeader().textContent).toContain('1/12 aktiv');
    expect(suggestions().some(card => card.dataset.widgetId === id)).toBe(false);
    expect(document.activeElement).toBe(label(`${title} öffnen`));
    expect(host.querySelector('[role="status"]')?.textContent).toBe(`${title} auf Office übernommen.`);
    const other = suggestions()[0].querySelector<HTMLElement>('[aria-label="Andere Widgets für Office auswählen"]');
    await click(other);
    expect(tab('Widgets').getAttribute('aria-selected')).toBe('true');
    expectSelectedDesktop('office');
    expect(savedIds()).toEqual([id]);
    expect(api.push).not.toHaveBeenCalled();
  });

  it('keeps accepted shared recommendations separate for each desktop, tenant and person', async () => {
    api.modules.add('beratung'); chooseArea('beratung'); seed([], 'beratung'); seed([]);
    await render();
    await click(acceptSuggestion(suggestedRoute('/business/office/clients')));
    expect(savedIds('beratung')).toEqual(['clients']);
    expect(savedIds()).toEqual([]);
    await click(tab('Office', workspaceHeader()));
    await click(acceptSuggestion(suggestedRoute('/business/office/clients')));
    expect(savedIds()).toEqual(['clients']);
    expect(savedIds('beratung')).toEqual(['clients']);
    await click(tab('Beratung', workspaceHeader()));
    await remount();
    expect(label('Klient:innen öffnen')).toBeTruthy();
    expect(suggestedRoute('/business/office/clients')).toBeUndefined();
    const originalKey = key('beratung');

    api.tenant = 'tenant-b'; chooseArea('beratung'); seed([], 'beratung'); await render();
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(suggestedRoute('/business/office/clients')).toBeTruthy();
    expect(savedIds('beratung')).toEqual([]);
    api.user = 'user-b'; chooseArea('beratung'); seed([], 'beratung'); await render();
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(savedIds('beratung')).toEqual([]);
    expect(memory.get(originalKey)).toBe('["clients"]');
  });

  it('retains an accepted recommendation after a failed save and retries the existing preference write', async () => {
    seed([]); await render();
    const first = suggestions()[0];
    const id = first.dataset.widgetId!;
    api.multiSet.mockRejectedValueOnce(new Error('Storage unavailable'));
    await click(acceptSuggestion(first));
    expect(savedIds()).toEqual([]);
    expect(workspaceHeader().textContent).toContain('1/12 aktiv');
    expect(host.textContent).toContain('Ihre letzte Auswahl wurde noch nicht gespeichert.');
    expect(suggestions().some(card => card.dataset.widgetId === id)).toBe(false);
    await click(button('Erneut speichern', host));
    expect(savedIds()).toEqual([id]);
    expect(host.textContent).not.toContain('Ihre letzte Auswahl wurde noch nicht gespeichert.');
    await remount();
    expect(savedIds()).toEqual([id]);
  });

  it('removes forbidden recommendations immediately and offers none on a blocked desktop', async () => {
    seed([]); await render();
    expect(suggestedRoute('/business/office/clients')).toBeTruthy();
    api.denied.add('office.clients.view'); api.denied.add('office.documents.view');
    await render();
    expect(suggestedRoute('/business/office/clients')).toBeUndefined();
    expect(suggestedRoute('/business/office/document-catalog')).toBeUndefined();
    expect(suggestedRoute('/business/office/documents')).toBeUndefined();
    expect(savedIds()).toEqual([]);
    api.denied.add('assist.access'); chooseArea('assist'); seed([], 'assist');
    await remount();
    expect(host.textContent).toContain('Dieser Bereich ist für Ihr Konto noch nicht freigegeben.');
    expect(suggestions()).toHaveLength(0);
    expect(savedIds('assist')).toEqual([]);
    expect(api.push).not.toHaveBeenCalled();
  });

  it('uses only empty slots on the final page and never recommends a widget pinned on another page', async () => {
    const ids = ['clients', 'people', 'logbook', 'time', 'salary', 'billing', 'documents', 'messages', 'access', 'inventory', 'audit', 'notes', 'google-gmail'];
    seed(ids); await render();
    expect(suggestions()).toHaveLength(0);
    await clickLabel('Nächste Desktop-Seite');
    const cards = suggestions();
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every(card => !ids.includes(card.dataset.widgetId!))).toBe(true);
    const id = cards[0].dataset.widgetId!;
    await click(acceptSuggestion(cards[0]));
    expect(savedIds()).toEqual([...ids, id]);
    expect(label('Gmail öffnen')).toBeTruthy();
    expect(workspaceHeader().textContent).toContain('14 Widgets');
    expect(api.push).not.toHaveBeenCalled();
  });

  it('opens the requested Apps catalogue after auth and saved desktop restoration, then consumes the request once', async () => {
    seed(['assignments'], 'assist'); chooseArea('assist');
    api.centerRequest = 'apps'; api.authReady = false;
    await render();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(api.setParams).not.toHaveBeenCalled();
    api.authReady = true;
    await render();
    expectSelectedDesktop('assist');
    expect(tab('Apps').getAttribute('aria-selected')).toBe('true');
    expect(api.setParams).toHaveBeenCalledTimes(1);
    expect(api.setParams).toHaveBeenCalledWith({ center: undefined });
    await clickLabel('Center schließen');
    await render();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(api.setParams).toHaveBeenCalledTimes(1);
    expect(savedIds('assist')).toEqual(['assignments']);
  });

  it('preserves the desktop area tabs, keeps the new chooser inside Apps and Widgets and restores the selection after reload', async () => {
    seed(['clients']); seed(['assignments'], 'assist'); await render();
    const topbar = host.querySelector('[data-testid="desktop-topbar-actions"]')!;
    expect(topbar).toBeTruthy();
    expect(topbar.querySelector('[aria-label="Desktop wechseln"]')).toBeNull();
    expect(topbar.querySelector('[aria-label="Desktop im Katalog wechseln"]')).toBeNull();
    expect(label('Desktop im Katalog wechseln')).toBeNull();
    expect(label('Office-Desktop auswählen')).toBeNull();
    expect([...workspaceHeader().querySelectorAll('[role="tab"]')].map(element => visibleText(element as HTMLElement))).toEqual([
      'Office', 'Assist', 'Pflege', 'Stationär', 'Beratung', 'Akademie', 'Roboter', 'Premium', 'Einstellungen',
    ]);
    expect(tab('Office', workspaceHeader()).getAttribute('aria-selected')).toBe('true');
    await click(tab('Assist', workspaceHeader()));
    expect(tab('Assist', workspaceHeader()).getAttribute('aria-selected')).toBe('true');
    expect(label('Einsätze öffnen')).toBeTruthy();
    expect(label('Klient:innen öffnen')).toBeNull();
    await click(tab('Office', workspaceHeader()));
    expect(tab('Office', workspaceHeader()).getAttribute('aria-selected')).toBe('true');
    expect(label('Klient:innen öffnen')).toBeTruthy();
    await open();
    expectSelectedDesktop('office');
    expect(dialog().querySelectorAll('[aria-label$="-Desktop auswählen"]')).toHaveLength(9);
    expect(dialog().textContent).toContain('Aktueller Desktop: Office');
    expect(label('Desktop wechseln')).toBeNull();
    await selectDesktop('assist');
    expectSelectedDesktop('assist');
    expect(tab('Assist', workspaceHeader()).getAttribute('aria-selected')).toBe('true');
    expect(label('Einsätze öffnen')).toBeTruthy();
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(memory.get(selectionKey())).toBe('assist');
    expect(api.push).not.toHaveBeenCalled();
    await clickLabel('Center schließen');
    expect(label('Desktop im Katalog wechseln')).toBeNull();
    expect(label('Assist-Desktop auswählen')).toBeNull();
    await remount();
    expect(tab('Assist', workspaceHeader()).getAttribute('aria-selected')).toBe('true');
    expect(label('Einsätze öffnen')).toBeTruthy();
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(label('Desktop wechseln')).toBeNull();
    expect(label('Desktop im Katalog wechseln')).toBeNull();
    await open();
    expectSelectedDesktop('assist');
  });

  it('opens the Academy desktop and templates and restores its own pinned widgets without changing Office', async () => {
    api.modules.add('akademie');
    seed(['clients']); seed([], 'akademie'); await render();
    await click(tab('Akademie', workspaceHeader()));
    expect(host.textContent).toContain('Mein Desktop · Akademie');
    expect(label('Klient:innen öffnen')).toBeNull();
    await open('Widgets');
    expectSelectedDesktop('akademie');
    await clickLabel('Vorlagen & Kursbaukasten zum Desktop hinzufügen');
    const academyWidgets = savedIds('akademie');
    expect(academyWidgets).toHaveLength(1);
    expect(savedIds()).toEqual(['clients']);
    await remount();
    expect(tab('Akademie', workspaceHeader()).getAttribute('aria-selected')).toBe('true');
    expect(label('Vorlagen & Kursbaukasten öffnen')).toBeTruthy();
    await open();
    await clickLabel('App Vorlagen & Kursbaukasten öffnen');
    expect(api.push).toHaveBeenCalledWith('/akademie/vorlagen');
    expect(savedIds('akademie')).toEqual(academyWidgets);
    expect(savedIds()).toEqual(['clients']);
  });

  it('keeps the catalog and Workflows tab open while switching desktops and resets the previous search', async () => {
    seed(['clients']); seed(['assignments'], 'assist'); await render(); await open('Workflows');
    expectSelectedDesktop('office');
    expect(dialog().textContent).toContain('1 von 1 Workflows');
    expect(label('Klient:in aufnehmen: Ablauf öffnen')).toBeTruthy();
    await type('Workflows durchsuchen', '___nicht_vorhanden___');
    expect(dialog().textContent).toContain('Keine passenden Workflows');
    await selectDesktop('assist');
    expect(dialog()).toBeTruthy();
    expect(tab('Workflows').getAttribute('aria-selected')).toBe('true');
    expect((label('Workflows durchsuchen') as HTMLInputElement).value).toBe('');
    expectSelectedDesktop('assist');
    expect(dialog().textContent).toContain('3 von 3 Workflows');
    expect(label('Einsatz planen: Ablauf öffnen')).toBeTruthy();
    expect(label('Nachweise prüfen: Ablauf öffnen')).toBeTruthy();
    expect(label('Klient:in aufnehmen: Ablauf öffnen')).toBeTruthy();
    expect(memory.get(selectionKey())).toBe('assist');
    expect(savedIds()).toEqual(['clients']); expect(savedIds('assist')).toEqual(['assignments']);
    await selectDesktop('office');
    expect(tab('Workflows').getAttribute('aria-selected')).toBe('true');
    expect(label('Klient:in aufnehmen: Ablauf öffnen')).toBeTruthy();
    expect(label('Einsatz planen: Ablauf öffnen')).toBeNull();
    expect(api.push).not.toHaveBeenCalled();
  });

  it('does not reset the catalog or write preferences when selecting the current desktop', async () => {
    seed(['clients']); await render(); await open('Workflows');
    await type('Workflows durchsuchen', 'aufnehmen');
    const currentDialog = dialog();
    const writes = api.multiSet.mock.calls.length;
    const singleWrites = api.setItem.mock.calls.length;
    await selectDesktop('office');
    expect(dialog()).toBe(currentDialog);
    expect(tab('Workflows').getAttribute('aria-selected')).toBe('true');
    expect((label('Workflows durchsuchen') as HTMLInputElement).value).toBe('aufnehmen');
    expect(api.multiSet).toHaveBeenCalledTimes(writes);
    expect(api.setItem).toHaveBeenCalledTimes(singleWrites);
    expect(api.push).not.toHaveBeenCalled();
  });

  it('keeps unsaved widget edits when a desktop switch is cancelled and switches after a successful retry', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      seed(['clients']); seed(['assignments'], 'assist'); await render(); await open('Widgets');
      api.multiSet.mockRejectedValueOnce(new Error('Storage unavailable'));
      await clickLabel('Notizen zum Desktop hinzufügen');
      await selectDesktop('office');
      expect(confirm).not.toHaveBeenCalled();
      await selectDesktop('assist');
      expect(confirm).toHaveBeenCalledOnce();
      expectSelectedDesktop('office');
      expect(label('Notizen vom Desktop entfernen')).toBeTruthy();
      expect(savedIds()).toEqual(['clients']);
      await click(button('Speichern erneut versuchen'));
      expect(savedIds()).toEqual(['clients', 'notes']);
      await selectDesktop('assist');
      expect(confirm).toHaveBeenCalledOnce();
      expectSelectedDesktop('assist');
      expect(tab('Widgets').getAttribute('aria-selected')).toBe('true');
      expect(label('Einsätze vom Desktop entfernen')).toBeTruthy();
      expect(savedIds()).toEqual(['clients', 'notes']);
    } finally { confirm.mockRestore(); }
  });

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
    seed(['clients']); seed(['assignments'], 'assist'); await render(); await open('Widgets');
    await selectDesktop('assist');
    expect(label('Einsätze öffnen')).toBeTruthy(); expect(label('Klient:innen öffnen')).toBeNull();
    await clickLabel('Einsätze vom Desktop entfernen');
    expect(savedIds('assist')).toEqual([]); expect(savedIds()).toEqual(['clients']);
    await selectDesktop('office');
    expect(tab('Widgets').getAttribute('aria-selected')).toBe('true');
    expect(label('Klient:innen vom Desktop entfernen')).toBeTruthy();
    expect(label('Einsätze zum Desktop hinzufügen')).toBeNull();
    await clickLabel('Center schließen');
    expect(label('Klient:innen öffnen')).toBeTruthy();
    const firstTenantKey = key(); api.tenant = 'tenant-b'; seed(['notes']); await render();
    expect(label('Notizen öffnen')).toBeTruthy(); expect(label('Klient:innen öffnen')).toBeNull();
    const secondTenantKey = key(); api.user = 'user-b'; seed(['messages']); await render();
    expect(label('Nachrichten öffnen')).toBeTruthy(); expect(label('Notizen öffnen')).toBeNull();
    expect(memory.get(firstTenantKey)).toBe('["clients"]'); expect(memory.get(secondTenantKey)).toBe('["notes"]');
  });

  it('pins the same Office app independently on Office, Beratung and Assist and restores each selection', async () => {
    api.modules.add('beratung');
    seed(['clients']); seed([], 'beratung'); seed(['assignments'], 'assist');
    await render(); await open('Widgets');
    await selectDesktop('beratung');
    expect(officeClientAction('Klient:innen zum Desktop hinzufügen')).toBeTruthy();
    await click(officeClientAction('Klient:innen zum Desktop hinzufügen'));
    expect(savedIds('beratung')).toEqual(['clients']);
    expect(savedIds()).toEqual(['clients']);
    await selectDesktop('assist');
    await click(officeClientAction('Klient:innen zum Desktop hinzufügen'));
    expect(savedIds('assist')).toEqual(['assignments', 'clients']);
    await click(officeClientAction('Klient:innen nach vorne verschieben'));
    expect(savedIds('assist')).toEqual(['clients', 'assignments']);
    expect(savedIds('beratung')).toEqual(['clients']);
    expect(savedIds()).toEqual(['clients']);

    await remount();
    expect(tab('Assist', workspaceHeader()).getAttribute('aria-selected')).toBe('true');
    expect(label('Klient:innen öffnen')).toBeTruthy();
    await clickLabel('Seite Klient:innen öffnen');
    expect(api.push).toHaveBeenCalledWith('/business/office/clients');
    expect(memory.get(selectionKey())).toBe('assist');
    await open('Widgets');
    await click(officeClientAction('Klient:innen vom Desktop entfernen'));
    expect(savedIds('assist')).toEqual(['assignments']);
    expect(savedIds()).toEqual(['clients']);
    expect(savedIds('beratung')).toEqual(['clients']);

    await selectDesktop('beratung');
    await clickLabel('Center schließen');
    await remount();
    expect(tab('Beratung', workspaceHeader()).getAttribute('aria-selected')).toBe('true');
    expect(label('Klient:innen öffnen')).toBeTruthy();
    expect(label('Seite Klient:innen öffnen')).toBeTruthy();
    await clickLabel('Klient:innen öffnen');
    expect(api.push).toHaveBeenLastCalledWith('/business/office/clients');
    expect(savedIds('beratung')).toEqual(['clients']);
    expect(savedIds()).toEqual(['clients']);
    expect(savedIds('assist')).toEqual(['assignments']);
  });

  it('offers shared Office widgets without automatically adding them to an unused Beratung desktop', async () => {
    api.modules.add('beratung'); chooseArea('beratung');
    await render();
    expect(savedIds('beratung')).not.toContain('clients');
    expect(savedIds('beratung')).not.toContain('notes');
    expect(savedIds('beratung')).not.toContain('document-catalog');
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(label('Seite Klient:innen öffnen')).toBeTruthy();
    await open('Widgets');
    expect(label('Klient:innen zum Desktop hinzufügen')).toBeTruthy();
    expect(label('Notizen zum Desktop hinzufügen')).toBeTruthy();
    expect(label('Dokumentenkatalog zum Desktop hinzufügen')).toBeTruthy();
    expect(memory.has(key('office'))).toBe(false);
  });

  it('keeps automatic legacy migration area-specific while allowing explicit recovery of shared Office widgets', async () => {
    chooseArea('assist');
    const previousKey = desktopStorageKey(api.tenant, api.user);
    memory.set(previousKey, '["clients","assignments"]');
    await render();
    expect(savedIds('assist')).toEqual(['assignments']);
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(label('Einsätze öffnen')).toBeTruthy();
    await open('Widgets');
    await click(button('Gespeicherte Widgets wiederherstellen'));
    expect(savedIds('assist')).toEqual(['assignments', 'clients']);
    expect(memory.has(key('office'))).toBe(false);
    expect(memory.get(previousKey)).toBe('["clients","assignments"]');
    await remount();
    expect(savedIds('assist')).toEqual(['assignments', 'clients']);
    expect(label('Klient:innen öffnen')).toBeTruthy();
    expect(label('Einsätze öffnen')).toBeTruthy();
  });

  it('retains a shared Office widget on its desktop while its permission is temporarily revoked', async () => {
    api.modules.add('beratung'); chooseArea('beratung');
    seed(['clients']); seed(['clients', 'notes'], 'beratung');
    await render();
    expect(label('Klient:innen öffnen')).toBeTruthy();
    api.denied.add('office.clients.view'); await render();
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(label('Seite Klient:innen öffnen')).toBeNull();
    await open('Widgets');
    expect(label('Klient:innen zum Desktop hinzufügen')).toBeNull();
    await clickLabel('Notizen vom Desktop entfernen');
    expect(savedIds('beratung')).toEqual(['clients']);
    expect(savedIds()).toEqual(['clients']);
    api.denied.delete('office.clients.view'); await remount();
    expect(label('Klient:innen öffnen')).toBeTruthy();
    expect(label('Notizen öffnen')).toBeNull();
    expect(savedIds('beratung')).toEqual(['clients']);
    expect(savedIds()).toEqual(['clients']);
  });

  it('checks the Office module grant even when an Office widget is placed on Assist', async () => {
    seed(['clients']); seed(['assignments', 'clients'], 'assist'); chooseArea('assist');
    api.modules.delete('office'); await render();
    expect(label('Einsätze öffnen')).toBeTruthy();
    expect(label('Klient:innen öffnen')).toBeNull();
    expect(label('Seite Klient:innen öffnen')).toBeNull();
    await open();
    // Office and Assist both have a card named Klient:innen. Check their destinations.
    expect(catalogRoute('app', '/business/office/clients')).toBeNull();
    expect(catalogRoute('app', '/assist/zugeordnete-klienten')).toBeTruthy();
    await click(tab('Widgets'));
    expect(catalogRoute('widget', '/business/office/clients')).toBeNull();
    expect(catalogRoute('widget', '/assist/zugeordnete-klienten')).toBeTruthy();
    await clickLabel('Einsätze vom Desktop entfernen');
    expect(savedIds('assist')).toEqual(['clients']);
    expect(savedIds()).toEqual(['clients']);
    api.modules.add('office'); await remount();
    expect(label('Klient:innen öffnen')).toBeTruthy();
    expect(label('Einsätze öffnen')).toBeNull();
    expect(savedIds('assist')).toEqual(['clients']);
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
    expect(desktopChoice('pflege').disabled).toBe(true);
    expect(label('Desktop wechseln')).toBeNull();
    await selectDesktop('pflege');
    expectSelectedDesktop('office');
    expect(tab('Widgets').getAttribute('aria-selected')).toBe('true');
    expect(label('Notizen zum Desktop hinzufügen')).toBeTruthy();
    expect(memory.get(selectionKey())).not.toBe('pflege');
    expect(api.push).not.toHaveBeenCalled();
  });

  it.each(['module', 'permission'] as const)('prevents switching to Assist without its %s access', async reason => {
    if (reason === 'module') api.modules.delete('assist');
    else api.denied.add('assist.access');
    seed(['clients']); await render(); await open('Workflows');
    expect(desktopChoice('assist').disabled).toBe(true);
    expect(label('Desktop wechseln')).toBeNull();
    await selectDesktop('assist');
    expectSelectedDesktop('office');
    expect(label('Klient:in aufnehmen: Ablauf öffnen')).toBeTruthy();
    expect(label('Einsatz planen: Ablauf öffnen')).toBeNull();
    expect(memory.get(selectionKey())).not.toBe('assist');
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

  it('renders picture artwork for every app, widget and workflow and checks creation permission before offering an intake workflow', async () => {
    const expectPicture = (card: Element) => {
      const artwork = card.querySelector('[data-testid="desktop-catalog-artwork"]');
      expect(artwork).toBeTruthy();
      expect(artwork?.querySelector('img[data-native-image-source]')).toBeTruthy();
      expect(artwork?.querySelector('svg')).toBeNull();
    };
    seed(['clients']); await render(); await open();
    const apps = dialog().querySelector('[data-testid="center-app-catalog"]')!;
    expect(apps.children.length).toBeGreaterThan(0);
    [...apps.children].forEach(expectPicture);
    await click(tab('Widgets'));
    const widgets = dialog().querySelector('[data-testid="center-widget-catalog"]')!;
    expect(widgets.children.length).toBeGreaterThan(0);
    [...widgets.children].forEach(expectPicture);
    await click(tab('Workflows'));
    const intake = label('Klient:in aufnehmen: Ablauf öffnen');
    const workflows = dialog().querySelectorAll('[aria-label$=": Ablauf öffnen"]');
    expect(workflows.length).toBeGreaterThan(0);
    workflows.forEach(expectPicture);
    await click(intake);
    expect(api.push).toHaveBeenCalledWith('/business/office/clients/new');
    expect(savedIds()).toEqual(['clients']);
    api.denied.add('office.clients.create'); await render(); await open('Workflows');
    expect(label('Klient:in aufnehmen: Ablauf öffnen')).toBeNull();
  });

  it('offers the permitted Office workflow in Settings and shows an empty state after creation permission is revoked', async () => {
    chooseArea('settings'); api.width = 390; api.scale = 1.5; await render(); await open();
    const apps = tab('Apps');
    await act(async () => { apps.focus(); apps.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(tab('Widgets').getAttribute('aria-selected')).toBe('true'); expect(document.activeElement).toBe(tab('Widgets'));
    await click(tab('Workflows'));
    expect(label('Klient:in aufnehmen: Ablauf öffnen')).toBeTruthy();
    api.denied.add('office.clients.create'); await render();
    expect(label('Klient:in aufnehmen: Ablauf öffnen')).toBeNull();
    expect(dialog().textContent).toMatch(/keine.*(?:Workflows|Abläufe)/i);
    const workflows = tab('Workflows');
    await act(async () => { workflows.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    expect(tab('Hintergründe').getAttribute('aria-selected')).toBe('true');
    expect(label('Hintergründe durchsuchen')).toBeTruthy();
    await clickLabel('Center schließen'); expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
});

