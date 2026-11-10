// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeePortalDashboardProjection } from '@/types/portalSystem';

const h = vi.hoisted(() => ({ width: 360, fontScale: 1.6, push: vi.fn() }));
vi.mock('@/design/web/WebFontScaleProvider', () => ({ useWebFontScaleValue: () => 1 }));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  const style = (value: any) => JSON.stringify(actual.StyleSheet.flatten(typeof value === 'function' ? value({ pressed: false }) : value) ?? {});
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: 'android' },
    useWindowDimensions: () => ({ width: h.width, height: 800, scale: 1, fontScale: h.fontScale }),
    View: ({ children, style: value, testID }: any) => <div data-testid={testID} data-native-style={style(value)}>{children}</div>,
    Text: ({ children, style: value, numberOfLines }: any) => <span data-native-style={style(value)} data-lines={numberOfLines}>{children}</span>,
    Pressable: ({ children, onPress, accessibilityRole, accessibilityLabel, style: value, testID }: any) => <button role={accessibilityRole} aria-label={accessibilityLabel} data-testid={testID} data-native-style={style(value)} onClick={onPress}>{children}</button>,
  };
});
vi.mock('@/components/portal/employee/EmployeePortalArtwork', () => ({ EmployeePortalArtwork: () => null }));
vi.mock('expo-router', () => ({ usePathname: () => '/portal/employee', useRouter: () => ({ push: h.push }) }));
vi.mock('expo-linear-gradient', async () => ({ LinearGradient: (await import('react-native')).View }));
vi.mock('@expo/vector-icons/Ionicons', () => ({ default: () => null }));
vi.mock('@/components/images/CareSuiteImage', () => ({ CareSuiteImage: () => null }));
vi.mock('@/hooks/useHydrationSafeWindowDimensions', () => ({ useHydrationSafeWindowDimensions: () => ({ width: h.width, height: 800, hydrated: true }) }));
vi.mock('@/hooks/useMainModuleAccent', () => ({ useMainModuleAccent: () => '#056CE8' }));
vi.mock('@/hooks/useshellhostsaurora', () => ({ useShellHostsAurora: () => {} }));
vi.mock('@/hooks/useClientGreeting', () => ({ useClientGreeting: () => 'Guten Tag' }));
vi.mock('@/design/ThemeModeProvider', () => ({ useThemeMode: () => ({ mode: 'light', desktopThemeMode: 'dark', setMode: vi.fn(), toggleMode: vi.fn() }) }));
vi.mock('@/components/healthos', async () => ({
  ...await import('@/components/healthos/HealthOSStatusBadge'),
  HealthOSPage: ({ children }: any) => <main>{children}</main>,
  HealthOSAlert: () => null, HealthOSEmptyState: () => null, HealthOSErrorState: () => null, HealthOSLoadingState: () => null,
}));
vi.mock('@/components/ui', () => ({ PremiumListRow: () => null, CachedDataBanner: () => null, PremiumButton: () => null, ErrorState: () => null, SuccessState: () => null }));
vi.mock('@/components/adaptive', () => ({ AdaptiveKpiGrid: () => null }));
vi.mock('@/components/portal/SpatialPortalSurface', () => ({
  SpatialPortalSection: ({ children }: any) => <section>{children}</section>,
  SpatialPortalSurface: ({ children }: any) => <section>{children}</section>,
  SpatialPortalMetric: () => null, SpatialPortalPearlState: () => null,
}));

import { HealthOSEmployeePortalTodayView } from '@/components/healthos/employee/HealthOSEmployeePortalTodayView';

