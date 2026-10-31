// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeFirstLoginScreen } from '@/liquid-command/screens/AccessScreens';

const h = vi.hoisted(() => ({
  session: {} as any, complete: vi.fn(), update: vi.fn(), replace: vi.fn(), welcome: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ portalSession: h.session, updatePortalSession: h.update }),
  completeFirstLogin: h.complete, loginBusinessUser: vi.fn(), loginEmployeePortal: vi.fn(), registerBusinessTenant: vi.fn(),
}));
vi.mock('react-native', async () => {
  const react = await import('react');
  const Container = ({ children }: any) => react.createElement('div', null, children);
  const Scroll = react.forwardRef(({ children }: any, ref) => {
    react.useImperativeHandle(ref, () => ({ scrollTo: () => undefined }));
    return react.createElement('div', null, children);
  });
  return { View: Container, Text: Container, KeyboardAvoidingView: Container, ScrollView: Scroll,
    Pressable: Container, Platform: { OS: 'android' }, StyleSheet: { create: (s: any) => s }, BackHandler: { addEventListener: () => ({ remove: vi.fn() }) } };
});
vi.mock('@/lib/supabase/tenantService', () => ({ fetchTenantProfile: vi.fn() }));
vi.mock('@/lib/auth/accountSecurityService', () => ({ readPendingMfaBootstrap: vi.fn() }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock('expo-router', () => ({ Link: () => null, useRouter: () => ({ replace: h.replace }) }));
vi.mock('@/lib/auth/authNavigation', () => ({ resolveBusinessDashboardRoute: () => '/business' }));
vi.mock('@/lib/auth/businessWelcomeSession', () => ({ markBusinessWelcomePending: vi.fn() }));
vi.mock('@/lib/auth/portalWelcomeSession', () => ({ markPortalWelcomePending: h.welcome }));
vi.mock('@/lib/auth/clientPortalAuthService', () => ({ loginClientPortal: vi.fn() }));
vi.mock('@/lib/auth/clientPortalUsernameGenerator', () => ({ sanitizePortalUsernameInput: (s: string) => s }));
vi.mock('@/lib/auth/portalLoginFlow', () => ({ completePortalLogin: vi.fn() }));
vi.mock('@/lib/auth/portalCodeGenerator', () => ({ normalizePortalCodeInput: (s: string) => s }));
vi.mock('@/lib/supabase/authService', () => ({ signOut: vi.fn() }));
vi.mock('@/liquid-command/components/CompanyRegistrationSelect', () => ({ CompanyRegistrationSelect: () => null }));
vi.mock('@/screens/auth/BusinessPasswordRecovery.native', () => ({ NativeBusinessPasswordRecoveryScreen: () => null, NativeBusinessPasswordResetScreen: () => null }));
vi.mock('@/liquid-command/screens/AccessHubScreen', () => ({ AccessHubScreen: () => null }));
vi.mock('@/liquid-command/foundation/useLiquidLayout', () => ({ useLiquidLayout: () => ({ width: 390, isPhone: true }) }));
vi.mock('@/liquid-command/foundation/tokens', () => ({ liquidColors: {}, liquidRadius: {} }));
vi.mock('@/lib/portal/portalResponsiveLayout', () => ({ resolveAccessHeaderLogoWidth: () => 240 }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidBackdrop: ({ children }: any) => <div>{children}</div>, LiquidSurface: ({ children }: any) => <div>{children}</div>,
  LiquidText: ({ children }: any) => <span>{children}</span>, LiquidGlyph: () => null, LiquidLogo: () => null, LiquidStatus: () => null,
  LiquidState: ({ title, message }: any) => <p>{title} {message}</p>,
  LiquidField: ({ label, value, onChangeText }: any) => <input aria-label={label} value={value} onChange={(event) => onChangeText(event.target.value)} />,
  LiquidButton: ({ label, disabled, loading, onPress }: any) => <button disabled={disabled || loading} onClick={onPress}>{label}</button>,
}));

let host: HTMLDivElement, root: Root, unmounted: boolean;
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
async function render() { await act(async () => root.render(<EmployeeFirstLoginScreen />)); }
async function submit() {
  const button = Array.from(host.querySelectorAll('button')).find((node) => node.textContent === 'Passwort speichern und fortfahren');
  expect(button).toBeDefined(); await act(async () => button!.click());
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  h.session = { accountId: 'account-a', tenantId: 'tenant-a', loginType: 'employee_portal', sessionToken: 'session-a' };
  h.complete.mockResolvedValue({ ok: true }); h.update.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); unmounted = false;
});
afterEach(async () => { if (!unmounted) await act(async () => root.unmount()); host.remove(); });

