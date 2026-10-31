// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '@/lib/auth/context';

const state = vi.hoisted(() => ({
  pathname: '/auth/business-login',
  focused: true,
  backHandlers: new Set<() => boolean>(),
  router: { replace: vi.fn() },
  getSession: vi.fn(),
  hasPlatformSession: vi.fn(),
  platformAuth: { platformUser: null, loading: true, error: null as string | null, isActivePlatformUser: false, refresh: vi.fn() },
}));
vi.mock('react-native', async () => {
  const React = await import('react');
  const View = (props: any) => React.createElement('div', { 'data-testid': props.testID }, props.children);
  return {
  Platform: { OS: 'android' },
  View, ScrollView: View,
  Text: (props: any) => React.createElement('span', {}, props.children),
  Pressable: (props: any) => React.createElement('button', { 'aria-label': props.accessibilityLabel, onClick: props.onPress }, props.children),
  Modal: (props: any) => props.visible ? React.createElement('div', { 'data-native-modal': true }, props.children) : null,
  StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, absoluteFillObject: {} },
  BackHandler: { addEventListener: (_event: string, listener: () => boolean) => {
    state.backHandlers.add(listener);
    return { remove: () => state.backHandlers.delete(listener) };
  } },
}; });
vi.mock('expo-router', () => ({
  usePathname: () => state.pathname,
  useRouter: () => state.router,
  useIsFocused: () => state.focused,
}));
vi.mock('@/lib/supabase', () => ({ getSession: () => state.getSession() }));
vi.mock('@/lib/platformConsole/platformSession', () => ({ hasSupabaseAuthSession: () => state.hasPlatformSession() }));
vi.mock('@/lib/platformConsole/PlatformAuthProvider', () => ({ usePlatformAuth: () => state.platformAuth }));
vi.mock('@/components/ui', async () => {
  const states = await import('@/components/ui/StateViews');
  return { ...states, FullScreenLoader: ({ message }: { message: string }) => <states.LoadingState message={message} /> };
});
vi.mock('@/design/tokens/auroraGlass', () => ({ useActiveGlassTokens: () => ({}), useAuroraAdaptiveText: () => ({}), useAuroraGlassActive: () => false, useLightLiquidGlassShell: () => false, lightLiquidGlassWebFx: () => ({}) }));
vi.mock('@/design/tokens/themeBridge', () => ({ useLegacyTheme: () => ({ colors: { textPrimary: '#173b57', textSecondary: '#526b85' }, typography: { body: {}, h3: {} }, isLight: true }) }));
vi.mock('@/design/tokens/radius', () => ({ careRadius: { lg: 20 } }));
vi.mock('@/theme', () => ({ spacing: { lg: 24, md: 16, sm: 8 }, typography: { h3: {}, body: {}, caption: {} } }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ isPhone: true }) }));
vi.mock('@/components/ui/PremiumButton', () => ({ PremiumButton: () => null }));
vi.mock('@/components/ui/CareLightButton', () => ({ CareLightButton: () => null }));
vi.mock('@/components/brand/CareSuiteLoadingIndicator', () => ({ CareSuiteLoadingIndicator: () => <span>CareSuite</span> }));
vi.mock('@/components/brand/appStartIntroSession', () => ({ useAppStartIntroReady: () => true }));
vi.mock('@/components/icons/SemanticArtwork', () => ({ SemanticArtwork: () => null }));
vi.mock('@/design/tokens/spacing', () => ({ careSpacing: { xs: 4, sm: 8, md: 16, lg: 24 } }));
vi.mock('@/design/tokens/spatialCareSuite', () => ({ spatialCare: { radius: { card: 20, control: 12 } } }));
vi.mock('@/design/tokens/portalPremium', () => ({ portalPremium: { text: {}, accent: {} }, usePortalPremiumRuntimeTheme: () => ({ active: false }) }));
vi.mock('@/lib/dom/workflowFeedbackInteractionLock', () => ({ acquireWorkflowFeedbackInteractionLock: vi.fn() }));

