// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pathname: '/business',
  auth: { authReady: false, isAuthenticated: false, profile: null, user: null, session: null, portalSession: null } as any,
  desktop: vi.fn(), legacy: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-router', () => ({
  usePathname: () => state.pathname,
  Redirect: ({ href }: { href: string }) => <span>Weiterleitung: {href}</span>,
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => state.auth }));
vi.mock('@/lib/auth/RequireRole', () => ({ RequireRole: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/ui/FullScreenLoader', () => ({ FullScreenLoader: () => <span>Laden</span> }));
vi.mock('@/liquid-command/screens/AccessScreens', () => ({ AccessHubScreen: () => <span>Zugang</span> }));
vi.mock('@/liquid-command/screens/CommandCenterScreen', () => ({ CommandCenterScreen: () => { state.desktop(); return <span>Desktop</span>; } }));
vi.mock('@/liquid-command/shell/LiquidModuleRouteLayout', () => ({ LiquidModuleRouteLayout: () => { state.legacy(); return <span>Fachseite</span>; } }));

import { LiquidCommandEntryScreen } from '@/liquid-command/screens/LiquidCommandEntryScreen.web';
import BusinessLayout from '../../../app/business/_layout';
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); state.pathname = '/business';
  state.auth = { authReady: false, isAuthenticated: false, profile: null, user: null, session: null, portalSession: null };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = (view = <LiquidCommandEntryScreen />) => act(async () => { root.render(view); });

describe('web entry rendering', () => {
  it('never mounts the access page or desktop during restoration', async () => {
    await render(); expect(host.textContent).toBe('Laden'); expect(state.desktop).not.toHaveBeenCalled();
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey: 'business_admin' } };
    await render(); expect(host.textContent).toBe('Desktop');
  });
  it('shows access for a settled anonymous session', async () => {
    state.auth.authReady = true; await render(); expect(host.textContent).toBe('Zugang');
  });
  it.each([['employee_portal', '/portal/employee'], ['client_portal', '/portal/client']])('routes %s without mounting the business desktop', async (role, destination) => {
    state.auth = { ...state.auth, authReady: true, isAuthenticated: true, profile: { roleKey: role } };
    await render(); expect(host.textContent).toBe(`Weiterleitung: ${destination}`); expect(state.desktop).not.toHaveBeenCalled();
  });
  it.each(['/business', '/business/dashboard'])('redirects %s before mounting the old business shell', async pathname => {
    state.pathname = pathname; await render(<BusinessLayout />);
    expect(host.textContent).toBe('Weiterleitung: /'); expect(state.legacy).not.toHaveBeenCalled();
  });
  it('keeps genuine business subpages available', async () => {
    state.pathname = '/business/office/clients'; await render(<BusinessLayout />);
    expect(host.textContent).toBe('Fachseite'); expect(state.legacy).toHaveBeenCalledOnce();
  });
});