describe('employee first-login lifecycle', () => {
  it('does not complete a new account when the old account request finishes', async () => {
    const pending = deferred(); h.complete.mockReturnValueOnce(pending.promise);
    await render(); await submit();
    h.session = { ...h.session, accountId: 'account-b', sessionToken: 'session-b' }; await render();
    await act(async () => pending.resolve({ ok: true }));
    expect(h.update).not.toHaveBeenCalled(); expect(h.replace).not.toHaveBeenCalled(); expect(h.welcome).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Passwort nicht gespeichert');
    await submit(); expect(h.complete).toHaveBeenCalledTimes(2);
    expect(h.complete).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: 'account-b', sessionToken: 'session-b' }));
    expect(h.update).toHaveBeenCalledWith({ mustChangePassword: false }); expect(h.replace).toHaveBeenCalledWith('/portal/employee');
  });

  it('does not patch, welcome or navigate after unmount while the password request is pending', async () => {
    const pending = deferred(); h.complete.mockReturnValueOnce(pending.promise);
    await render(); await submit(); await act(async () => root.unmount()); unmounted = true;
    await act(async () => pending.resolve({ ok: true }));
    expect(h.update).not.toHaveBeenCalled(); expect(h.replace).not.toHaveBeenCalled(); expect(h.welcome).not.toHaveBeenCalled();
  });

  it('ignores a changed account while the local session update finishes', async () => {
    const update = deferred(); h.update.mockReturnValueOnce(update.promise);
    await render(); await submit(); expect(h.update).toHaveBeenCalledOnce();
    h.session = { ...h.session, accountId: 'account-b', sessionToken: 'session-b' }; await render();
    await act(async () => update.resolve(undefined));
    expect(h.replace).not.toHaveBeenCalled(); expect(h.welcome).not.toHaveBeenCalled();
  });

  it('starts one password request for two presses in the same event batch', async () => {
    const pending = deferred(); h.complete.mockReturnValueOnce(pending.promise);
    await render();
    const button = Array.from(host.querySelectorAll('button')).find((node) => node.textContent === 'Passwort speichern und fortfahren')!;
    await act(async () => { button.click(); button.click(); });
    expect(h.complete).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ ok: true }));
    expect(h.update).toHaveBeenCalledOnce(); expect(h.replace).toHaveBeenCalledOnce();
  });

  it('keeps late old-account failures out of the current account form', async () => {
    const pending = deferred(); h.complete.mockReturnValueOnce(pending.promise);
    await render(); await submit(); h.session = { ...h.session, accountId: 'account-b' }; await render();
    await act(async () => pending.resolve({ ok: false, error: 'Old account rejected' }));
    expect(host.textContent).not.toContain('Old account rejected'); expect(h.update).not.toHaveBeenCalled();
  });

  it('recovers the form after an unexpected password-service rejection', async () => {
    h.complete.mockRejectedValueOnce(new Error('network exception'));
    await render(); await submit();
    expect(host.textContent).toContain('Passwort konnte nicht bestätigt werden');
    expect(host.querySelector('button:last-child')?.hasAttribute('disabled')).toBe(false);
    await submit(); expect(h.complete).toHaveBeenCalledTimes(2); expect(h.replace).toHaveBeenCalledWith('/portal/employee');
  });
});
