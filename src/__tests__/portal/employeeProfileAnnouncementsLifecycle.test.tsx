// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmployeePortalProfile } from '@/hooks/useEmployeePortalProfile';
import { useEmployeePortalPersonnelView } from '@/hooks/useEmployeePortalPersonnelView';
import { usePortalProfileAvatar } from '@/hooks/usePortalProfileAvatar';
import { useNotifications } from '@/hooks/usenotifications';
import { EmployeePortalAnnouncementsScreen } from '@/screens/portal/EmployeePortalAnnouncementsScreen';
import { EmployeeProfileScreen } from '@/screens/portal/EmployeeProfileScreen';

const h = vi.hoisted(() => ({
  actor: { tenantId: 'tenant-a', employeeId: 'employee-a', actorId: 'account-a', roleKey: 'employee_portal', isReady: true },
  auth: { user: { id: 'user-a' }, profile: { id: 'user-a', avatarUrl: null }, portalSession: null },
  profile: vi.fn(), timesheet: vi.fn(), personnel: vi.fn(), avatar: vi.fn(), notifications: vi.fn(), count: vi.fn(),
  detail: vi.fn(), read: vi.fn(), acknowledge: vi.fn(), push: vi.fn(), snapshot: null as any,
}));
vi.mock('react-native', () => {
  const Box = ({ children }: any) => <div>{children}</div>;
  return { View: Box, Text: Box, ScrollView: Box, RefreshControl: () => null, Pressable: ({ children, onPress, accessibilityLabel }: any) =>
    <button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>,
    Platform: { OS: 'web' }, StyleSheet: { create: (styles: any) => styles },
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } };
});
vi.mock('@/lib/auth/context', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.actor.tenantId }));
vi.mock('@/lib/portal', () => ({ fetchEmployeePortalProfile: h.profile, fetchEmployeeTimesheet: h.timesheet }));
vi.mock('@/lib/portal/employeePortalPersonnelService', () => ({ fetchEmployeePortalPersonnelView: h.personnel }));
vi.mock('@/lib/portal/employeePortalAvatar', () => ({ fetchEmployeePortalAvatar: h.avatar }));
vi.mock('@/lib/realtime', () => ({ subscribeToEmployeePortalChanges: () => () => {}, subscribeToNotificationChanges: () => () => {} }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({ isLiveConnected: true }), DEFAULT_LIVE_POLL_MS: 30000 }));
vi.mock('@/hooks/core', async () => ({ useAsyncQuery: (await import('@/hooks/core/useAsyncQuery')).useAsyncQuery }));
vi.mock('@/lib/office/notificationservice', () => ({
  fetchUserNotifications: h.notifications, fetchUnreadNotificationCount: h.count,
  fetchBroadcastForNotification: h.detail, markNotificationRead: h.read, acknowledgeBroadcastNotification: h.acknowledge,
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ isPhone: true, isTablet: false, isDesktop: false }) }));
vi.mock('@/hooks/usePlatformLayout', () => ({ usePlatformLayout: () => ({ showBottomTabs: false }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true, check: () => ({}), roleLabel: 'Mitarbeitende' }) }));
vi.mock('@/components/auth/PortalDeviceSettingsCard', () => ({ PortalDeviceSettingsCard: () => null }));
vi.mock('@/components/auth/PortalBiometricSettingsCard', () => ({ PortalBiometricSettingsCard: () => null }));
vi.mock('@/components/healthos', () => ({ HealthOSAlert: () => null }));
vi.mock('@/components/permissions', () => ({ LockedActionBanner: () => null }));
vi.mock('@/design/tokens/themeBridge', () => ({ useLegacyTheme: () => ({ colors: { primary: '#00F' } }) }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/portal', () => ({ PortalAnnouncementsHero: () => <div>Mitteilungen</div>,
  PortalEmployeeProfileHero: ({ profile }: any) => <div>{profile.displayName}</div>,
  PortalEmployeeProfileTabContent: ({ view }: any) => <div>{JSON.stringify(view)}</div>,
  PORTAL_EMPLOYEE_PROFILE_TABS: [], OFFICE_PROFILE_HINT: 'Office' }));
