// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { build } from 'esbuild';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TenantDossier } from '@/lib/platformConsole/tenantDossierModel';
import { buildTenantSetup } from '@/lib/platformConsole/tenantDossierModel';

const api = { page: vi.fn(), summary: vi.fn(), role: 'platform_owner', params: {} as Record<string,string> };
const Box = React.forwardRef<HTMLDivElement, any>((p, ref) => <div ref={ref} data-testid={p.testID} role={p.accessibilityRole} data-live={p.accessibilityLiveRegion}>{p.children}</div>);
const noop = () => {};
const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style ?? {};
const native = {
  View: Box, ScrollView: Box, Text: (p: any) => <span role={p.accessibilityRole}>{p.children}</span>,
  Image: (p: any) => <img src={p.source.uri} alt={p.accessibilityLabel} />, ActivityIndicator: () => <span>Warten</span>,
  Modal: (p: any) => p.visible ? <div role="dialog">{p.children}</div> : null,
  StyleSheet: { create: (style: any) => style, flatten }, Platform: { OS: 'android' },
  useWindowDimensions: () => ({ width: 320, height: 640, fontScale: 2 }),
  Linking: { openURL: vi.fn() }, Alert: { alert: vi.fn() }, AccessibilityInfo: { setAccessibilityFocus: noop }, findNodeHandle: () => null, PanResponder: { create: () => ({ panHandlers: {} }) },
  Pressable: React.forwardRef<HTMLButtonElement, any>((p, ref) => <button ref={ref} aria-label={p.accessibilityLabel} role={p.accessibilityRole} disabled={p.disabled} onClick={p.onPress}>{p.children}</button>),
  TextInput: React.forwardRef<HTMLInputElement, any>((p, ref) => <input ref={ref} aria-label={p.accessibilityLabel} value={p.value} maxLength={p.maxLength} onInput={event => p.onChangeText(event.currentTarget.value)} />),
};
const deps: Record<string, any> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native,
  'expo-document-picker': { getDocumentAsync: async () => ({ canceled: true }) }, 'expo-file-system': { File: class {} },
  'expo-router': { useRouter: () => ({ push: noop, replace: noop }) },
  'react-native-svg': { __esModule: true, default: Box, ...Object.fromEntries('Path Circle Rect Line Polyline Polygon Ellipse G Defs Stop LinearGradient RadialGradient ClipPath Pattern Text TSpan'.split(' ').map(name => [name, () => null])) },
  'qa:dossier': { getTenantDossierPage: api.page, getTenantDossier: api.summary },
  'qa:files': { shareNativeFile: vi.fn(), shareNativeExistingFile: vi.fn() },
  'qa:media': { NativeWorkspaceMedia: () => null, NativeWorkspacePdfFrame: () => null },
};
const aliases: [RegExp, string][] = [[/tenantDossierService/, 'qa:dossier'], [/nativeFileDelivery\.native/, 'qa:files'], [/NativeWorkspace(?:Media|PdfFrame)\.native/, 'qa:media']];
const code = (await build({ stdin: { contents: "export * from './src/screens/platformConsole/TenantDossierWorkspace.native.tsx';export {NativeDiv,NativeButton} from './src/components/layout/NativeWorkspaceElements.native';", resolveDir: process.cwd(), sourcefile: 'native-dossier-interaction.tsx', loader: 'tsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(deps), plugins: [{ name: 'existing-native-dossier-boundaries', setup(builder) { builder.onResolve({ filter: /.*/ }, args => { const alias = aliases.find(([pattern]) => pattern.test(args.path)); return alias ? { path: alias[1], external: true } : undefined; }); } }] })).outputFiles[0].text;
const mod = { exports: {} as any };
new Function('require', 'module', 'exports', code)((id: string) => { if (!(id in deps)) throw new Error(`Unexpected dependency ${id}`); return deps[id]; }, mod, mod.exports);
const { TenantDossierDataBrowser: Browser, TenantDossierFields: Fields, TenantDossierHistory: History, TenantSetupPanel: Setup, useTenantDossier } = mod.exports;
// Keep the public native operator facade real while isolating unrelated route
// exports. Its section dispatch and support scope must reach the current views.
const facadeDeps = { ...deps,
  'qa:console-workspace': { PlatformConsoleWorkspace: ({ section }: any) => <div data-current-console={section}>{section}</div> },
  'qa:console-shell': { PlatformShellLayout: Box },
  'qa:operator-auth': { usePlatformAuth: () => ({ platformUser: { role: api.role } }) },
  'qa:auth': { useAuth: () => ({ user: { id: 'operator' } }) },
  'qa:support-workspace': { SupportWorkspace: (props: any) => <div data-support-scope={JSON.stringify(props)}>Aktueller Support-Arbeitsbereich</div> },
  'qa:public-support': { PublicSupportQueue: () => <div>Öffentliche Anfragen</div> },
  'qa:unused-operator-page': { PlatformTenantDetailScreen: () => null, PlatformForbiddenScreen: () => null, PlatformIndexRedirect: () => null, PlatformLoginScreen: () => null },
  'expo-router': { useRouter: () => ({ push: noop, replace: noop }), useLocalSearchParams: () => api.params },
};
const facadeAliases: [RegExp,string][] = [
  [/PlatformConsoleWorkspace\.native/, 'qa:console-workspace'], [/PlatformShellLayout\.native/, 'qa:console-shell'],
  [/PlatformAuthProvider/, 'qa:operator-auth'], [/^@\/lib\/auth$/, 'qa:auth'],
  [/components\/support\/SupportWorkspace\.native/, 'qa:support-workspace'], [/PublicSupportQueue\.native/, 'qa:public-support'],
  [/PlatformTenantDetailScreen\.native|PlatformForbiddenScreen|PlatformLoginScreen/, 'qa:unused-operator-page'],
  ...aliases,
];
const facadeCode = (await build({ entryPoints: ['src/screens/platformConsole/index.native.ts'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(facadeDeps), plugins: [{ name: 'current-operator-route-boundaries', setup(builder) { builder.onResolve({ filter: /.*/ }, args => { const alias = facadeAliases.find(([pattern]) => pattern.test(args.path)); return alias ? { path: alias[1], external: true } : undefined; }); } }] })).outputFiles[0].text;
const facadeModule = { exports: {} as any };
new Function('require', 'module', 'exports', facadeCode)((id: string) => { if (!(id in facadeDeps)) throw new Error('Unexpected operator facade dependency ' + id); return (facadeDeps as Record<string,any>)[id]; }, facadeModule, facadeModule.exports);
// Keep the generated shell real: the header, tabs and page data must share one
// vertical scroll owner. DOM topology is a regression check, not layout proof.
const shellViewport = { width: 360, height: 800 };
const shellDeps: Record<string, any> = { ...deps,
  'react-native': { ...native, ScrollView: (p: any) => <div data-console-scroll="true">{p.children}</div>, View: (p: any) => <div style={flatten(p.style)}>{p.children}</div>, useWindowDimensions: () => ({ ...shellViewport, fontScale: 1.6 }) },
  'qa:shell-icons': { SemanticIconLabel: (p: any) => <span>{p.label}</span>, SemanticArtwork: (p: any) => <span>{p.children}</span> },
  'qa:shell-font': { webScaledFontMetric: (value: number) => value },
  'qa:shell-navigation': { PLATFORM_CONSOLE_TITLE: 'Plattformverwaltung', PLATFORM_NAV_ITEMS: [{ path: '/platform', label: 'Übersicht', icon: '', group: 'overview' }] },
  'qa:shell-platform': { getPlatformReleaseInfo: () => ({ environment: 'preview' }), platformRoleHasCapability: () => true, PLATFORM_ROLE_LABELS: { platform_owner: 'Plattforminhaber' } },
  'qa:shell-auth': { usePlatformAuth: () => ({ platformUser: { role: 'platform_owner', email: 'owner@example.invalid' }, refresh: noop }) },
  'qa:shell-theme': { spacing: { xs: 4, sm: 8, md: 16, lg: 24 } },
  'qa:shell-toggle': { DesktopSidebarToggle: () => null },
  'qa:shell-preferences': { useDesktopWorkspacePreferences: () => ({ leftCollapsed: false, toggleLeft: noop }) },
  'qa:shell-boundary': { PlatformErrorBoundary: Box },
  'qa:shell-search': { PlatformGlobalSearch: () => <button>Suchen</button> },
  'qa:shell-surface': { HealthOSPageSurface: (p: any) => <div data-surface-fill={String(p.fill)}>{p.children}</div> },
  'qa:shell-logo': { LiquidLogo: () => null },
  'qa:shell-text-size': { PortalTextSizeControls: () => <button>Textgröße</button> },
  'qa:shell-session': { useAuth: () => ({ signOut: noop }), signOut: async () => ({ ok: true }), setDemoPlatformUser: noop },
  'qa:shell-label': { consoleLabel: (value: string) => value },
  'expo-router': { usePathname: () => '/platform/tenants/a', useRouter: () => ({ push: noop, replace: noop }) },
};
const shellAliases: [RegExp,string][] = [
  [/SemanticIconLabel|SemanticArtwork/, 'qa:shell-icons'], [/webFontSize/, 'qa:shell-font'],
  [/platformNavigation/, 'qa:shell-navigation'], [/^@\/lib\/platformConsole$/, 'qa:shell-platform'],
  [/PlatformAuthProvider/, 'qa:shell-auth'], [/^@\/theme$/, 'qa:shell-theme'],
  [/DesktopSidebarToggle/, 'qa:shell-toggle'], [/useDesktopWorkspacePreferences/, 'qa:shell-preferences'],
  [/PlatformErrorBoundary/, 'qa:shell-boundary'], [/PlatformGlobalSearch/, 'qa:shell-search'],
  [/HealthOSPageSurface/, 'qa:shell-surface'], [/LiquidPrimitives/, 'qa:shell-logo'],
  [/PortalTextSizeControls/, 'qa:shell-text-size'], [/^@\/lib\/auth$|supabase\/authService|platformAuthService/, 'qa:shell-session'],
  [/consoleWorkspaceModel/, 'qa:shell-label'],
];
const shellCode = (await build({ entryPoints: ['src/components/platformConsole/PlatformShellLayout.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(shellDeps), plugins: [{ name: 'native-shell-system-boundaries', setup(builder) { builder.onResolve({ filter: /.*/ }, args => { const alias = shellAliases.find(([pattern]) => pattern.test(args.path)); return alias ? { path: alias[1], external: true } : undefined; }); } }] })).outputFiles[0].text;
const shellModule = { exports: {} as any };
new Function('require', 'module', 'exports', shellCode)((id: string) => { if (!(id in shellDeps)) throw new Error('Unexpected native shell dependency ' + id); return shellDeps[id]; }, shellModule, shellModule.exports);
const ActualNativeShell = shellModule.exports.PlatformShellLayout;
const dossier: TenantDossier = { tenantId: 'a', checkedAt: '2026-10-09T01:00:00Z', company: { name: 'Firma A' }, platform: {}, branding: null, billing: null, bank: null, portal: null, tax: null, register: null, counts: { clients: { total: 1055, active: 1055, deleted: 1, complete: 1000, portalEnabled: 0, portalLinked: 0 }, employees: { total: 2, active: 2, deleted: 0, complete: 1, portalEnabled: 0, portalLinked: 0 }, accounts: 3, adminAccounts: 1, loggedInAccounts: 0, lastLoginAt: null, services: 0, pricedServices: 0, assignments: 5, documents: 7 }, sections: [{ key: 'clients', label: 'Klient:innen', scope: 'clients', available: true, count: 1056, updatedAt: null }, { key: 'client_contacts', label: 'Kontaktpersonen', scope: 'clients', available: true, count: 2, updatedAt: null }, { key: 'tenants', label: 'Unternehmensstammdaten', scope: 'company', available: true, count: 1, updatedAt: null }] };
const row = { id: 'person-1', tenant_id: 'a', first_name: 'Anna', last_name: 'Test', care_level: '2', email: 'anna@example.test', status: 'active' };
const page = (id: string, query: any, rows: any[] = [row]) => ({ ok: true, data: { tenantId: id, section: query.section, rows, total: 1055, offset: query.offset ?? 0, limit: 50, hasMore: true, available: true, statuses: ['active', 'inactive'] } });
let root: Root, host: HTMLDivElement;
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); };
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); await flush(); };
const click = async (label: string) => { const button = [...host.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label || node.textContent?.includes(label)); expect(button, label).toBeTruthy(); await act(async () => button!.click()); await flush(); };
const change = async (label: string, value: string) => { const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!; expect(input).toBeTruthy(); await act(async () => { Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }); await flush(); };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); api.role = 'platform_owner'; api.params = {}; api.page.mockImplementation(async (id, query) => page(id, query)); api.summary.mockResolvedValue({ ok: true, data: dossier }); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it('native search and pagination address the entire data set and reset offset on filters', async () => {
  await render(<Browser dossier={dossier} scope="clients" initialSection="clients" />); expect(host.textContent).toContain('1055 passende Datensätze');
  await click('Weitere Datensätze'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ offset: 50 }));
  await change('Suchen', 'Berlin'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ offset: 0, search: 'Berlin' }));
  await click('Status'); await click('Inaktiv'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ offset: 0, status: 'inactive' }));
});

