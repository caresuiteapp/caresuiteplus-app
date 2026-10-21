// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalAccessScreen } from '@/liquid-command/screens/AccessScreens.web';

const api = vi.hoisted(() => ({ login: vi.fn(), complete: vi.fn(), signIn: vi.fn(), replace: vi.fn(), returnPath: vi.fn() }));
vi.mock('react-native', async () => {
  const React = await import('react');
  const box = ({ children }: { children: ReactNode }) => React.createElement('div', {}, children);
  return { Platform: { OS: 'web' }, StyleSheet: { create: (s: unknown) => s }, View: box, Text: box, ScrollView: box, KeyboardAvoidingView: box, Pressable: box };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: api.replace }), Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ signInPortalSession: api.signIn }), registerBusinessTenant: vi.fn(), completeFirstLogin: vi.fn(), loginBusinessUser: vi.fn(), loginEmployeePortal: vi.fn() }));
vi.mock('@/lib/auth/clientPortalAuthService', () => ({ loginClientPortal: api.login }));
vi.mock('@/lib/auth/clientPortalUsernameGenerator', () => ({ sanitizePortalUsernameInput: (v: string) => v }));
vi.mock('@/lib/auth/portalLoginFlow', () => ({ completePortalLogin: api.complete }));
vi.mock('@/lib/auth/portalCodeGenerator', () => ({ normalizePortalCodeInput: (v: string) => v }));
vi.mock('@/lib/auth/tvDeviceLoginReturn.web', () => ({ resolveTvLoginReturn: api.returnPath }));
vi.mock('@/lib/auth/passwordResetService.web', () => ({ requestBusinessPasswordReset: vi.fn(), completeBusinessPasswordReset: vi.fn(), readBusinessRecoveryToken: vi.fn() }));
vi.mock('@/lib/supabase/authService', () => ({ signOut: vi.fn() }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: vi.fn() }));
vi.mock('@/liquid-command/screens/AccessHubScreen', () => ({ AccessHubScreen: () => null }));
vi.mock('@/liquid-command/components/CompanyRegistrationSelect.web', () => ({ CompanyRegistrationSelect: () => null }));
vi.mock('@/liquid-command/foundation/useLiquidLayout', () => ({ useLiquidLayout: () => ({ width: 1440, isPhone: false }) }));
vi.mock('@/liquid-command/foundation/tokens', () => ({ liquidColors: {}, liquidRadius: {} }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { LiquidBackdrop: Box, LiquidSurface: Box, LiquidText: Box, LiquidLogo: () => null, LiquidGlyph: () => null,
    LiquidStatus: () => null, LiquidState: ({ message }: { message: string }) => <div>{message}</div>,
    LiquidButton: ({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) => <button disabled={loading} onClick={onPress}>{label}</button>,
    LiquidField: ({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) => <input aria-label={label} value={value} onInput={event => onChangeText(event.currentTarget.value)} /> };
});

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); api.signIn.mockResolvedValue(undefined); api.returnPath.mockReturnValue('/portal/client/documents');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function submit(portalType: 'client' | 'academy_family') {
  const portalSession = { portalType, accountId: 'test-account', tenantId: 'test-tenant' };
  api.login.mockResolvedValue({ ok: true, data: { portalSession } });
  api.complete.mockResolvedValue({ ok: true, data: { portalSession } });
  await act(async () => root.render(<PortalAccessScreen portal="client" />));
  for (const [label, value] of [['Benutzername', 'test.kontakt'], ['Portal-Code', 'ABCDEF']]) {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    await act(async () => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Portal sicher öffnen')!.click());
  return portalSession;
}

describe('real web client login entry', () => {
  it('takes a confirmed family login directly to personal learning without a saved client or TV return', async () => {
    const session = await submit('academy_family');
    expect(api.signIn).toHaveBeenCalledWith(session);
    expect(api.replace).toHaveBeenCalledWith('/portal/client/akademie');
    expect(api.returnPath).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Angehörige lernen mit ihrem persönlichen Akademiezugang');
  });
  it('preserves the existing return behavior for ordinary client accounts', async () => {
    await submit('client');
    expect(api.returnPath).toHaveBeenCalledWith('/portal/client');
    expect(api.replace).toHaveBeenCalledWith('/portal/client/documents');
  });
});
