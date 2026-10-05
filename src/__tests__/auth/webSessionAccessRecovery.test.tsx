// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  auth: {} as any,
  replace: vi.fn(),
  pathname: '/',
  platform: { OS: 'web' },
  platformUser: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: mock.platform,
  StyleSheet: { create: (value: any) => value },
  View: ({ children }: any) => <div>{children}</div>,
  ScrollView: ({ children }: any) => <div>{children}</div>,
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: mock.replace }),
  usePathname: () => mock.pathname,
  Redirect: ({ href }: any) => <span>Redirect: {href}</span>,
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => mock.auth }));
vi.mock('@/lib/platformConsole/platformAuthService', () => ({ fetchPlatformCurrentUser: mock.platformUser }));
vi.mock('@/hooks/useHydrated', () => ({ useHydrated: () => true }));
vi.mock('@/lib/auth/useSupabaseSessionProbe', () => ({ useSupabaseSessionProbe: () => false }));
vi.mock('@/lib/auth/tvDeviceLoginReturn.web', () => ({ resolveTvLoginReturn: (path: string) => path }));
vi.mock('@/lib/react/runAppTransition', () => ({ runAppTransition: (fn: () => void) => fn() }));
vi.mock('@/components/ui', () => ({
  FullScreenLoader: () => <span>Loading</span>,
  LoadingState: () => <span>Loading</span>,
  ErrorState: () => <span>Error overlay</span>,
}));
vi.mock('@/components/ui/FullScreenLoader', () => ({ FullScreenLoader: () => <span>Loading</span> }));
vi.mock('@/liquid-command/screens/AccessScreens', () => ({ AccessHubScreen: () => <span>Portal selection</span> }));
vi.mock('@/liquid-command/screens/CommandCenterScreen', () => ({ CommandCenterScreen: () => <span>Protected desktop</span> }));
vi.mock('@/lib/navigation', () => ({
  checkRoleAccess: (_path: string, role: string | null) => ({ shouldRedirect: !role, target: '/auth/business-login' }),
  getLoginRedirectForPath: () => '/auth/business-login',
}));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidBackdrop: ({ children }: any) => <main>{children}</main>,
  LiquidLogo: () => <span>CareSuite HealthOS</span>,
  LiquidState: ({ title, message }: any) => <div><h1>{title}</h1><p>{message}</p></div>,
  LiquidButton: ({ label, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{label}</button>,
}));

import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { LiquidCommandEntryScreen } from '@/liquid-command/screens/LiquidCommandEntryScreen.web';
import { RedirectIfAuthenticated } from '@/lib/auth/RedirectIfAuthenticated.web';
import { RequireRole } from '@/lib/auth/RequireRole.web';