let host: HTMLDivElement, root: Root;
const title = 'Hauswirtschaftliche Unterstützung';
const dashboard = (patch: Partial<EmployeePortalDashboardProjection['todayAssignments'][number]> = {}): EmployeePortalDashboardProjection => ({
  todayAssignments: [{ assignmentId: 'long-title', title, clientName: 'Helene Musterfrau', clientId: 'client-fixture', plannedStartAt: '2026-10-26T14:00:00Z', plannedEndAt: '2026-10-26T16:00:00Z', locationAddress: 'Gartenstraße 24', status: 'geplant', canonicalStatus: 'planned', documentationPending: false, signaturePending: false, isLocked: false, ...patch }],
  upcomingAssignments: [], openTasks: [], openDocumentationCount: 0, missingSignatureCount: 0,
  openSignatureDocumentCount: 0, overdueSignatureDocumentCount: 0, messageCount: 0,
});
const nativeStyle = (node: Element) => JSON.parse(node.getAttribute('data-native-style') ?? '{}');
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.width = 360; h.fontScale = 1.6;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('actual employee home assignment rows', () => {
  it.each([320, 390, 768, 1024, 1440])('retains portal destinations at responsive width %s', async width => {
    h.width = width;
    await act(async () => root.render(<HealthOSEmployeePortalTodayView dashboard={dashboard()} displayName="Mara" loading={false} error={null} onRefresh={() => {}} />));
    const shortcuts = host.querySelector('[data-testid="employee-portal-premium-quick-actions"]')!;
    for (const [name, target] of [['Meine Einsätze','/portal/employee/assignments'],['Dokumentation','/portal/employee/dokumentation'],['Kalender','/portal/employee/calendar'],['Arbeitszeit','/portal/employee/arbeitszeit'],['Fahrtenbuch','/portal/employee/fahrtenbuch'],['Nachrichten','/portal/employee/messages'],['Dokumente','/portal/employee/documents'],['Aufgaben & Notizen','/portal/employee/tasks'],['Meine Akademie','/portal/employee/akademie']]) {
      const action = shortcuts.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
      expect(action, name).toBeTruthy();
      await act(async () => action.click());
      expect(h.push).toHaveBeenLastCalledWith(target);
    }
    const welcome = host.querySelector('[data-testid="employee-portal-premium-home-hero"]')!;
    const courses = [...welcome.querySelectorAll('button')].find(action => action.textContent === 'Meine Kurse');
    expect(courses).toBeDefined();
    await act(async () => courses!.click());
    expect(h.push).toHaveBeenLastCalledWith('/portal/employee/akademie');
    expect(host.textContent).toContain('Urlaub'); expect(host.textContent).toContain('Abwesenheit');
  });

  it('keeps unknown message and signature states visible instead of claiming completion', async () => {
    const data = { ...dashboard(), messageCountUnavailable: true, messagesError: 'Nicht erreichbar', signatureDocumentsError: 'Nicht erreichbar' };
    await act(async () => root.render(<HealthOSEmployeePortalTodayView dashboard={data} displayName="Mara" loading={false} error={null} onRefresh={() => {}} />));
    expect(host.textContent).toContain('Nachrichtenstatus nicht verfügbar');
    expect(host.textContent).toContain('Der aktuelle Nachrichtenstatus ist nicht verfügbar.');
    expect(host.textContent).toContain('Unterschriftenstatus derzeit nicht verfügbar.');
    expect(host.textContent).not.toContain('Keine neuen Nachrichten.');
    expect(host.textContent).not.toContain('Alles erledigt.');
  });

  it('retains overdue signatures and their real signing destination', async () => {
    const data = { ...dashboard(), openSignatureDocumentCount: 3, overdueSignatureDocumentCount: 1 };
    await act(async () => root.render(<HealthOSEmployeePortalTodayView dashboard={data} displayName="Mara" loading={false} error={null} onRefresh={() => {}} />));
    const action = host.querySelector<HTMLButtonElement>('[data-testid="healthos-employee-open-signatures"]')!;
    expect(action.textContent).toContain('3'); expect(action.textContent).toContain('1 überfällig');
    await act(async () => action.click()); expect(h.push).toHaveBeenLastCalledWith('/portal/employee/signatures');
  });

  it('retries a failed refresh and exposes a cached snapshot', async () => {
    const refresh=vi.fn();
    await act(async () => root.render(<HealthOSEmployeePortalTodayView dashboard={dashboard()} displayName="Mara" loading={false} error={null} onRefresh={refresh} fromCache refreshError="Keine Verbindung" />));
    expect(host.textContent).toContain('Gespeicherter Stand');
    const retry=[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Erneut versuchen')!;
    await act(async () => retry.click()); expect(refresh).toHaveBeenCalledOnce();
  });
  it.each([320, 360, 1280])('keeps the complete title below accessories and opens the actual assignment at width %s', async (width) => {
    h.width = width;
    await act(async () => root.render(<HealthOSEmployeePortalTodayView dashboard={dashboard()} displayName="Mara" loading={false} error={null} onRefresh={() => {}} />));
    const row = host.querySelector<HTMLButtonElement>('[data-testid="employee-home-assignment-long-title"]')!;
    expect(row.getAttribute('role')).toBe('button');
    expect(row.getAttribute('aria-label')).toContain(`${title}, Helene Musterfrau`);
    expect(row.getAttribute('aria-label')).toContain('Geplant');
    const renderedTitle = [...row.querySelectorAll('span')].find((node) => node.textContent === title)!;
    expect(renderedTitle.parentElement).toBe(row);
    expect(renderedTitle.getAttribute('data-lines')).toBeNull();
    expect(nativeStyle(renderedTitle).width).toBe('100%');
    expect(row.firstElementChild?.contains(renderedTitle)).toBe(false);
    expect(row.firstElementChild?.textContent).toContain('Geplant');
    expect(row.textContent).toContain('Helene Musterfrau');
    await act(async () => row.click());
    expect(h.push).toHaveBeenCalledExactlyOnceWith('/portal/employee/assignments/long-title');
  });

  it.each([
    { patch: { status: 'gestartet' as const }, notice: 'Aktiv', fromCache: false, route: '/portal/employee/assignments/long-title/execute' },
    { patch: { documentationPending: true }, notice: 'Dok. offen', fromCache: false, route: '/portal/employee/assignments/long-title/execute' },
    { patch: { signaturePending: true }, notice: 'Unterschr. offen', fromCache: false, route: '/portal/employee/assignments/long-title/execute' },
    { patch: { status: 'gestartet' as const }, notice: 'Aktiv', fromCache: true, route: '/portal/employee/assignments/long-title' },
  ])('preserves $notice status and cached=$fromCache navigation', async ({ patch, notice, fromCache, route }) => {
    await act(async () => root.render(<HealthOSEmployeePortalTodayView dashboard={dashboard(patch)} displayName="Mara" loading={false} error={null} onRefresh={() => {}} fromCache={fromCache} />));
    const row = host.querySelector<HTMLButtonElement>('[data-testid="employee-home-assignment-long-title"]')!;
    expect(row.firstElementChild?.textContent).toContain(notice);
    expect(row.getAttribute('aria-label')).toContain(notice);
    expect(row.textContent).toContain(title);
    await act(async () => row.click());
    expect(h.push).toHaveBeenCalledExactlyOnceWith(route);
  });
});
