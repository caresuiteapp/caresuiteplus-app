// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebBackNavigation } from '@/hooks/useWebBackNavigation.web';
import { WEB_PAGE_LEAVE_EVENT } from '@/lib/navigation/webPageLeaveGuard.web';

const state = vi.hoisted(() => ({
  historyBack: vi.fn(), cancelStartup: vi.fn(), routerBack: vi.fn(), replace: vi.fn(),
  canGoBack: vi.fn(), authenticated: true,
}));
vi.mock('expo-router', () => ({ useRouter: () => ({
  back: state.routerBack, replace: state.replace, canGoBack: state.canGoBack,
}) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({
  isAuthenticated: state.authenticated, user: { id: 'user-a' },
  profile: { id: 'profile-a', tenantId: 'tenant-a', roleKey: 'business_admin' },
}) }));
vi.mock('@/lib/navigation/webNavigationHistory', () => ({ goBackWebPage: state.historyBack }));
vi.mock('@/lib/navigation/webDocumentStartup', () => ({ cancelWebDocumentStartup: state.cancelStartup }));
vi.mock('@/lib/auth/sessionTarget', () => ({ resolveAuthSessionTarget: () => ({ homePath: '/Desktop' }) }));

let host: HTMLDivElement;
let root: Root;
let listener: EventListener | undefined;
function CloseControl() {
  const close = useWebBackNavigation();
  return <button onClick={close}>Schließen</button>;
}
beforeEach(async () => {
  vi.clearAllMocks(); state.authenticated = true;
  state.historyBack.mockReturnValue(true); state.canGoBack.mockReturnValue(false);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<CloseControl/>));
});
afterEach(async () => {
  if (listener) window.removeEventListener(WEB_PAGE_LEAVE_EVENT, listener);
  listener = undefined;
  await act(async () => root.unmount()); host.remove();
});
const clickClose = async () => { await act(async () => host.querySelector('button')!.click()); };

describe('profile page guard in the shared web Close control', () => {
  it('keeps history and startup unchanged when the active page cancels closing', async () => {
    listener = event => event.preventDefault();
    window.addEventListener(WEB_PAGE_LEAVE_EVENT, listener);
    await clickClose();
    expect(state.historyBack).not.toHaveBeenCalled();
    expect(state.routerBack).not.toHaveBeenCalled();
    expect(state.replace).not.toHaveBeenCalled();
    expect(state.cancelStartup).not.toHaveBeenCalled();
    window.removeEventListener(WEB_PAGE_LEAVE_EVENT, listener); listener = undefined;
    await clickClose();
    expect(state.historyBack).toHaveBeenCalledOnce();
    expect(state.cancelStartup).toHaveBeenCalledOnce();
  });
  it('uses browser page history when the active page allows closing', async () => {
    const allowed = vi.fn(); listener = allowed;
    window.addEventListener(WEB_PAGE_LEAVE_EVENT, listener);
    await clickClose();
    expect(allowed).toHaveBeenCalledOnce();
    expect(state.historyBack).toHaveBeenCalledExactlyOnceWith(JSON.stringify(['user-a', 'profile-a', 'tenant-a', 'business_admin', null]));
    expect(state.routerBack).not.toHaveBeenCalled();
  });
  it('retains router back and Desktop fallback when there is no browser history', async () => {
    state.historyBack.mockReturnValue(false); state.canGoBack.mockReturnValue(true);
    await clickClose(); expect(state.routerBack).toHaveBeenCalledOnce();
    state.canGoBack.mockReturnValue(false);
    await clickClose(); expect(state.replace).toHaveBeenCalledExactlyOnceWith('/Desktop');
  });
});