let root: Root;
let host: HTMLDivElement;
const render = (element: React.ReactNode) => act(async () => root.render(element));

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mock.platformUser.mockResolvedValue({ ok: true, data: null });
  mock.pathname = '/';
  mock.auth = {
    authReady: true, isAuthenticated: true, authMode: 'supabase',
    profile: null, portalSession: null,
    user: { id: 'test-user', roleKey: null },
    session: { accessToken: 'test-only-token' },
    profileBootstrapError: 'Benutzerrolle konnte nicht geladen werden.',
    signOut: vi.fn().mockResolvedValue(undefined),
    retryProfileBootstrap: vi.fn().mockResolvedValue(undefined),
  };
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('web saved-session access recovery', () => {
  it('opens a verified platform console only after an explicit user action', async () => {
    mock.platformUser.mockResolvedValue({ ok: true, data: { status: 'active' } });
    await render(<LiquidCommandEntryScreen />);
    expect(mock.platformUser).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Plattform-Konsole öffnen');
    expect(mock.replace).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Redirect: /platform');
    expect(host.textContent).not.toContain('Protected desktop');
    expect(host.textContent).not.toContain('Error overlay');
    const button = [...host.querySelectorAll('button')].find(node => node.textContent === 'Plattform-Konsole öffnen')!;
    await act(async () => button.click());
    expect(mock.replace).toHaveBeenCalledWith('/platform');
  });
  it.each(['disabled', 'revoked'])('does not grant console access to a %s platform account', async (status) => {
    mock.platformUser.mockResolvedValue({ ok: true, data: { status } });
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toContain('Anmeldung wiederherstellen');
    expect(host.textContent).not.toContain('Redirect: /platform');
    expect(host.textContent).not.toContain('Plattform-Konsole öffnen');
  });
  it('keeps recovery usable if the platform authorization lookup fails', async () => {
    mock.platformUser.mockRejectedValue(new Error('test-only connection failure'));
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toContain('Zu den Anmeldungen');
    expect(host.textContent).not.toContain('Protected desktop');
  });
  it('ends a hanging platform lookup after four seconds and exposes the login recovery', async () => {
    vi.useFakeTimers();
    mock.platformUser.mockReturnValue(new Promise(() => {}));
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toBe('Loading');
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(host.textContent).toContain('Zu den Anmeldungen');
    expect(host.textContent).not.toContain('Redirect: /platform');
  });
  it('ignores platform authorization from a previous identity after the session changes', async () => {
    const oldIdentity = Promise.withResolvers<any>();
    mock.platformUser.mockReturnValueOnce(oldIdentity.promise);
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toBe('Loading');
    mock.auth = { ...mock.auth, user: { id: 'next-test-user', roleKey: null }, session: { accessToken: 'next-test-only-token' } };
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toContain('Anmeldung wiederherstellen');
    await act(async () => oldIdentity.resolve({ ok: true, data: { status: 'active' } }));
    expect(host.textContent).not.toContain('Redirect: /platform');
    expect(host.textContent).not.toContain('Plattform-Konsole öffnen');
  });
  it('does not infer a desktop destination from an access token without a role', () => {
    const target = resolveAuthSessionTarget(mock.auth);
    expect(target.roleKey).toBeNull();
    expect(target.hasSessionTarget).toBe(false);
    expect(target.canRedirectHome).toBe(false);
  });
  it('shows usable recovery at the public root without mounting the desktop', async () => {
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toContain('Anmeldung wiederherstellen');
    expect(host.textContent).toContain('Zu den Anmeldungen');
    expect(host.textContent).not.toContain('Protected desktop');
    expect(host.textContent).not.toContain('Error overlay');
  });
  it('ends the broken session before returning to the three login choices', async () => {
    const signout = Promise.withResolvers<void>();
    mock.auth.signOut.mockReturnValue(signout.promise);
    await render(<LiquidCommandEntryScreen />);
    const button = [...host.querySelectorAll('button')].find(node => node.textContent === 'Zu den Anmeldungen')!;
    await act(async () => button.click());
    expect(mock.auth.signOut).toHaveBeenCalledOnce();
    expect(mock.replace).not.toHaveBeenCalled();
    expect(button.disabled).toBe(true);
    await act(async () => signout.resolve());
    expect(mock.replace).toHaveBeenCalledWith('/auth');
    mock.auth = { ...mock.auth, isAuthenticated: false, user: null, session: null };
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toBe('Portal selection');
  });
  it('allows profile retry and then opens a verified administration desktop', async () => {
    await render(<LiquidCommandEntryScreen />);
    const button = [...host.querySelectorAll('button')].find(node => node.textContent === 'Sitzung erneut prüfen')!;
    await act(async () => button.click());
    expect(mock.auth.retryProfileBootstrap).toHaveBeenCalledOnce();
    mock.auth.profile = { roleKey: 'business_admin', tenantId: 'test-tenant' };
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toBe('Protected desktop');
  });
  it.each([
    ['employee_portal', '/portal/employee'],
    ['client_portal', '/portal/client'],
    ['family_portal', '/portal/client'],
  ])('keeps the correct destination for verified %s sessions', async (roleKey, destination) => {
    mock.auth.profile = { roleKey, tenantId: 'test-tenant' };
    await render(<LiquidCommandEntryScreen />);
    expect(host.textContent).toBe(`Redirect: ${destination}`);
    expect(host.textContent).not.toContain('Protected desktop');
  });
  it('keeps a public login form reachable when a saved identity has no role', async () => {
    mock.pathname = '/auth/business-login';
    await render(<RedirectIfAuthenticated><span>Login form</span></RedirectIfAuthenticated>);
    expect(host.textContent).toBe('Login form');
    expect(mock.replace).not.toHaveBeenCalled();
  });
  it('continues to protect role-restricted URLs with recoverable actions', async () => {
    mock.pathname = '/business/office/clients';
    await render(<RequireRole><span>Private records</span></RequireRole>);
    expect(host.textContent).toContain('Anmeldung wiederherstellen');
    expect(host.textContent).not.toContain('Private records');
  });
  it('shows a sign-out failure and leaves recovery actions available', async () => {
    mock.auth.signOut.mockRejectedValue(new Error('test-only storage failure'));
    await render(<LiquidCommandEntryScreen />);
    const button = [...host.querySelectorAll('button')].find(node => node.textContent === 'Zu den Anmeldungen')!;
    await act(async () => button.click());
    expect(host.textContent).toContain('Die Sitzung konnte nicht beendet werden.');
    expect(button.disabled).toBe(false);
    expect(mock.replace).not.toHaveBeenCalled();
  });
});
