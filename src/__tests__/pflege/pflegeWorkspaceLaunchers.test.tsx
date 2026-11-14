// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPflegeWorkspaceGroups, pflegeEverydayLinks, pflegeWorkspaceColumnCount, searchPflegeWorkspaceGroups } from '@/liquid-command/navigation/pflegeWorkspaceLaunchers';
import { pflegeNav } from '@/lib/navigation/moduleNav/pflegeNav';
import type { PermissionKey } from '@/types/permissions';
import { emptyPflegeDashboardStats } from '@/types/modules/pflege';
import { canShowDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';

const api = { tenantId: 'tenant', roleKey: 'business_admin', allowed: new Set<string>(), all: true, module: true, loading: true,
  error: null as string | null, accessLoading: false, accessError: null as string | null, refreshError: null as string | null,
  push: vi.fn(), refresh: vi.fn(), refreshPermissions: vi.fn(), dashboardProps: null as any, retained: new Map<string, () => void>() };
const access = () => ({ tenantId: api.tenantId, roleKey: api.roleKey, can: (key: PermissionKey) => api.all || api.allowed.has(key),
  hasModuleGate: () => api.module, loading: api.accessLoading, error: api.accessError, refreshPermissions: api.refreshPermissions });
const native = {
  View: (props: any) => <div>{props.children}</div>,
  Pressable: (props: any) => { api.retained.set(props.accessibilityLabel, props.onPress); return <button aria-label={props.accessibilityLabel} onClick={props.onPress}>{props.children}</button>; },
  Platform: { OS: 'web' }, StyleSheet: { create: (value: any) => value },
};
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'), 'react-native': native,
  'expo-router': { useRouter: () => ({ push: api.push }) },
  '@/components/documents/DocumentRecommendations': { DocumentRecommendations: () => null },
  '@/components/dashboard/PflegeDashboardView': { PflegeDashboardView: (props: any) => { api.dashboardProps = props; return <div>{props.error ?? (props.loading ? 'Dashboard lädt' : 'Dashboard bereit')}</div>; } },
  '@/hooks/usePflegeDashboard': { usePflegeDashboard: () => ({ stats: null, activePlans: [], loading: api.loading, error: api.error,
    refreshError: api.refreshError, refresh: api.refresh, access: access(), isScopeCurrent: () => api.module && !api.accessLoading && !api.accessError }) },
  '@/hooks/useHydrationSafeWindowDimensions': { useHydrationSafeWindowDimensions: () => ({ fontScale: 1 }) },
  '../components/LiquidPrimitives': {
    LiquidButton: (props: any) => <button onClick={props.onPress} disabled={props.loading}>{props.label}</button>,
    LiquidField: (props: any) => <input aria-label={props.label} value={props.value} onInput={event => props.onChangeText(event.currentTarget.value)} />,
    LiquidGlyph: () => null, LiquidState: (props: any) => <div>{props.title}{props.message}{props.actionLabel ? <button onClick={props.onAction}>{props.actionLabel}</button> : null}</div>,
    LiquidSurface: (props: any) => <section>{props.children}</section>, LiquidText: (props: any) => <span>{props.children}</span>,
  },
  '../shell/LiquidCommandShell': { LiquidCommandShell: (props: any) => <main>{props.aside}{props.children}</main> },
};
const compiled = buildSync({ entryPoints: ['src/liquid-command/screens/PflegeHomeWorkspace.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(dependencies) }).outputFiles[0].text;
const loaded = { exports: {} as any };
new Function('require', 'module', 'exports', compiled)((id: string) => { if (!(id in dependencies)) throw Error(`Unexpected dependency ${id}`); return dependencies[id]; }, loaded, loaded.exports);
const Workspace = loaded.exports.PflegeHomeWorkspace;
const panel = (props: any) => <section><h2>{props.title}</h2>{props.children}</section>;
const dashboardDependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': dependencies['react/jsx-runtime'], 'react-native': { ...native, Text: (props: any) => <span>{props.children}</span> },
  'expo-router': dependencies['expo-router'],
  '@/components/icons/SemanticArtwork': { SemanticArtwork: () => null },
  '@/components/adaptive': { AdaptiveKpiGrid: (props: any) => <div>{props.items.map((item: any) => <div key={item.id}>{item.node}</div>)}</div> },
  '@/components/pflege/CareLightCarePlanCard': { CareLightCarePlanCard: () => null },
  '@/components/ui': { EmptyState: (props: any) => <span>{props.title}</span>, ErrorState: () => null, LoadingState: () => null, PremiumButton: (props: any) => <button>{props.title}</button>, PremiumKpiCard: (props: any) => <span>{props.label}: {props.value}</span>, PremiumListRow: (props: any) => <span>{props.title}</span>, SectionPanel: panel },
  '@/hooks/useshellhostsaurora': { useShellHostsAurora: () => true },
  '@/hooks/useMainModuleAccent': { useMainModuleAccent: () => '#22C55E' },
  '@/design/tokens/modules': { moduleColor: () => '#22C55E' },
  '@/theme': { spacing: { xs: 4, sm: 8, md: 12 }, typography: { caption: {} } },
};
const dashboardSource = buildSync({ entryPoints: ['src/components/dashboard/PflegeDashboardView.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(dashboardDependencies) }).outputFiles[0].text;
const dashboardModule = { exports: {} as any };
new Function('require', 'module', 'exports', dashboardSource)((id: string) => { if (!(id in dashboardDependencies)) throw Error(`Unexpected dashboard dependency ${id}`); return dashboardDependencies[id]; }, dashboardModule, dashboardModule.exports);
const Dashboard = dashboardModule.exports.PflegeDashboardView;
let root: Root, host: HTMLDivElement;
const render = async (tenantId: string | null = api.tenantId) => { await act(async () => root.render(<Workspace tenantId={tenantId} />)); };
const link = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label} öffnen"]`);
const button = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent === label);
const search = async (query: string) => {
  const field = host.querySelector<HTMLInputElement>('[aria-label="Pflegebereiche suchen"]')!;
  await act(async () => { field.value = query; field.dispatchEvent(new Event('input', { bubbles: true })); });
};
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  api.tenantId = 'tenant'; api.roleKey = 'business_admin'; api.allowed.clear(); api.all = true; api.module = true; api.loading = true; api.error = null; api.dashboardProps = null; api.retained.clear(); vi.clearAllMocks();
  api.accessLoading = false; api.accessError = null; api.refreshError = null;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('live Pflege workspace navigation', () => {
  it('covers every existing principal navigation destination once for an authorized administrator', () => {
    const routes = buildPflegeWorkspaceGroups(access()).flatMap(group => group.links.map(item => item.route));
    expect(routes).toEqual(pflegeNav.groups.flatMap(group => group.items.filter(item => item.href !== '/pflege').map(item => item.href)));
    expect(new Set(routes).size).toBe(routes.length);
    for (const route of ['/pflege/plans', '/pflege/sis', '/pflege/dokumentation', '/pflege/vitalwerte', '/pflege/medikation', '/pflege/wunddokumentation', '/pflege/behandlungspflege', '/pflege/leistungsnachweise']) expect(routes).toContain(route);
  });
  it('filters destinations by actual module and view permissions', () => {
    api.all = false; api.allowed = new Set(['office.access', 'pflege.access', 'pflege.plans.view']);
    const routes = buildPflegeWorkspaceGroups(access()).flatMap(group => group.links.map(item => item.route));
    expect(routes).toContain('/pflege/plans'); expect(routes).not.toContain('/pflege/medikation'); expect(routes).not.toContain('/pflege/settings');
    api.module = false; expect(buildPflegeWorkspaceGroups(access())).toEqual([]);
  });
  it('keeps clinical navigation visible while dashboard reads are loading or fail', async () => {
    await render(); expect(host.textContent).toContain('Dashboard lädt'); expect(link('Pflegepläne')).not.toBeNull();
    api.loading = false; api.error = 'Dashboard nicht verfügbar'; await render();
    expect(host.textContent).toContain('Dashboard nicht verfügbar'); expect(link('Vitalwerte')).not.toBeNull();
    await act(async () => link('Vitalwerte')!.click()); expect(api.push).toHaveBeenLastCalledWith('/pflege/vitalwerte');
  });
  it('finds names, descriptions and aliases using only the current permitted route set', () => {
    const groups = buildPflegeWorkspaceGroups(access());
    const paths = (query: string) => searchPflegeWorkspaceGroups(groups, query).flatMap(group => group.links.map(item => item.route));
    expect(paths('VERSORGUNGSUEBERSICHT')).toEqual(['/pflege/versorgungsuebersicht']);
    expect(paths('bmp PZN')).toEqual(['/pflege/medikation']);
    api.all = false; api.allowed = new Set(['office.access', 'pflege.access', 'pflege.plans.view']);
    const allowedGroups = buildPflegeWorkspaceGroups(access());
    expect(searchPflegeWorkspaceGroups(allowedGroups, 'Mediplan')).toEqual([]);
    expect(pflegeEverydayLinks(allowedGroups).map(item => item.route)).toEqual(['/pflege/tourenplanung']);
  });
  it('shows only search results, restores quick links on clearing, and opens an exact existing route', async () => {
    await render(); expect(button('Medikation')).toBeDefined();
    await search('Mediplan'); expect(link('Medikation')).not.toBeNull(); expect(link('Vitalwerte')).toBeNull();
    expect(button('Medikation')).toBeUndefined(); expect(host.textContent).not.toContain('Kennzahlen aktualisieren');
    await act(async () => link('Medikation')!.click()); expect(api.push).toHaveBeenCalledWith('/pflege/medikation');
    await search('keintreffer'); expect(host.textContent).toContain('Keine passenden Pflegebereiche');
    await act(async () => button('Alle Pflegebereiche anzeigen')!.click());
    expect(link('Vitalwerte')).not.toBeNull(); expect(button('Medikation')).toBeDefined();
    await act(async () => button('Kennzahlen aktualisieren')!.click()); expect(api.refresh).toHaveBeenCalledTimes(1);
  });
  it('keeps permission errors distinct and hides links until scope is confirmed', async () => {
    api.accessLoading = true; await render();
    expect(host.textContent).toContain('Pflegezugriff wird geprüft'); expect(link('Vitalwerte')).toBeNull();
    api.accessLoading = false; api.accessError = 'Kein bestätigter Zugriff'; await render();
    expect(host.textContent).toContain('Pflegezugriff nicht bestätigt');
    expect(host.querySelector('[aria-label="Pflegebereiche suchen"]')).toBeNull();
    await act(async () => button('Zugriff erneut prüfen')!.click()); expect(api.refreshPermissions).toHaveBeenCalledTimes(1);
    api.accessError = null; api.refreshError = 'Keine frischen Kennzahlen'; await render();
    expect(link('Vitalwerte')).not.toBeNull(); expect(api.dashboardProps.refreshError).toBe(api.refreshError);
  });
  it('invalidates a retained action when rights or tenant change', async () => {
    await render(); const retained = api.retained.get('Pflegepläne öffnen')!;
    api.all = false; await render(); await act(async () => retained()); expect(api.push).not.toHaveBeenCalled();
    api.all = true; api.tenantId = 'other-tenant'; await render(); await act(async () => retained()); expect(api.push).not.toHaveBeenCalled();
  });
  it('does not show launchers without a confirmed matching tenant', async () => {
    await render(null); expect(link('Pflegepläne')).toBeNull(); expect(host.textContent).toContain('Mandantenkontext fehlt');
    await render('another-tenant'); expect(link('Pflegepläne')).toBeNull();
  });
  it('keeps real KPI overview without duplicate navigation and preserves the default full dashboard', async () => {
    const stats = { ...emptyPflegeDashboardStats(), visitsToday: 3 };
    await act(async () => root.render(<Dashboard stats={stats} activePlans={[]} loading={false} error={null} onRefresh={api.refresh} overviewOnly />));
    expect(host.textContent).toContain('Tourstopps heute: 3'); expect(host.textContent).toContain('Heute pflegerisch wichtig');
    expect(host.textContent).not.toContain('Pflegeeinsätze & Dienstplanung'); expect(host.textContent).not.toContain('Schnellzugriff');
    await act(async () => root.render(<Dashboard stats={stats} activePlans={[]} loading={false} error={null} onRefresh={api.refresh} />));
    expect(host.textContent).toContain('Pflegeeinsätze & Dienstplanung'); expect(host.textContent).toContain('Schnellzugriff');
  });
  it('filters KPI and priority navigation by current rights without reporting completed clinical work', async () => {
    api.all = false; api.allowed = new Set(['office.access', 'pflege.access', 'pflege.plans.view']);
    const stats = { ...emptyPflegeDashboardStats(), activePlansCount: 4, dueVitalsCount: 2, abnormalVitalsCount: 1 };
    const allowed = (route: string) => canShowDesktopCatalogRoute(route, access());
    await act(async () => root.render(<Dashboard stats={stats} activePlans={[]} loading={false} error={null} onRefresh={api.refresh} overviewOnly canOpenRoute={allowed} />));
    expect(host.textContent).toContain('Aktive Pflegepläne: 4'); expect(host.textContent).not.toContain('Vitalwerte fällig'); expect(host.textContent).not.toContain('Auffällige Vitalwerte');
    expect(host.textContent).not.toContain('Alle Pflegeaufgaben sind erledigt'); expect(host.textContent).toContain('Keine Hinweise in dieser Übersicht');
  });
  it('rechecks the latest navigation guard before a retained KPI action runs', async () => {
    const stats = { ...emptyPflegeDashboardStats(), abnormalVitalsCount: 2 };
    const onOpen = vi.fn();
    await act(async () => root.render(<Dashboard stats={stats} activePlans={[]} loading={false} error={null} onRefresh={api.refresh} overviewOnly canOpenRoute={() => true} onOpenRoute={onOpen} />));
    const retained = api.retained.get('Gespeicherte Grenzwertmarkierungen: 2')!; expect(retained).toBeTypeOf('function');
    await act(async () => retained()); expect(onOpen).toHaveBeenCalledWith('/pflege/vitalwerte'); onOpen.mockClear();
    await act(async () => root.render(<Dashboard stats={stats} activePlans={[]} loading={false} error={null} onRefresh={api.refresh} overviewOnly canOpenRoute={() => false} onOpenRoute={onOpen} />));
    await act(async () => retained()); expect(onOpen).not.toHaveBeenCalled(); expect(api.push).not.toHaveBeenCalled();
  });
  it('passes the same live tenant/right guard to dashboard navigation', async () => {
    await render(); const props = api.dashboardProps;
    expect(props.canOpenRoute('/pflege/vitalwerte')).toBe(true);
    api.all = false; await render(); expect(props.canOpenRoute('/pflege/vitalwerte')).toBe(false);
    await act(async () => props.onOpenRoute('/pflege/vitalwerte')); expect(api.push).not.toHaveBeenCalled();
    api.all = true; api.tenantId = 'different'; await render();
    expect(props.canOpenRoute('/pflege/vitalwerte')).toBe(false);
  });
  it('uses the actual content width and larger text to wrap cards without scaling text down', () => {
    expect(pflegeWorkspaceColumnCount(320)).toBe(1); expect(pflegeWorkspaceColumnCount(650)).toBe(2); expect(pflegeWorkspaceColumnCount(1200)).toBe(3);
    expect(pflegeWorkspaceColumnCount(650, 2)).toBe(1); expect(pflegeWorkspaceColumnCount(1200, 2)).toBe(2);
    expect(pflegeWorkspaceColumnCount(Number.NaN)).toBe(1);
  });
});
