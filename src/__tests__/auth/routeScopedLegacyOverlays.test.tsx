// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartIntroReadyContext } from '@/components/brand/appStartIntroSession';
import { RouteScopedLegacyOverlays } from '@/components/auth/RouteScopedLegacyOverlays';

const route = vi.hoisted(() => ({ pathname: '/business' }));
vi.mock('expo-router', () => ({ usePathname: () => route.pathname }));
vi.mock('@/components/auth/BusinessWelcomeGate', () => ({ BusinessWelcomeGate: () => <span>Legacy Verwaltung</span> }));
vi.mock('@/components/auth/PortalWelcomeGate', () => ({ PortalWelcomeGate: () => <span>Legacy Portal</span> }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (ready = true) => {
  await act(async () => root.render(<AppStartIntroReadyContext.Provider value={ready}><RouteScopedLegacyOverlays /></AppStartIntroReadyContext.Provider>));
};

describe('native welcome follows the original desktop entry flow', () => {
  it.each(['/', '/business', '/business/dashboard', '/office/inventory', '/portal/employee', '/portal/client', '/liquid-command/access', '/auth/business-login'])('does not revive legacy welcome dialogs on %s', async pathname => {
    route.pathname = pathname;
    await render();
    expect(host.textContent).toBe('');
  });
  it('retains legacy gates outside the current route tree and defers them until startup finishes', async () => {
    route.pathname = '/legacy-application/dashboard';
    await render(false);
    expect(host.textContent).toBe('');
    await render(true);
    expect(host.textContent).toContain('Legacy Verwaltung');
    expect(host.textContent).toContain('Legacy Portal');
  });
});
