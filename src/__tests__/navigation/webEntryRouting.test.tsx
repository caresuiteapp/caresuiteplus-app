// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pathname: '/business',
  auth: { authReady: false, isAuthenticated: false, authMode: 'supabase', profile: null, user: null, session: null, portalSession: null } as any,
  desktop: vi.fn(), legacy: vi.fn(), router: { replace: vi.fn() }, getSession: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-router', () => ({
  usePathname: () => state.pathname,
  useRouter: () => state.router,
  Redirect: ({ href }: { href: string }) => <span>Weiterleitung: {href}</span>,
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => state.auth }));
vi.mock('@/lib/supabase', () => ({ getSession: () => state.getSession() }));
vi.mock('@/hooks/useHydrated', async () => import('@/hooks/useHydrated.web'));
vi.mock('@/lib/navigation', async () => import('@/lib/navigation/redirects'));
vi.mock('@/components/ui', () => ({
  LoadingState: ({ message }: { message: string }) => <span>{message}</span>,
  ErrorState: ({ message }: { message: string }) => <span>{message}</span>,
}));
vi.mock('@/lib/auth/SessionAccessRecovery.web', () => ({ SessionAccessRecovery: () => <span>Sitzung prüfen</span> }));
// Keep both authentication guards real, including their hydration and redirects.
vi.mock('@/lib/auth/RequireRole', async () => import('@/lib/auth/RequireRole.web'));
vi.mock('@/components/ui/FullScreenLoader', () => ({ FullScreenLoader: () => <span>Laden</span> }));
vi.mock('@/liquid-command/screens/AccessScreens', () => ({ AccessHubScreen: () => <span>Zugang</span> }));
vi.mock('@/liquid-command/screens/CommandCenterScreen', () => ({ CommandCenterScreen: () => { state.desktop(); return <span>Desktop</span>; } }));
vi.mock('@/liquid-command/shell/LiquidModuleRouteLayout', () => ({ LiquidModuleRouteLayout: () => { state.legacy(); return <span>Fachseite</span>; } }));

import { LiquidCommandEntryScreen } from '@/liquid-command/screens/LiquidCommandEntryScreen.web';
import { DesktopEntryScreen } from '@/liquid-command/screens/DesktopEntryScreen.web';
import { resolveWebLoginReturn } from '@/lib/navigation/webLoginReturn';
import BusinessLayout from '../../../app/business/_layout';
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); state.pathname = '/business';
  state.auth = { authReady: false, isAuthenticated: false, authMode: 'supabase', profile: null, user: null, session: null, portalSession: null };
  state.getSession.mockResolvedValue({ ok: true, data: null });
  window.sessionStorage.clear(); window.history.replaceState({}, '', '/business');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = (view = <LiquidCommandEntryScreen />) => act(async () => { root.render(view); });

describe('web entry rendering', () => {
  it('never mounts the access page or desktop during restoration', async () => {
    await render(); expect(host.textContent).toBe('Laden'); expect(state.desktop).not.toHaveBeenCalled();
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey: 'business_admin' } };
    await render(); expect(host.textContent).toBe('Weiterleitung: /Desktop');
    expect(state.desktop).not.toHaveBeenCalled();
  });
  it('shows access for a settled anonymous session', async () => {
    state.auth.authReady = true; await render(); expect(host.textContent).toBe('Zugang');
  });
  it('keeps an authenticated session with unknown role out of the desktop', async () => {
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true };
    await render(); expect(host.textContent).toBe('Sitzung prüfen'); expect(state.desktop).not.toHaveBeenCalled();
  });
  it.each([['employee_portal', '/portal/employee'], ['client_portal', '/portal/client']])('routes %s without mounting the business desktop', async (role, destination) => {
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey: role } };
    await render(); expect(host.textContent).toBe(`Weiterleitung: ${destination}`); expect(state.desktop).not.toHaveBeenCalled();
  });
  it.each(['/business', '/business/dashboard'])('redirects %s before mounting the old business shell', async pathname => {
    state.pathname = pathname; await render(<BusinessLayout />);
    expect(host.textContent).toBe('Weiterleitung: /Desktop'); expect(state.legacy).not.toHaveBeenCalled();
  });
  it('keeps genuine business subpages available', async () => {
    state.pathname = '/business/office/clients'; await render(<BusinessLayout />);
    expect(host.textContent).toBe('Fachseite'); expect(state.legacy).toHaveBeenCalledOnce();
  });
});