vi.mock('@/components/ui', () => ({
  PremiumCard: ({ children }: any) => <div>{children}</div>,
  PremiumButton: ({ title, onPress, loading }: any) => <button disabled={loading} onClick={onPress}>{title}</button>,
  EmptyState: ({ title }: any) => <div>{title}</div>, ErrorState: ({ title, onRetry }: any) => <div>{title}<button onClick={onRetry}>Aktualisieren</button></div>, LoadingState: () => <div>Loading</div>, SegmentedTabs: () => null,
}));
vi.mock('@/theme', () => ({ typography: { body: {}, bodyStrong: {}, caption: {} }, spacing: { md: 16 } }));
vi.mock('@/design/tokens/portalPremium', () => ({ portalPremium: { text: { primary: '#000', secondary: '#333' } } }));

const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
let root: Root, host: HTMLDivElement;
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const press = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find((item) => item.textContent === label);
  expect(button, label).toBeDefined(); await act(async () => button!.click());
};
const item = { id: 'notice-a', tenantId: 'tenant-a', title: 'Dienstinformation', bodyPreview: 'Anfang…',
  relatedBroadcastId: 'broadcast-a', notificationType: 'broadcast', isRead: false,
  requireAcknowledgement: true, isAcknowledged: false, allowReplies: true, createdAt: '2026-10-11T08:00:00Z', priority: 'normal' };