import { AuthContext } from '@/lib/auth/context';
import { RedirectIfAuthenticated } from '@/lib/auth/RedirectIfAuthenticated';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { RequireRole } from '@/lib/auth/RequireRole';
import { RequireEmployeePasswordSetup } from '@/lib/auth/RequireEmployeePasswordSetup';
import { PlatformRouteGuard, PlatformSessionGate } from '@/components/platformConsole/PlatformRouteGuard';
import { GlobalWorkflowFeedbackProvider } from '@/components/ui/GlobalWorkflowFeedback';

let root: Root;
let host: HTMLDivElement;
let auth: AuthContextValue;
const render = (view = <RedirectIfAuthenticated><span>Retained auth navigator</span></RedirectIfAuthenticated>) => act(async () => {
  root.render(<AuthContext.Provider value={auth}><GlobalWorkflowFeedbackProvider>{React.cloneElement(view)}</GlobalWorkflowFeedbackProvider></AuthContext.Provider>);
});

describe('native retained guard feedback ownership', () => {
  const protectedPage = <RequireAuth><span>Protected data</span></RequireAuth>;
  const modal = () => host.querySelector('[data-native-modal]');

  it.each(['restoring', 'anonymous'] as const)('does not open a global native loading modal from an inactive %s auth guard', async phase => {
    state.focused = false; auth.authReady = phase !== 'restoring'; auth.isAuthenticated = false;
    await render(protectedPage);
    expect(modal()).toBeNull(); expect(host.textContent).not.toContain('Protected data');
  });

  it('dismisses the actual focused auth loading modal on blur without exposing protected children', async () => {
    auth.authReady = false;
    await render(protectedPage);
    expect(modal()).not.toBeNull();
    state.focused = false;
    await render(protectedPage);
    expect(modal()).toBeNull(); expect(host.textContent).not.toContain('Protected data');
  });

  it('does not unmount an authorized child during ordinary native blur', async () => {
    const mounted = vi.fn(), unmounted = vi.fn();
    function Child() { React.useEffect(() => { mounted(); return unmounted; }, []); return <span>Authorized data</span>; }
    const page = <RequireAuth><Child /></RequireAuth>;
    await render(page); state.focused = false; await render(page);
    expect(mounted).toHaveBeenCalledOnce(); expect(unmounted).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Authorized data'); expect(modal()).toBeNull();
  });

  it.each(['unresolved', 'denied'] as const)('does not open a global native feedback modal from an inactive %s role guard', async phase => {
    state.focused = false; state.pathname = '/business';
    auth.profile = phase === 'unresolved' ? null : { roleKey: 'employee_portal', tenantId: 'tenant-1' } as NonNullable<AuthContextValue['profile']>;
    await render(<RequireRole><span>Business data</span></RequireRole>);
    expect(modal()).toBeNull(); expect(host.textContent).not.toContain('Business data');
  });

  it.each(['pending', 'anonymous'] as const)('does not open a global native loading modal from an inactive %s platform session gate', async phase => {
    state.focused = false;
    if (phase === 'pending') state.hasPlatformSession.mockReturnValue(new Promise(() => undefined));
    await render(<PlatformSessionGate><span>Platform data</span></PlatformSessionGate>);
    expect(modal()).toBeNull(); expect(host.textContent).not.toContain('Platform data');
  });

  it.each(['loading', 'error', 'denied'] as const)('does not open a global native feedback modal from an inactive %s platform guard', async phase => {
    state.focused = false; state.platformAuth.loading = phase === 'loading';
    state.platformAuth.error = phase === 'error' ? 'Fixture authorization service unavailable' : null;
    await render(<PlatformRouteGuard><span>Platform data</span></PlatformRouteGuard>);
    expect(modal()).toBeNull(); expect(host.textContent).not.toContain('Platform data');
  });

  it('keeps the focused platform error modal and dismisses it on native blur', async () => {
    state.platformAuth.loading = false; state.platformAuth.error = 'Fixture authorization service unavailable';
    const page = <PlatformRouteGuard><span>Platform data</span></PlatformRouteGuard>;
    await render(page); expect(modal()).not.toBeNull();
    state.focused = false; await render(page);
    expect(modal()).toBeNull(); expect(host.textContent).not.toContain('Platform data');
  });

  it('does not cover the focused password setup form with feedback from a retained employee scene', async () => {
    state.focused = false; state.pathname = '/auth/employee-first-login';
    auth.portalSession = { roleKey: 'employee_portal', loginType: 'employee_portal', mustChangePassword: true, accountId: 'employee-1' } as NonNullable<AuthContextValue['portalSession']>;
    await render(<RequireEmployeePasswordSetup><span>Employee data</span></RequireEmployeePasswordSetup>);
    expect(modal()).toBeNull(); expect(host.textContent).not.toContain('Employee data');
    expect(state.router.replace).not.toHaveBeenCalled();
  });

  it('retains the focused employee password requirement and its loading feedback', async () => {
    state.pathname = '/portal/employee';
    auth.portalSession = { roleKey: 'employee_portal', loginType: 'employee_portal', mustChangePassword: true, accountId: 'employee-1' } as NonNullable<AuthContextValue['portalSession']>;
    await render(<RequireEmployeePasswordSetup><span>Employee data</span></RequireEmployeePasswordSetup>);
    expect(modal()).not.toBeNull(); expect(host.textContent).not.toContain('Employee data');
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/auth/employee-first-login?accountId=employee-1');
  });
});
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); state.pathname = '/auth/business-login'; state.focused = true; state.backHandlers.clear();
  state.getSession.mockResolvedValue({ ok: true, data: null });
  state.hasPlatformSession.mockResolvedValue(false);
  state.platformAuth = { platformUser: null, loading: true, error: null, isActivePlatformUser: false, refresh: vi.fn() };
  auth = { authReady: true, authMode: 'demo', isAuthenticated: true,
    profile: { roleKey: 'business_admin', tenantId: 'tenant-1' }, user: null, session: null, portalSession: null,
  } as unknown as AuthContextValue;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});

