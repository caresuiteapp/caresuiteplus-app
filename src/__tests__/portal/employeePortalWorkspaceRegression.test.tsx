// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  width: 1280, ready: true, path: '/portal/employee', careTours: vi.fn(), push: vi.fn(), dial: vi.fn(), refresh: vi.fn(),
  loading: false, error: null as string | null, refreshError: null as string | null,
  records: [] as Record<string, unknown>[],
}));
vi.mock('react-native', async () => {
  const React = await import('react');
  const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const View = ({ children, style, testID }: any) => <div data-testid={testID} data-native-style={JSON.stringify(flat(style))}>{children}</div>;
  const ScrollView = ({ children, style, contentContainerStyle, testID }: any) => <div data-testid={testID} data-native-scroll="true" data-native-style={JSON.stringify(flat(style))} data-content-style={JSON.stringify(flat(contentContainerStyle))}>{children}</div>;
  return {
    View, ScrollView, Text: ({ children }: any) => <span>{children}</span>,
    Pressable: ({ children, onPress, accessibilityLabel, accessibilityRole }: any) => <button data-native-role={accessibilityRole} aria-label={accessibilityLabel} onClick={onPress}>{children}</button>,
    TextInput: ({ value, onChangeText, accessibilityLabel }: any) => <input aria-label={accessibilityLabel} value={value} onInput={(event: any) => onChangeText(event.target.value)} />,
    StyleSheet: { create: (styles: unknown) => styles },
    Platform: { OS: 'android', select: (values: any) => values.android ?? values.default },
  };
});
vi.mock('expo-router', () => ({ usePathname: () => h.path, useRouter: () => ({ push: h.push }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
vi.mock('expo-linear-gradient', async () => ({ LinearGradient: (await import('react-native')).View }));
vi.mock('@expo/vector-icons/Ionicons', () => ({ default: () => null }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ width: h.width, isPhone: h.width < 600 }) }));
vi.mock('@/hooks/usePlatformLayout', () => ({ usePlatformLayout: () => ({ showBottomTabs: false }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ isReady: h.ready }) }));
vi.mock('@/components/keyboard/PortalKeyboard', async () => ({ PortalKeyboardScrollView: (await import('react-native')).ScrollView }));
vi.mock('@/components/layout/ScreenShell', () => ({ ScreenShell: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/components/portal/PortalMobileTabHeader', () => ({ PortalMobileTabHeader: () => null }));
vi.mock('@/components/portal/PortalPremiumPageHero', () => ({ PortalPremiumPageHero: () => <header>Seitenüberschrift</header> }));
vi.mock('@/components/clients/ClientAnimalAvatar', () => ({ ClientAnimalAvatar: () => null }));
vi.mock('@/screens/portal/EmployeePortalDashboardScreen', () => ({ EmployeePortalDashboardScreen: () => <section>Eigene Einsätze und Aufgaben</section> }));
vi.mock('@/components/pflege/PortalCarePanels', () => ({ EmployeeCareToursPanel: () => { h.careTours(); return <section>Meine Pflegetouren</section>; } }));
vi.mock('@/components/portal/EmployeePortalClientRecordContactActions', () => ({ dialPhoneNumber: h.dial }));
vi.mock('@/hooks/useEmployeePortalClientRecords', () => ({ useEmployeePortalClientRecords: () => ({ records: h.records, loading: h.loading, error: h.error, refreshError: h.refreshError, refresh: h.refresh }) }));
vi.mock('@/components/ui', () => ({
  PremiumButton: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button>,
  PremiumBadge: ({ label }: any) => <span>{label}</span>,
  LoadingState: ({ message }: any) => <p>{message}</p>,
  EmptyState: ({ title, message, actionLabel, onAction }: any) => <section>{title} {message}{onAction ? <button onClick={onAction}>{actionLabel}</button> : null}</section>,
  ErrorState: ({ title, message, onRetry }: any) => <section role="alert">{title}: {message}<button onClick={onRetry}>Erneut versuchen</button></section>,
}));

import { EmployeePortalOverviewScreen } from '@/screens/portal/EmployeePortalOverviewScreen';
import { EmployeePortalPageFrame } from '@/components/portal/EmployeePortalPageFrame';
import { EmployeePortalClientRecordsScreen } from '@/components/portal/EmployeePortalClientRecordsScreen';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

let host: HTMLDivElement, root: Root;
const item = (clientId: string, displayName: string, phone: string | null = null) => ({ clientId, displayName, city: 'Hannover', street: 'Gartenstraße 24', zip: '30159', careGradeLabel: 'PG 2', phone, mobile: null, hints: null, nextAssignmentAt: '2026-10-26T08:00:00Z', activeAssignmentCount: 1 });
const byId = (id: string) => host.querySelector(`[data-testid="${id}"]`)!;
const nativeStyle = (element: Element) => JSON.parse(element.getAttribute('data-native-style') ?? '{}');
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const button = (title: string) => [...host.querySelectorAll('button')].find((node) => node.textContent === title)!;
const editSearch = async (value: string) => { await act(async () => { const input = host.querySelector('input')!; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.width = 1280; h.ready = true; h.path = '/portal/employee'; h.loading = false; h.error = null; h.refreshError = null;
  h.records = [item('one', 'Helene Musterfrau', '0511 000000'), item('two', 'Friedrich-Wilhelm Mustermann-Beispiel')];
  h.refresh.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('employee portal workspace regression', () => {
  it('mounts the real home page with one outer scroll owner and no care-tour flow', async () => {
    await render(<EmployeePortalOverviewScreen />);
    expect(host.querySelectorAll('[data-native-scroll="true"]')).toHaveLength(1);
    expect(byId('employee-portal-tab-scroll').contains(byId('employee-portal-page-frame'))).toBe(true);
    expect(host.textContent).toContain('Eigene Einsätze und Aufgaben');
    expect(host.textContent).not.toContain('Meine Pflegetouren');
    expect(h.careTours).not.toHaveBeenCalled();
    expect(nativeStyle(byId('employee-portal-page-frame'))).toMatchObject({ flexGrow: 0, flexShrink: 0, flexBasis: 'auto' });
    expect(nativeStyle(byId('employee-portal-page-frame')).flex).toBeUndefined();
    expect(nativeStyle(byId('healthos-page-zone-content')).flex).toBeUndefined();
  });
  it('keeps the actor readiness gate before mounting dashboard content', async () => {
    h.ready = false; await render(<EmployeePortalOverviewScreen />);
    expect(host.textContent).toContain('Übersicht wird geladen');
    expect(host.textContent).not.toContain('Eigene Einsätze und Aufgaben');
    expect(h.careTours).not.toHaveBeenCalled();
  });
  it.each([true, false])('preserves the native frame scrollable=%s contract', async (scrollable) => {
    await render(<EmployeePortalPageFrame title="Testseite" showHero={false} scrollable={scrollable}><div>Inhalt</div></EmployeePortalPageFrame>);
    const frame = nativeStyle(byId('employee-portal-page-frame'));
    const zone = nativeStyle(byId('healthos-page-zone-content'));
    const content = nativeStyle(byId('employee-portal-contrast-r4-workspace'));
    for (const style of [frame, zone, content]) expect(style.flex).toBe(scrollable ? undefined : 1);
    if (scrollable) for (const style of [frame, content]) expect(style).toMatchObject({ flexGrow: 0, flexShrink: 0, flexBasis: 'auto' });
  });
  it.each([360, 1280])('keeps actual client card content and both actions in natural flow at width %s', async (width) => {
    h.width = width; h.path = '/portal/employee/clients';
    await render(<PortalTabScreen title="Klientenakten" hideHeaderOnPhone scroll={false}><EmployeePortalClientRecordsScreen /></PortalTabScreen>);
    expect(host.querySelectorAll('[data-native-scroll="true"]')).toHaveLength(1);
    const cell = byId('employee-portal-client-card-one');
    const card = cell.firstElementChild!;
    const actions = card.querySelector('[data-testid="employee-portal-client-card-actions"]')!;
    expect(nativeStyle(card).height).toBeUndefined();
    expect(nativeStyle(card).flexShrink).toBe(0);
    expect(nativeStyle(actions).marginTop).not.toBe('auto');
    expect(card.textContent).toContain('Helene Musterfrau');
    expect(actions.textContent).toContain('Anrufen');
    expect(actions.textContent).toContain('Akte öffnen');
    await act(async () => actions.querySelectorAll('button')[0].click());
    expect(h.dial).toHaveBeenCalledWith('0511 000000');
    await act(async () => actions.querySelectorAll('button')[1].click());
    expect(h.push).toHaveBeenCalledWith('/portal/employee/clients/one');
  });
  it('filters actual records, shows no results and restores records from the clear action', async () => {
    await render(<EmployeePortalClientRecordsScreen />);
    await editSearch('helene');
    expect(host.textContent).toContain('Helene Musterfrau'); expect(host.textContent).not.toContain('Friedrich-Wilhelm');
    await editSearch('kein passender name'); expect(host.textContent).toContain('Keine Treffer');
    const clear = host.querySelector<HTMLButtonElement>('[aria-label="Suche löschen"]')!;
    expect(clear.getAttribute('data-native-role')).toBe('button');
    await act(async () => clear.click());
    expect(host.textContent).toContain('Helene Musterfrau'); expect(host.textContent).toContain('Friedrich-Wilhelm');
    await act(async () => button('Klientenakten aktualisieren').click()); expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('keeps refresh failure visible while prior records and their open action remain usable', async () => {
    h.refreshError = 'Verbindung unterbrochen'; await render(<EmployeePortalClientRecordsScreen />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Verbindung unterbrochen');
    expect(host.textContent).toContain('Helene Musterfrau');
    await act(async () => button('Erneut versuchen').click()); expect(h.refresh).toHaveBeenCalledOnce();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Klientenakte Helene Musterfrau öffnen"]')!.click());
    expect(h.push).toHaveBeenCalledWith('/portal/employee/clients/one');
  });
});