function ProfileProbe() { h.snapshot = { ...useEmployeePortalProfile(), ...useEmployeePortalPersonnelView() }; return <div>{JSON.stringify(h.snapshot)}</div>; }
function AvatarProbe() { h.snapshot = usePortalProfileAvatar(); return <div>{h.snapshot.avatarUrl}</div>; }
function NotificationsProbe() { h.snapshot = useNotifications('broadcasts'); return <div>{JSON.stringify(h.snapshot.notifications)}</div>; }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  h.actor = { tenantId: 'tenant-a', employeeId: 'employee-a', actorId: 'account-a', roleKey: 'employee_portal', isReady: true };
  h.auth = { user: { id: 'user-a' }, profile: { id: 'user-a', avatarUrl: null }, portalSession: null };
  h.profile.mockResolvedValue({ ok: true, data: { displayName: 'Person A' } });
  h.timesheet.mockResolvedValue({ ok: true, data: [{ id: 'timesheet-a' }] });
  h.personnel.mockResolvedValue({ ok: true, data: { contact: ['Kontakt A'] } });
  h.avatar.mockResolvedValue({ avatarUrl: 'https://example.test/avatar-a', updatedAt: 'a' });
  h.notifications.mockResolvedValue({ ok: true, data: [item] }); h.count.mockResolvedValue({ ok: true, data: 1 });
  h.detail.mockResolvedValue({ ok: true, data: { body: 'Vollständige Dienstinformation bis zum letzten Satz.' } });
  h.read.mockResolvedValue({ ok: true }); h.acknowledge.mockResolvedValue({ ok: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('employee profile and announcement identity boundaries', () => {
  it('keeps the real basic profile visible when the additional personnel query fails and offers retry', async () => {
    h.personnel.mockResolvedValueOnce({ ok: false, error: 'Personalakte nicht verfügbar' });
    await render(<EmployeeProfileScreen />);
    expect(host.textContent).toContain('Person A'); expect(host.textContent).toContain('Weitere Profildaten nicht verfügbar');
    expect(host.textContent).not.toContain('Keine Profildaten');
    await press('Aktualisieren'); expect(host.textContent).toContain('Kontakt A');
    expect(host.textContent).not.toContain('Weitere Profildaten nicht verfügbar');
  });
  it('immediately removes profile, personnel and timesheet data while another account loads', async () => {
    await render(<ProfileProbe />); expect(host.textContent).toContain('Person A'); expect(host.textContent).toContain('Kontakt A');
    const pending = deferred<any>(); h.profile.mockReturnValue(pending.promise); h.timesheet.mockReturnValue(pending.promise); h.personnel.mockReturnValue(pending.promise);
    h.actor = { ...h.actor, employeeId: 'employee-b', actorId: 'account-b' };
    await render(<ProfileProbe />);
    expect(h.snapshot.profile).toBeNull(); expect(h.snapshot.personnelView).toBeNull(); expect(h.snapshot.timesheet).toEqual([]);
    expect(host.textContent).not.toContain('Person A'); expect(host.textContent).not.toContain('Kontakt A');
    await act(async () => pending.resolve({ ok: false, error: 'Kein Zugriff' }));
    expect(h.snapshot.error).toBe('Kein Zugriff');
  });
  it('does not restore a late response from the previous profile account', async () => {
    const old = deferred<any>(); h.profile.mockReturnValueOnce(old.promise);
    await render(<ProfileProbe />);
    h.actor = { ...h.actor, employeeId: 'employee-b', actorId: 'account-b' }; h.profile.mockResolvedValue({ ok: true, data: { displayName: 'Person B' } });
    await render(<ProfileProbe />); await act(async () => old.resolve({ ok: true, data: { displayName: 'Person A' } }));
    expect(h.snapshot.profile.displayName).toBe('Person B');
  });
  it('never keeps the previous employee avatar while the new avatar request is pending or denied', async () => {
    await render(<AvatarProbe />); expect(h.snapshot.avatarUrl).toContain('avatar-a');
    const next = deferred<any>(); h.avatar.mockReturnValueOnce(next.promise);
    h.actor = { ...h.actor, employeeId: 'employee-b', actorId: 'account-b' }; await render(<AvatarProbe />);
    expect(h.snapshot.avatarUrl).toBeUndefined(); await act(async () => next.resolve(null)); expect(h.snapshot.avatarUrl).toBeUndefined();
  });
  it('loads broadcast notifications addressed directly to the employee and clears the previous scope', async () => {
    await render(<NotificationsProbe />);
    expect(h.notifications).toHaveBeenCalledWith('tenant-a', 'user-a', 'employee-a', 'broadcasts');
    const next = deferred<any>(); h.notifications.mockReturnValueOnce(next.promise);
    h.actor = { ...h.actor, employeeId: 'employee-b', actorId: 'account-b' }; await render(<NotificationsProbe />);
    expect(h.snapshot.notifications).toEqual([]);
    await act(async () => next.resolve({ ok: true, data: [] })); expect(h.snapshot.notifications).toEqual([]);
  });
  it('shows live full text, saves the employee read receipt and allows acknowledgement and reply', async () => {
    await render(<EmployeePortalAnnouncementsScreen />);
    expect(host.textContent).toContain('Dienstinformation'); expect(h.detail).not.toHaveBeenCalled();
    await press('Vollständig lesen');
    expect(host.textContent).toContain('bis zum letzten Satz.');
    expect(h.read).toHaveBeenCalledWith('tenant-a', 'notice-a', 'user-a', 'employee-a');
    await press('Mitteilung bestätigen');
    expect(h.acknowledge).toHaveBeenCalledWith('tenant-a', 'notice-a', 'user-a', 'employee-a'); expect(host.textContent).toContain('Mitteilung bestätigt');
    await press('Verwaltung antworten'); expect(h.push).toHaveBeenCalledWith('/portal/employee/messages?compose=1');
  });
  it('does not mark a failed full-text read and exposes a working retry', async () => {
    h.detail.mockResolvedValueOnce({ ok: false, error: 'Nicht freigegeben' });
    await render(<EmployeePortalAnnouncementsScreen />); await press('Vollständig lesen');
    expect(h.read).not.toHaveBeenCalled(); await press('Erneut versuchen');
    expect(h.read).toHaveBeenCalledTimes(1); expect(host.textContent).toContain('bis zum letzten Satz.');
  });
  it('keeps full text readable and retries an unsuccessful acknowledgement', async () => {
    h.acknowledge.mockResolvedValueOnce({ ok: false, error: 'Offline' });
    await render(<EmployeePortalAnnouncementsScreen />); await press('Vollständig lesen'); await press('Mitteilung bestätigen');
    expect(host.textContent).toContain('Bestätigung konnte nicht gespeichert'); expect(host.textContent).toContain('bis zum letzten Satz.');
    await press('Mitteilung bestätigen'); expect(h.acknowledge).toHaveBeenCalledTimes(2); expect(host.textContent).toContain('Mitteilung bestätigt');
  });
});
