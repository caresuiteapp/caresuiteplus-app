// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pathname: '/',
  replace: vi.fn(),
  desktop: vi.fn(),
  sessionPending: false,
  hydrated: true,
  auth: {} as any,
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  BackHandler: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));
vi.mock('expo-router', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: state.replace }),
  Stack: () => <div>Mitarbeitende · Klient:innen · Verwaltung</div>,
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => state.auth }));
vi.mock('@/hooks/useHydrated', () => ({ useHydrated: () => state.hydrated }));
vi.mock('@/lib/auth/useSupabaseSessionProbe', () => ({
  useSupabaseSessionProbe: () => state.sessionPending,
}));
vi.mock('@/lib/auth/tvDeviceLoginReturn.web', () => ({
  resolveTvLoginReturn: (path: string) => path,
}));
vi.mock('@/lib/react/runAppTransition', () => ({
  runAppTransition: (action: () => void) => action(),
}));
vi.mock('@/components/ui', () => ({
  FullScreenLoader: () => <span>Sitzung wird geprüft</span>,
}));
vi.mock('@/liquid-command/screens/LiquidCommandEntryScreen', () => ({
  LiquidCommandEntryScreen: () => {
    state.desktop();
    return <span>Workspace entry</span>;
  },
}));
// Resolve the platform-specific guard as Metro does in the web build.
vi.mock('@/lib/auth/RedirectIfAuthenticated', async () =>
  import('@/lib/auth/RedirectIfAuthenticated.web'),
);

import { WebStartDestinationProvider } from '@/components/brand/WebStartDestination.web';
import WebHomeEntry from '../../../app/index.web';
import AuthLayout from '../../../app/auth/_layout';
import { RedirectIfAuthenticated } from '@/lib/auth/RedirectIfAuthenticated.web';

let root: Root;
let host: HTMLDivElement;
function Flow() {
  return (
    <WebStartDestinationProvider>
      {state.pathname === '/' ? <WebHomeEntry /> : <AuthLayout />}
    </WebStartDestinationProvider>
  );
}
const render = (element = <Flow />) => act(async () => root.render(element));

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
  state.pathname = '/';
  state.sessionPending = false;
  state.hydrated = true;
  state.auth = {
    authReady: true, isAuthenticated: false, authMode: 'supabase',
    profile: null, portalSession: null, user: null, session: null,
    signOut: vi.fn(),
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('software entry always opens the public login overview', () => {
  it.each([
    ['anonymous', null, false],
    ['restoring session', null, true],
    ['business_admin', 'business_admin', true],
    ['employee_portal', 'employee_portal', true],
    ['client_portal', 'client_portal', true],
    ['family_portal', 'family_portal', true],
    ['platform identity without a company role', null, true],
  ])('keeps all three choices reachable for %s', async (label, roleKey, authenticated) => {
    state.auth = {
      ...state.auth,
      authReady: label !== 'restoring session',
      isAuthenticated: authenticated,
      profile: roleKey ? { roleKey } : null,
      user: authenticated ? { id: 'saved-user', roleKey } : null,
      session: authenticated ? { accessToken: 'test-only-token' } : null,
    };
    await render();
    expect(host.textContent).toContain('Zur Software');
    const button = host.querySelector<HTMLButtonElement>('.cs-start-software')!;
    await act(async () => button.click());
    expect(state.replace.mock.calls).toEqual([['/auth']]);
    // A delayed router update must leave the public choice mounted.
    expect(host.textContent).toContain('Zur Software');
    expect(state.desktop).not.toHaveBeenCalled();
    state.pathname = '/auth';
    await render();
    expect(host.textContent).toBe('Mitarbeitende · Klient:innen · Verwaltung');
    expect(state.replace.mock.calls).toEqual([['/auth']]);
    expect(state.auth.signOut).not.toHaveBeenCalled();
  });

  it.each(['/auth', '/auth/'])('shows %s even while hydration and session probes are pending', async (pathname) => {
    state.pathname = pathname;
    state.hydrated = false;
    state.sessionPending = true;
    state.auth.authReady = false;
    await render(<AuthLayout />);
    expect(host.textContent).toBe('Mitarbeitende · Klient:innen · Verwaltung');
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('keeps normal desktop navigation after the software overview was entered', async () => {
    await render();
    state.pathname = '/auth';
    await render();
    state.pathname = '/';
    await render();
    expect(host.textContent).toBe('Workspace entry');
    expect(state.desktop).toHaveBeenCalledOnce();
  });

  it('keeps authenticated role redirects on individual login routes', async () => {
    state.pathname = '/auth/employee-login';
    state.auth = {
      ...state.auth, isAuthenticated: true,
      profile: { roleKey: 'employee_portal' },
    };
    await render(<RedirectIfAuthenticated><span>Login form</span></RedirectIfAuthenticated>);
    expect(state.replace).toHaveBeenCalledWith('/portal/employee');
  });

  it.each(['/auth/employee-first-login', '/auth/reset-password'])('preserves authenticated setup route %s', async pathname => {
    state.pathname = pathname;
    state.auth = {
      ...state.auth, isAuthenticated: true,
      profile: { roleKey: 'employee_portal' },
    };
    await render(<RedirectIfAuthenticated><span>Password setup</span></RedirectIfAuthenticated>);
    expect(host.textContent).toBe('Password setup');
    expect(state.replace).not.toHaveBeenCalled();
  });
});
