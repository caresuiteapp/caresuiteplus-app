// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientPortalWebLayout from '../../../app/portal/client/_layout.web';

const state = vi.hoisted(() => ({ path: '/portal/client/akademie', family: true, ready: true, normalShell: vi.fn(), attention: vi.fn(), provider: vi.fn() }));
vi.mock('expo-router', () => ({
  usePathname: () => state.path, Stack: () => <main>Routeinhalt</main>,
  Redirect: ({ href }: { href: string }) => <div>Weiterleitung: {href}</div>,
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ authReady: state.ready, portalSession: { tenantId: 'tenant', accountId: 'account', portalType: state.family ? 'academy_family' : 'client' }, session: null, signOut: vi.fn() }),
  RequireAuth: ({ children }: { children: ReactNode }) => children,
  RequireRole: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/ui', () => ({ LoadingState: ({ message }: { message: string }) => <div>{message}</div> }));
vi.mock('@/components/portal/ClientSignatureAttentionProvider', () => ({ ClientSignatureAttentionProvider: ({ children }: { children: ReactNode }) => { state.provider(); return children; } }));
vi.mock('@/components/portal/ClientPortalAttentionPrompt', () => ({ ClientPortalAttentionPrompt: () => { state.attention(); return null; } }));
vi.mock('@/liquid-command/shell/LiquidPortalRouteLayout', () => ({ LiquidPortalRouteLayout: () => { state.normalShell(); return <div>Versorgungsportal</div>; } }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidBackdrop: ({ children }: { children: ReactNode }) => children,
  LiquidVisualModeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/design/tokens/portalPremium', () => ({ PortalPremiumProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/portal/accessibility/PortalTextSizeControls', () => ({ PortalTextSizeControls: () => <span>Lesbarkeit</span> }));

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.path = '/portal/client/akademie'; state.family = true; state.ready = true; vi.clearAllMocks();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<ClientPortalWebLayout />)); };

describe('family learning portal isolation', () => {
  it('opens own learning without mounting care-profile, message or signature surfaces', async () => {
    await render(); expect(host.textContent).toContain('Mein persönlicher Lernbereich'); expect(host.textContent).toContain('Routeinhalt');
    expect(state.normalShell).not.toHaveBeenCalled(); expect(state.provider).not.toHaveBeenCalled(); expect(state.attention).not.toHaveBeenCalled();
  });
  it.each(['/portal/client', '/portal/client/messages', '/portal/client/documents/signatures', '/portal/client/profile'])('redirects %s before any care surface mounts', async path => {
    state.path = path; await render();
    expect(host.textContent).toBe('Weiterleitung: /portal/client/akademie');
    expect(state.normalShell).not.toHaveBeenCalled(); expect(state.provider).not.toHaveBeenCalled();
  });
  it('preserves the existing client portal and waits for session resolution', async () => {
    state.ready = false; await render(); expect(state.normalShell).not.toHaveBeenCalled();
    state.ready = true; state.family = false; await render();
    expect(host.textContent).toContain('Versorgungsportal'); expect(state.normalShell).toHaveBeenCalledTimes(1); expect(state.provider).toHaveBeenCalledTimes(1);
  });
});