describe('protected Desktop entry rendering', () => {
  beforeEach(() => {
    state.pathname = '/Desktop';
    window.history.replaceState({}, '', '/Desktop');
  });

  it('keeps the desktop unmounted while authentication is pending, including a stale business profile', async () => {
    state.auth = { ...state.auth, isAuthenticated: true, profile: { roleKey: 'business_admin' } };
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe('Sitzung wird geprüft…');
    expect(state.desktop).not.toHaveBeenCalled();
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it('sends an anonymous desktop visit to business login and preserves its complete return address', async () => {
    const address = '/Desktop?csWindow=saved-window#workspace';
    window.history.replaceState({}, '', address);
    state.auth.authReady = true;
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe('Weiterleitung zur Anmeldung…');
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/auth/business-login');
    expect(resolveWebLoginReturn('/Desktop')).toBe(address);
    expect(state.desktop).not.toHaveBeenCalled();
  });

  it('waits for a live Supabase session to reach the auth context instead of opening login or desktop early', async () => {
    state.auth.authReady = true;
    state.getSession.mockResolvedValue({ ok: true, data: { user: { id: 'business-user' } } });
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe('Sitzung wird geprüft…');
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(state.desktop).not.toHaveBeenCalled();
  });

  it.each(['business_admin', 'business_manager', 'billing', 'dispatch', 'counselor', 'akademie_admin'])('renders the desktop for the resolved %s workspace role', async roleKey => {
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey } };
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe('Desktop');
    expect(state.desktop).toHaveBeenCalledOnce();
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it('restores the desktop after a fresh mount at its existing URL without redirecting to public entry', async () => {
    const address = '/Desktop?csWindow=saved-window#workspace';
    window.history.replaceState({ id: 'desktop-entry' }, '', address);
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey: 'business_admin' } };
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe('Desktop');
    await act(async () => root.unmount());
    root = createRoot(host); state.desktop.mockClear();
    state.auth = { ...state.auth, authReady: false, isAuthenticated: false, profile: null };
    await render(<DesktopEntryScreen />);
    expect(state.desktop).not.toHaveBeenCalled();
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey: 'business_admin' } };
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe('Desktop');
    expect(state.desktop).toHaveBeenCalledOnce();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(address);
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ['employee_portal', '/portal/employee'], ['caregiver', '/portal/employee'], ['nurse', '/portal/employee'],
    ['client_portal', '/portal/client'], ['family_portal', '/portal/client'],
  ])('redirects %s to its portal without mounting a desktop frame', async (roleKey, destination) => {
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey } };
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe(`Weiterleitung: ${destination}`);
    expect(state.desktop).not.toHaveBeenCalled();
  });

  it('honors a portal password setup requirement over a stale business profile', async () => {
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey: 'business_admin' },
      portalSession: { roleKey: 'employee_portal', loginType: 'employee_portal', mustChangePassword: true, accountId: 'employee-account' } };
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe('Weiterleitung: /auth/employee-first-login?accountId=employee-account');
    expect(state.desktop).not.toHaveBeenCalled();
  });

  it('shows recovery when an authenticated token has no resolved workspace or portal identity', async () => {
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, user: { id: 'unresolved-user' }, session: { accessToken: 'synthetic-test-token' } };
    await render(<DesktopEntryScreen />);
    expect(host.textContent).toBe('Sitzung prüfen');
    expect(state.desktop).not.toHaveBeenCalled();
    expect(state.router.replace).not.toHaveBeenCalled();
  });
});