describe('native retained protected-route guard', () => {
  const protectedPage = <RequireAuth redirectTo="/auth/business-login"><span>Protected business data</span></RequireAuth>;

  it('leaves a stalled saved-session handoff after ten seconds without exposing protected data', async () => {
    vi.useFakeTimers();
    try {
      state.pathname = '/business/office/clients'; auth.authMode = 'supabase'; auth.isAuthenticated = false;
      state.getSession.mockResolvedValue({ ok: true, data: { user: { id: 'saved-user' } } });
      await render(protectedPage);
      expect(state.router.replace).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(10_001); });
      expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/auth/business-login');
      expect(host.textContent).not.toContain('Protected business data');
    } finally { vi.clearAllTimers(); vi.useRealTimers(); }
  });

  it('cancels the saved-session fallback when the verified auth context arrives', async () => {
    vi.useFakeTimers();
    try {
      state.pathname = '/business/office/clients'; auth.authMode = 'supabase'; auth.isAuthenticated = false;
      state.getSession.mockResolvedValue({ ok: true, data: { user: { id: 'saved-user' } } });
      await render(protectedPage);
      auth.isAuthenticated = true; await render(protectedPage);
      await act(async () => { await vi.advanceTimersByTimeAsync(10_001); });
      expect(state.router.replace).not.toHaveBeenCalled();
      expect(host.textContent).toContain('Protected business data');
    } finally { vi.clearAllTimers(); vi.useRealTimers(); }
  });

  it('bounds a session probe that never settles and cancels the fallback on native blur', async () => {
    vi.useFakeTimers();
    try {
      state.pathname = '/business/office/clients'; auth.authMode = 'supabase'; auth.isAuthenticated = false;
      state.getSession.mockReturnValue(new Promise(() => {}));
      await render(protectedPage);
      state.focused = false; await render(protectedPage);
      await act(async () => { await vi.advanceTimersByTimeAsync(10_001); });
      expect(state.router.replace).not.toHaveBeenCalled();
      state.focused = true; await render(protectedPage);
      await act(async () => { await vi.advanceTimersByTimeAsync(10_001); });
      expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/auth/business-login');
      expect(host.textContent).not.toContain('Protected business data');
    } finally { vi.clearAllTimers(); vi.useRealTimers(); }
  });

  it('does not let an inactive business scene replace an active portal login after logout', async () => {
    state.pathname = '/auth/client-login'; state.focused = false; auth.isAuthenticated = false;
    await render(protectedPage);
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Protected business data');
    state.pathname = '/business/office/clients'; state.focused = true;
    await render(protectedPage);
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/auth/business-login');
  });

  it('cancels an anonymous-session redirect when its native scene loses focus during the session probe', async () => {
    let finishProbe!: (result: { ok: true; data: null }) => void;
    state.getSession.mockReturnValue(new Promise(resolve => { finishProbe = resolve; }));
    state.pathname = '/business/office/clients'; auth.authMode = 'supabase'; auth.isAuthenticated = false;
    await render(protectedPage);
    state.focused = false;
    await render(protectedPage);
    await act(async () => { finishProbe({ ok: true, data: null }); });
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Protected business data');
  });
});

