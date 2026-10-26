// @vitest-environment happy-dom
import React, { act, useEffect, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '@/lib/auth/context';

const state = vi.hoisted(() => ({
  pathname: '/business',
  mounts: 0,
  unmounts: 0,
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-router', () => ({
  usePathname: () => state.pathname,
  useRouter: () => state.router,
  useIsFocused: () => true,
  // The navigator boundary owns state independently of the URL, as the real
  // native navigator does. Its lifecycle must survive surrounding chrome.
  Stack: ({ screenLayout }: { screenLayout?: (props: { children: ReactNode }) => ReactNode }) => {
    const [instance] = useState(() => ++state.mounts);
    const [navigationMemory, setNavigationMemory] = useState('initial');
    useEffect(() => () => { state.unmounts += 1; }, []);
    const scene = <div data-navigator-instance={instance}>
      <span data-testid="destination">{state.pathname}</span>
      <button onClick={() => setNavigationMemory('retained')}>{navigationMemory}</button>
    </div>;
    return screenLayout ? screenLayout({ children: scene }) : scene;
  },
}));
vi.mock('@/lib/auth', async () => ({
  RequireAuth: (await import('@/lib/auth/RequireAuth')).RequireAuth,
  RequireRole: (await import('@/lib/auth/RequireRole')).RequireRole,
}));
vi.mock('@/lib/navigation', async () => import('@/lib/navigation/redirects'));
vi.mock('@/lib/supabase', () => ({ getSession: vi.fn(async () => ({ ok: true, data: null })) }));
vi.mock('@/components/ui', () => ({
  LoadingState: ({ message }: { message: string }) => <span>{message}</span>,
  ErrorState: ({ message }: { message: string }) => <span>{message}</span>,
}));
vi.mock('@/design/tokens/portalPremium', () => ({ PortalPremiumProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidVisualModeProvider: ({ children }: { children: ReactNode }) => children,
  LiquidBackdrop: ({ children }: { children: ReactNode }) => children,
  LiquidState: ({ title }: { title: string }) => <span>{title}</span>,
}));
vi.mock('@/liquid-command/shell/LiquidCommandShell', () => ({
  LiquidCommandShell: ({ children }: { children: ReactNode }) => <main data-testid="workspace-chrome">{children}</main>,
}));
vi.mock('@/components/assist/DeferredSignatureApprovalPopup', () => ({ DeferredSignatureApprovalPopup: () => null }));

import { AuthContext } from '@/lib/auth/context';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';

let host: HTMLDivElement;
let root: Root;
let auth: AuthContextValue;
const render = async () => {
  await act(async () => root.render(<AuthContext.Provider value={auth}><LiquidModuleRouteLayout /></AuthContext.Provider>));
};
const changePath = async (pathname: string) => { state.pathname = pathname; await render(); };
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); state.pathname = '/business'; state.mounts = 0; state.unmounts = 0;
  auth = {
    authReady: true, isInitialized: true, isLoading: false, isAuthenticated: true, authMode: 'demo',
    profile: { roleKey: 'business_admin', tenantId: 'tenant-1' }, user: null, session: null, portalSession: null,
    profileBootstrapError: null, retryProfileBootstrap: vi.fn(),
  } as unknown as AuthContextValue;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('native module navigator lifecycle', () => {
  it('keeps one navigator through desktop, workflow pages and return navigation', async () => {
    await render();
    expect(host.querySelector('[data-testid="workspace-chrome"]')).toBeNull();
    const firstInstance = host.querySelector('[data-navigator-instance]')?.getAttribute('data-navigator-instance');
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click());

    for (const pathname of ['/business/office/clients', '/business/office/documents', '/business']) {
      await changePath(pathname);
      expect(host.querySelector('[data-navigator-instance]')?.getAttribute('data-navigator-instance')).toBe(firstInstance);
      expect(host.querySelector('[data-testid="destination"]')?.textContent).toBe(pathname);
      expect(host.querySelector('button')?.textContent).toBe('retained');
      expect(Boolean(host.querySelector('[data-testid="workspace-chrome"]'))).toBe(pathname !== '/business');
    }
    expect(state.mounts).toBe(1); expect(state.unmounts).toBe(0);
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it('still prevents an employee portal identity from mounting the business navigator', async () => {
    auth.profile = { roleKey: 'employee_portal', tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await render();
    expect(state.mounts).toBe(0);
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/portal/employee');
  });

  it('waits for authentication and role restoration without choosing an Office fallback', async () => {
    state.pathname = '/business/office/clients';
    auth.authReady = false; auth.profile = null;
    await render();
    expect(state.mounts).toBe(0);
    expect(state.router.replace).not.toHaveBeenCalled();
    auth.authReady = true;
    await render();
    expect(host.textContent).toBe('Berechtigungen werden geladen…');
    expect(state.mounts).toBe(0);
    expect(state.router.replace).not.toHaveBeenCalled();
    auth.profile = { roleKey: 'business_admin', tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await render();
    expect(host.querySelector('[data-testid="destination"]')?.textContent).toBe('/business/office/clients');
    expect(state.mounts).toBe(1);
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it.each(['/pflege/klienten', '/stationaer/bewohner'])('keeps the unreleased product lock for %s', async pathname => {
    await changePath(pathname);
    expect(state.mounts).toBe(0);
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/business');
  });
});
