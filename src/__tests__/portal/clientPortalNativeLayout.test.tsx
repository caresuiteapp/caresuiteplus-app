// @vitest-environment happy-dom
import React, { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  auth: {} as any, careMounts: 0, careUnmounts: 0, openURL: vi.fn(), signOut: vi.fn(), replace: vi.fn(),
}));
vi.mock('react-native', () => {
  const box = ({ children, testID }: any) => <div data-testid={testID}>{children}</div>;
  return { View: box, ScrollView: box, Text: box, Platform: { OS: 'android' }, StyleSheet: { create: (s: unknown) => s }, Linking: { openURL: api.openURL } };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: api.replace }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 18, left: 0, right: 0 }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => api.auth }));
vi.mock('@/lib/auth', () => ({ RequireAuth: ({ children }: { children: ReactNode }) => <>{children}</>, RequireRole: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/portal/ClientSignatureAttentionProvider', () => ({ ClientSignatureAttentionProvider: ({ children }: { children: ReactNode }) => {
  useEffect(() => { api.careMounts++; return () => { api.careUnmounts++; }; }, []);
  return <section data-testid="client-care-provider">{children}</section>;
} }));
vi.mock('@/liquid-command/shell/LiquidPortalRouteLayout', () => ({ LiquidPortalRouteLayout: () => <span>Client care workspace</span> }));
vi.mock('@/components/portal/ClientPortalAttentionPrompt', () => ({ ClientPortalAttentionPrompt: () => <span>Client signature prompt</span> }));
vi.mock('@/components/layout/HealthOSPageSurface', () => ({ HealthOSPageSurface: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/ui', () => ({
  LoadingState: ({ message }: any) => <span>{message}</span>,
  ErrorState: ({ title, message }: any) => <div role="alert">{title}: {message}</div>,
  PremiumButton: ({ title, loading, onPress }: any) => <button disabled={loading} onClick={onPress}>{title}</button>,
}));
import ClientPortalLayout from '../../../app/portal/client/_layout';

let root: Root, host: HTMLDivElement;
const render = async () => { await act(async () => root.render(<ClientPortalLayout />)); };
const click = async (label: string) => { await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === label)!.click()); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); api.careMounts = 0; api.careUnmounts = 0;
  api.signOut.mockResolvedValue(undefined); api.openURL.mockResolvedValue(undefined);
  api.auth = { authReady: true, isAuthenticated: true, signOut: api.signOut, session: null, user: null, portalSession: { tenantId: 'tenant', accountId: 'client-account', portalType: 'client', accessScope: 'client', clientId: 'client' } };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('actual native client route boundary', () => {
  it('waits for session recovery before mounting client care hooks', async () => {
    api.auth.authReady = false; await render();
    expect(host.textContent).toContain('Sitzung wird geprüft'); expect(api.careMounts).toBe(0);
    api.auth.authReady = true; await render();
    expect(host.textContent).toContain('Client care workspace'); expect(api.careMounts).toBe(1);
  });
  it('keeps ordinary client care and resets its provider on an authenticated account switch', async () => {
    await render(); expect(api.careMounts).toBe(1);
    api.auth.portalSession = { ...api.auth.portalSession, tenantId: 'other-tenant', accountId: 'other-account' };
    await render(); expect(api.careUnmounts).toBe(1); expect(api.careMounts).toBe(2);
  });
  it.each(['portal', 'user', 'jwt'])('never mounts care/signature hooks for a browser-only family identity from %s', async source => {
    if (source === 'portal') api.auth.portalSession = { ...api.auth.portalSession, portalType: 'academy_family', accessScope: 'academy', clientId: null };
    if (source === 'user') api.auth.user = { portalType: 'academy_family', accessScope: 'academy' };
    if (source === 'jwt') api.auth.session = { accessToken: 'header.' + btoa(JSON.stringify({ app_metadata: { portal_type: 'academy_family' } })) + '.signature' };
    await render();
    expect(host.querySelector('[data-testid="family-browser-access"]')).not.toBeNull();
    expect(host.textContent).toContain('Lernbereich ist im Browser verfügbar'); expect(api.careMounts).toBe(0);
    expect(host.textContent).not.toContain('Client care workspace');
    await click('Im Browser öffnen'); expect(api.openURL).toHaveBeenCalledExactlyOnceWith('https://www.caresuiteplus.app/auth/portal-code-login');
    await click('Abmelden'); expect(api.signOut).toHaveBeenCalledOnce(); expect(api.replace).toHaveBeenCalledExactlyOnceWith('/auth/client-login');
  });
  it('shows browser/open and logout failures without redirecting or exposing client care', async () => {
    api.auth.portalSession.accessScope = 'academy';
    api.openURL.mockRejectedValueOnce(new Error('no browser')); api.signOut.mockRejectedValueOnce(new Error('offline'));
    await render(); await click('Im Browser öffnen');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Browser konnte nicht geöffnet werden');
    await click('Abmelden'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Abmelden ist gerade nicht möglich');
    expect(api.replace).not.toHaveBeenCalled(); expect(api.careMounts).toBe(0);
  });
});