describe('native retained platform guard', () => {
  it('does not navigate to platform login after its pending session check loses focus', async () => {
    let finish!: (hasSession: boolean) => void;
    state.hasPlatformSession.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    state.pathname = '/platform/tenants';
    const page = <PlatformSessionGate><span>Private platform data</span></PlatformSessionGate>;
    await render(page);
    state.focused = false; state.pathname = '/business/office/clients';
    await render(page);
    await act(async () => { finish(false); });
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Private platform data');
  });

  it('still sends a focused anonymous platform scene to its login with the return target', async () => {
    state.pathname = '/platform/tenants';
    await render(<PlatformSessionGate><span>Private platform data</span></PlatformSessionGate>);
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/platform/login?redirect=%2Fplatform%2Ftenants');
    expect(host.textContent).not.toContain('Private platform data');
  });

  it('does not let a retained inactive platform guard replace the current workspace when authorization finishes', async () => {
    state.pathname = '/platform/tenants';
    const page = <PlatformRouteGuard><span>Private platform data</span></PlatformRouteGuard>;
    await render(page);
    state.focused = false; state.pathname = '/business/office/clients'; state.platformAuth.loading = false;
    await render(page);
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Private platform data');
  });

  it('still denies a focused user without active platform authorization', async () => {
    state.pathname = '/platform/tenants'; state.platformAuth.loading = false;
    await render(<PlatformRouteGuard><span>Private platform data</span></PlatformRouteGuard>);
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/platform/forbidden');
    expect(host.textContent).not.toContain('Private platform data');
  });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('native retained authentication guard', () => {
  it('redirects an authenticated focused login to its role-specific home', async () => {
    await render();
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/business');
    expect(state.backHandlers.size).toBe(1);
  });

  it.each(['/business/office/clients', '/akademie/courses', '/beratung/faelle', '/settings/profile'])('does not redirect or intercept Back after a retained auth scene loses focus to %s', async pathname => {
    await render();
    state.router.replace.mockClear();
    state.pathname = pathname; state.focused = false;
    await render();
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(state.backHandlers.size).toBe(0);
  });

  it('does not execute an offscreen login guard when a navigator keeps its own local auth pathname', async () => {
    state.focused = false;
    await render();
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(state.backHandlers.size).toBe(0);
    state.focused = true;
    await render();
    expect(state.router.replace).toHaveBeenCalledExactlyOnceWith('/business');
  });

  it('keeps password setup reachable for the focused authenticated employee', async () => {
    state.pathname = '/auth/employee-first-login';
    auth.profile = null;
    auth.portalSession = { roleKey: 'employee_portal', loginType: 'employee_portal', tenantId: 'tenant-1',
      mustChangePassword: true, accountId: 'employee-1',
    } as NonNullable<AuthContextValue['portalSession']>;
    await render();
    expect(state.router.replace).not.toHaveBeenCalled();
    expect(host.textContent).toBe('Retained auth navigator');
  });
});
