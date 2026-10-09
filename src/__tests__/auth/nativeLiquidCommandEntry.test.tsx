// @vitest-environment happy-dom
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionTargetInput } from '@/lib/auth/sessionTarget';
import { LiquidCommandEntryScreen } from '@/liquid-command/screens/LiquidCommandEntryScreen';

const state = vi.hoisted(() => ({
  auth: {
    authReady: true, isAuthenticated: false,
    profile: null, portalSession: null, user: null, session: null,
  } as SessionTargetInput & { authReady: boolean; isAuthenticated: boolean },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => state.auth }));
vi.mock('@/lib/auth/RequireRole', () => ({
  RequireRole: ({ children }: { children: ReactNode }) => <section data-testid="role-recovery">{children}</section>,
}));
vi.mock('@/components/ui/FullScreenLoader', () => ({
  FullScreenLoader: ({ message }: { message: string }) => <span>{message}</span>,
}));
vi.mock('@/liquid-command/screens/AccessScreens', () => ({
  AccessHubScreen: () => <span>Zugangsauswahl</span>,
}));
vi.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <span data-testid="redirect">{href}</span>,
}));
// A native entry must never instantiate the browser desktop's font-scale hook.
vi.mock('@/liquid-command/screens/CommandCenterScreen', () => {
  throw new Error('The web command center must not be imported by the native entry.');
});

let host: HTMLDivElement;
let root: Root;
const render = async () => { await act(async () => root.render(<LiquidCommandEntryScreen />)); };
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  state.auth = { authReady: true, isAuthenticated: false, profile: null, portalSession: null, user: null, session: null };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('native application entry', () => {
  it('waits for restoration before offering the three-portal access hub', async () => {
    state.auth.authReady = false;
    await render();
    expect(host.textContent).toBe('Sitzung wird wiederhergestellt…');
    expect(host.querySelector('[data-testid="redirect"]')).toBeNull();
    state.auth.authReady = true;
    await render();
    expect(host.textContent).toBe('Zugangsauswahl');
  });

  it('opens the protected native administration route for a business session', async () => {
    state.auth.isAuthenticated = true;
    state.auth.profile = { roleKey: 'business_admin' } as NonNullable<SessionTargetInput['profile']>;
    await render();
    expect(host.querySelector('[data-testid="redirect"]')?.textContent).toBe('/business');
  });

  it.each([
    { loginType: 'employee_portal' as const, roleKey: 'employee_portal' as const, home: '/portal/employee' },
    { loginType: 'client_portal' as const, roleKey: 'client_portal' as const, home: '/portal/client' },
  ])('opens the active $loginType despite a stale administration profile', async ({ loginType, roleKey, home }) => {
    state.auth.isAuthenticated = true;
    state.auth.profile = { roleKey: 'business_admin' } as NonNullable<SessionTargetInput['profile']>;
    state.auth.portalSession = {
      loginType, roleKey, sessionToken: 'token', tenantId: 'tenant-1', accountId: 'account-1',
      expiresAt: '2099-01-01T00:00:00.000Z',
    };
    await render();
    expect(host.querySelector('[data-testid="redirect"]')?.textContent).toBe(home);
  });

  it('requires the employee password change before the employee dashboard', async () => {
    state.auth.isAuthenticated = true;
    state.auth.portalSession = {
      loginType: 'employee_portal', roleKey: 'employee_portal', sessionToken: 'token', tenantId: 'tenant-1',
      accountId: 'employee-1', mustChangePassword: true, expiresAt: '2099-01-01T00:00:00.000Z',
    };
    await render();
    expect(host.querySelector('[data-testid="redirect"]')?.textContent)
      .toBe('/auth/employee-first-login?accountId=employee-1');
  });

  it('keeps an unresolved authenticated session inside the existing role recovery gate', async () => {
    state.auth.isAuthenticated = true;
    await render();
    expect(host.querySelector('[data-testid="role-recovery"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="redirect"]')).toBeNull();
    expect(host.textContent).toBe('Zugang wird geprüft…');
  });
});