it('opens complete native fields and loads related records for the exact selected person', async () => {
  await render(<Browser dossier={dossier} scope="clients" initialSection="clients" />); await click('Alle Angaben zu Anna Test öffnen');
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Pflegegrad'); expect(host.querySelector('[role="dialog"]')?.textContent).toContain('anna@example.test');
  await click('Zugehörige Angaben und Akten'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ section: 'client_contacts', parentId: 'person-1' }));
});

it('does not display responses from a company that has already been closed', async () => {
  let finish!: (value: any) => void; api.page.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(<Browser dossier={dossier} scope="clients" />);
  api.page.mockImplementation(async (id, query) => page(id, query, [{ ...row, first_name: 'Aktuelle Firma B' }]));
  await render(<Browser dossier={{ ...dossier, tenantId: 'b' }} scope="clients" />);
  await act(async () => finish(page('a', { section: 'clients' }, [{ ...row, first_name: 'Alte Firma A' }])));
  expect(host.textContent).toContain('Aktuelle Firma B'); expect(host.textContent).not.toContain('Alte Firma A');
});

it('keeps failed searches and retries with the same filter', async () => {
  await render(<Browser dossier={dossier} scope="clients" />); api.page.mockResolvedValueOnce({ ok: false, error: 'Verbindung unterbrochen' });
  await change('Suchen', 'Anna'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Verbindung unterbrochen'); expect(host.querySelector<HTMLInputElement>('[aria-label="Suchen"]')?.value).toBe('Anna');
  await click('Erneut laden'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ search: 'Anna' })); expect(host.textContent).toContain('Anna Test');
});

