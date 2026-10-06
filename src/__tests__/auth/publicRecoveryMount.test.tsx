// @vitest-environment happy-dom
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  pathname: '/auth/forgot-password', hydrated: false, pending: true,
  auth: {} as any, replace: vi.fn(), backListener: vi.fn(), mounts: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  BackHandler: { addEventListener: mock.backListener },
}));
vi.mock('expo-router', () => ({
  usePathname: () => mock.pathname,
  useRouter: () => ({ replace: mock.replace }),
}));
vi.mock('@/hooks/useHydrated', () => ({ useHydrated: () => mock.hydrated }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => mock.auth }));
vi.mock('@/lib/auth/useSupabaseSessionProbe', () => ({ useSupabaseSessionProbe: () => mock.pending }));
vi.mock('@/lib/auth/tvDeviceLoginReturn.web', () => ({ resolveTvLoginReturn: (path: string) => path }));
vi.mock('@/lib/react/runAppTransition', () => ({ runAppTransition: (update: () => void) => update() }));
vi.mock('@/components/ui', () => ({ FullScreenLoader: () => <span>Sitzung wird geprüft</span> }));

import { RedirectIfAuthenticated } from '@/lib/auth/RedirectIfAuthenticated.web';

let host: HTMLDivElement, root: Root;
function RecoveryNavigation() {
  useEffect(() => { mock.mounts(); }, []);
  return <span>Öffentliche Wiederherstellung</span>;
}
const render = () => act(async () => { root.render(<RedirectIfAuthenticated><RecoveryNavigation /></RedirectIfAuthenticated>); });

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mock.pathname = '/auth/forgot-password'; mock.hydrated = false; mock.pending = true;
  mock.auth = { authReady: false, authMode: 'supabase', isAuthenticated: false, profile: null, portalSession: null, user: null, session: null };
  mock.backListener.mockReturnValue({ remove: vi.fn() });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('public web recovery during session restoration', () => {
  it.each(['/auth/forgot-password', '/auth/reset-password'])('mounts %s immediately while a saved session is still being checked', async pathname => {
    mock.pathname = pathname;
    await render();
    expect(host.textContent).toBe('Öffentliche Wiederherstellung');
    expect(mock.mounts).toHaveBeenCalledOnce();
    expect(mock.replace).not.toHaveBeenCalled();
  });

  it.each(['/auth/forgot-password', '/auth/reset-password'])('keeps %s mounted after an authenticated session resolves', async pathname => {
    mock.pathname = pathname;
    await render();
    mock.hydrated = true; mock.pending = false;
    mock.auth = { ...mock.auth, authReady: true, isAuthenticated: true, profile: { roleKey: 'business_admin' }, user: { id: 'test-only-user', roleKey: 'business_admin' }, session: { accessToken: 'test-only-token' } };
    await render();
    expect(host.textContent).toBe('Öffentliche Wiederherstellung');
    expect(mock.mounts).toHaveBeenCalledOnce();
    expect(mock.replace).not.toHaveBeenCalled();
    expect(mock.backListener).not.toHaveBeenCalled();
  });

  it('continues to check the session before rendering the business login', async () => {
    mock.pathname = '/auth/business-login';
    await render();
    expect(host.textContent).toBe('Sitzung wird geprüft');
    expect(mock.mounts).not.toHaveBeenCalled();
  });

  it('continues to check the portal session before employee first login', async () => {
    mock.pathname = '/auth/employee-first-login';
    await render();
    expect(host.textContent).toBe('Sitzung wird geprüft');
    expect(mock.mounts).not.toHaveBeenCalled();
  });
});