it('retains false and zero and removes nested credentials from native fields', async () => {
  await render(<Fields row={{ weekly_hours: 0, portal_enabled: false, email: null, api_key: 'hidden-top', details: { city: 'Berlin', password: 'hidden-nested' } }} />);
  expect(host.textContent).toContain('Nein'); expect(host.textContent).toContain('0'); expect(host.textContent).toContain('Nicht hinterlegt');
  await click('Weitere Angaben anzeigen'); expect(host.textContent).toContain('Berlin'); expect(host.textContent).not.toContain('hidden-');
});

it('opens the corresponding native setup section and exposes missing criteria', async () => {
  const open = vi.fn(); await render(<Setup dossier={dossier} onSection={open} />); expect(host.textContent).toContain('Rechnungspräfix'); expect(host.textContent).toContain('Nachweis:');
  const title = [...host.querySelectorAll('span')].find(item => item.textContent === 'Bankverbindung')!;
  let card: HTMLElement | null = title; while (card && !card.querySelector('button')) card = card.parentElement;
  expect(card).toBeTruthy(); await act(async () => card!.querySelector<HTMLButtonElement>('button')!.click());
  expect(open).toHaveBeenCalledWith('tenant_bank_accounts');
});

it('keeps multi-digit setup counts and the percentage explanation in continuous native text', async () => {
  const setup = buildTenantSetup(dossier), open = vi.fn();
  expect(setup.applicable).toBeGreaterThanOrEqual(10);
  const Header = mod.exports.TenantDossierHeader;
  await render(<Header dossier={dossier} onOpen={open} />);
  const count = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Prüfschritten vollständig'))!;
  expect([...count.children].map(child => child.textContent)).toEqual([`${setup.complete} von ${setup.applicable} Prüfschritten vollständig`]);
  await act(async () => count.click()); expect(open).toHaveBeenCalledWith('setup');
  await render(<Setup dossier={dossier} onSection={open} />);
  const explanation = [...host.querySelectorAll('span')].find(node => node.textContent?.startsWith(`${setup.percentage}% der Grundkonfiguration sind anhand`));
  expect(explanation).toBeTruthy();
  expect(explanation!.parentElement!.children).toHaveLength(1);
});

it('shows recorded actors and before/after values without revealing credentials', async () => {
  api.page.mockImplementation(async (id, query) => page(id, query, [{ id: 'event', action: 'tenant.record_updated', actor_name: 'Inhaber', created_at: '2026-10-09T01:00:00Z', before: { city: 'Herne', secret: 'hidden-before' }, after: { city: 'Dortmund', secret: 'hidden-after' } }]));
  await render(<History tenantId="a" />); await click('Geänderte Angaben anzeigen'); expect(host.textContent).toContain('Inhaber'); expect(host.textContent).toContain('Herne'); expect(host.textContent).toContain('Dortmund'); expect(host.textContent).not.toContain('hidden-');
});

it('immediately hides an owner dossier when access is removed and ignores its pending response', async () => {
  let finish!: (value: any) => void; api.summary.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  function Probe({ enabled }: { enabled: boolean }) { const result = useTenantDossier('a', enabled, undefined); return <span>{result.data?.company.name ?? 'Keine Akte'}</span>; }
  await render(<Probe enabled />); await render(<Probe enabled={false} />); await act(async () => finish({ ok: true, data: dossier }));
  expect(host.textContent).toBe('Keine Akte'); expect(api.summary).toHaveBeenCalledTimes(1);
});


it('preserves native alerts and selected tabs while representing status through its live region', async () => {
  const { NativeDiv, NativeButton } = mod.exports;
  await render(<NativeDiv><NativeDiv role="alert">Speichern fehlgeschlagen</NativeDiv><NativeDiv role="status">Auswahl gespeichert</NativeDiv><NativeButton role="tab" aria-selected>Aktueller Bereich</NativeButton><NativeDiv role="tabpanel">Bereichsinhalt</NativeDiv></NativeDiv>);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Speichern fehlgeschlagen');
  expect(host.querySelector('[data-live="polite"]')?.textContent).toBe('Auswahl gespeichert');
  expect(host.querySelector('[role="tab"]')?.textContent).toBe('Aktueller Bereich');
  expect(host.querySelector('[role="status"],[role="tabpanel"]')).toBeNull();
});


it.each([['PlatformDashboardScreen', 'dashboard'], ['PlatformBillingScreen', 'billing']])('routes %s through the current canonical native console', async (exportName, section) => {
  const Page = facadeModule.exports[exportName]; await render(<Page />);
  expect(host.querySelector('[data-current-console]')?.getAttribute('data-current-console')).toBe(section);
});

it.each([360, 1280])('scrolls the native header, tabs and actual dossier together at %s', async width => {
  shellViewport.width = width; const { NativeButton } = mod.exports;
  await render(<ActualNativeShell title="Pflege & Alltag Nord" subtitle="Unternehmen, kostenlose Nutzung, Funktionen und Support"><NativeButton role="tab" aria-selected>Alle Klient:innen</NativeButton><Browser dossier={dossier} scope="clients" initialSection="clients" /></ActualNativeShell>);
  const heading = [...host.querySelectorAll('[role="header"]')].find(node => node.textContent === 'Pflege & Alltag Nord')!;
  const action = host.querySelector<HTMLButtonElement>('[aria-label="Alle Angaben zu Anna Test öffnen"]')!;
  const owner = action.closest('[data-console-scroll]');
  expect(owner).toBeTruthy(); expect(heading.closest('[data-console-scroll]')).toBe(owner);
  expect(host.querySelector('[role="tab"]')?.closest('[data-console-scroll]')).toBe(owner);
  expect(owner!.querySelector('[data-console-scroll]')).toBeNull();
  expect(owner!.querySelector('[data-surface-fill="false"]')).toBeTruthy();
  if (width === 360) expect((heading.parentElement as HTMLElement).style.flexBasis).toBe('100%');
  await act(async () => action.click()); expect(host.querySelector('[role="dialog"]')?.textContent).toContain('anna@example.test');
});

it.each([800, 390])('keeps child-owned support content bounded beneath the scrolling header at height %s', async height => {
  shellViewport.width = 360; shellViewport.height = height;
  await render(<ActualNativeShell title="Support" scroll={false}><div data-support-workspace>Ticketliste und Verlauf</div></ActualNativeShell>);
  const child = host.querySelector('[data-support-workspace]')!;
  const surface = child.closest('[data-surface-fill="true"]')!;
  expect(surface).toBeTruthy(); expect((surface.parentElement as HTMLElement).style.height).toBe(`${Math.max(480, height - 32)}px`);
  const heading = [...host.querySelectorAll('[role="header"]')].find(node => node.textContent === 'Support')!;
  expect(child.closest('[data-console-scroll]')).toBe(heading.closest('[data-console-scroll]'));
});

it('opens the current support facade with the exact company and ticket and denies a reader', async () => {
  api.params = { tenantId: 'company-a', ticket: 'ticket-a' }; const Support = facadeModule.exports.PlatformSupportScreen;
  await render(<Support />);
  expect(JSON.parse(host.querySelector('[data-support-scope]')!.getAttribute('data-support-scope')!)).toMatchObject({ platformMode: true, tenantId: 'company-a', initialTicket: 'ticket-a' });
  api.role = 'platform_readonly'; await render(<Support />);
  expect(host.querySelector('[data-support-scope]')).toBeNull(); expect(host.textContent).toContain('keinen Zugriff auf den Support');
});
