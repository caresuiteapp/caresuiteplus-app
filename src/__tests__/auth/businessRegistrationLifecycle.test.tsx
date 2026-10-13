// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterScreen } from '@/screens/onboarding/RegisterScreen';
import { CompanySetupScreen } from '@/screens/onboarding/CompanySetupScreen';
import { BusinessAccessScreen, RegisterOrganizationScreen } from '@/liquid-command/screens/AccessScreens';

const h = vi.hoisted(() => ({
  user: null as any, session: null as any, complete: vi.fn(), update: vi.fn(), replace: vi.fn(), welcome: vi.fn(), register: vi.fn(), get: vi.fn(), set: vi.fn(), remove: vi.fn(), login: vi.fn(), signIn: vi.fn(), scroll: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: h.user, portalSession: h.session, updatePortalSession: h.update, signInWithSupabaseSession: h.signIn }),
  completeFirstLogin: h.complete, loginBusinessUser: h.login, loginEmployeePortal: vi.fn(), registerBusinessTenant: h.register,
}));
vi.mock('react-native', async () => {
  const react = await import('react');
  const Container = ({ children }: any) => react.createElement('div', null, children);
  const Scroll = react.forwardRef(({ children }: any, ref) => {
    react.useImperativeHandle(ref, () => ({ scrollTo: h.scroll }));
    return react.createElement('div', null, children);
  });
  return { View: Container, Text: Container, KeyboardAvoidingView: Container, ScrollView: Scroll,
    Pressable: ({ children, onPress, accessibilityRole, disabled }: any) => react.createElement('button', { onClick: onPress, role: accessibilityRole, disabled }, children), Platform: { OS: 'android' }, StyleSheet: { create: (s: any) => s }, BackHandler: { addEventListener: () => ({ remove: vi.fn() }) } };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: h.get, setItem: h.set, removeItem: h.remove } }));
vi.mock('expo-router', async () => { const {useEffect} = await import('react'); return { Link: () => null, useRouter: () => ({ replace: h.replace }), Redirect: ({href}: any) => {useEffect(() => {h.replace(href);}, [href]); return null;} }; });
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
const saved = { companyName: 'Testbetrieb', legalForm: 'UG', industry: 'Alltagsbegleitung', street: 'Weg 1', zip: '12345', city: 'Berlin', phone: '12345', email: 'office@example.test', adminFirstName: 'Anna', adminLastName: 'Test', adminEmail: 'anna@example.test', contactRole: 'Geschäftsführung' };
const confirmed = { ok: true, data: { tenantId: 'tenant-new', owner: { email: 'anna@example.test' } } };
function deferred() { let resolve!: (value: any) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function render() { await act(async () => root.render(<RegisterOrganizationScreen />)); }
async function click(label: string) { const button = Array.from(host.querySelectorAll('button')).find(n => n.textContent === label); expect(button, label).toBeDefined(); await act(async () => button!.click()); }
async function review() {
  await render(); await click('Weiter'); await click('Weiter'); await click('Weiter');
  const set = (label: string) => { const field = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'SecurePass123!'); field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); };
  await act(async () => { set('Admin-Passwort'); set('Passwort bestätigen'); });
  await act(async () => host.querySelector<HTMLButtonElement>('[role=checkbox]')!.click()); await click('Weiter');
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); h.user = null; h.session = null;
  h.get.mockResolvedValue(JSON.stringify(saved)); h.set.mockResolvedValue(undefined); h.remove.mockResolvedValue(undefined); h.register.mockResolvedValue(confirmed); h.signIn.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); unmounted = false;
});
afterEach(async () => { if (!unmounted) await act(async () => root.unmount()); host.remove(); });
describe('business registration mounted lifecycle', () => {
  it('commits backend success once after a duplicate click, clears only the safe draft and offers separate login', async () => {
    const pending = deferred(); h.register.mockReturnValue(pending.promise); await review();
    const button = Array.from(host.querySelectorAll('button')).find(n => n.textContent === 'Unternehmen kostenlos registrieren')!;
    await act(async () => { button.click(); button.click(); }); expect(h.register).toHaveBeenCalledOnce(); expect(h.register).toHaveBeenCalledWith(expect.objectContaining({ termsAccepted: true }));
    await act(async () => pending.resolve(confirmed)); expect(host.textContent).toContain('Registrierung erfolgreich'); expect(h.remove).toHaveBeenCalledOnce(); expect(h.replace).not.toHaveBeenCalled();
    await click('Zur Anmeldung'); expect(h.replace).toHaveBeenCalledWith('/auth/business-login');
  });
  it('does not erase a reentered form draft after unmount during registration', async () => {
    const pending = deferred(); h.register.mockReturnValue(pending.promise); await review(); await click('Unternehmen kostenlos registrieren');
    await act(async () => root.unmount()); unmounted = true; h.remove.mockClear(); await act(async () => pending.resolve(confirmed)); expect(h.remove).not.toHaveBeenCalled();
  });
  it('does not publish the old registration success after a different session becomes active', async () => {
    const pending = deferred(); h.register.mockReturnValue(pending.promise); await review(); await click('Unternehmen kostenlos registrieren');
    h.user = { id: 'other-auth-user' }; await render(); await act(async () => pending.resolve(confirmed)); expect(host.textContent).not.toContain('Registrierung erfolgreich'); expect(h.remove).not.toHaveBeenCalled();
  });
  it('allows a retry after a confirmed failed request without deleting entries', async () => {
    h.register.mockResolvedValueOnce({ ok: false, error: 'Bitte später versuchen.' }); await review(); await click('Unternehmen kostenlos registrieren'); expect(host.textContent).toContain('Bitte später versuchen.'); expect(h.remove).not.toHaveBeenCalled();
    await click('Unternehmen kostenlos registrieren'); expect(h.register).toHaveBeenCalledTimes(2); expect(host.textContent).toContain('Registrierung erfolgreich');
  });
  it('keeps a confirmed registration successful even when local draft cleanup fails',async()=>{
    h.remove.mockRejectedValue(new Error('Local storage unavailable'));await review();await click('Unternehmen kostenlos registrieren');expect(host.textContent).toContain('Registrierung erfolgreich');expect(host.textContent).not.toContain('Local storage unavailable');await click('Zur Anmeldung');expect(h.replace).toHaveBeenCalledWith('/auth/business-login');
  });
  it('brings repeated submission errors into view at the form start on the same step',async()=>{
    await review();h.register.mockResolvedValue({ok:false,error:'Einrichtung nicht bestätigt.'});h.scroll.mockClear();await click('Unternehmen kostenlos registrieren');expect(h.scroll).toHaveBeenCalledWith({y:0,animated:false});h.scroll.mockClear();await click('Unternehmen kostenlos registrieren');expect(h.scroll).toHaveBeenCalledWith({y:0,animated:false});
  });
});

it('routes legacy company setup to the canonical server registration and shares its legacy screen export', async () => {
  expect(RegisterScreen).toBe(RegisterOrganizationScreen); await act(async () => root.render(<CompanySetupScreen />)); expect(h.replace).toHaveBeenCalledWith('/auth/register-business');
});
async function loginForm() {
  await act(async () => root.render(<BusinessAccessScreen />));
  await act(async () => { for (const [label,value] of [['E-Mail','anna@example.test'],['Passwort','Password123!']]) { const input=host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); } });
}
describe('first business login after registration lifecycle', () => {
  const session={access_token:'test-only-token',user:{id:'auth-new'}};
  it('accepts one secure first login after rapid repeated presses', async () => {
    const pending=deferred();h.login.mockReturnValue(pending.promise); await loginForm();const button=Array.from(host.querySelectorAll('button')).find(n=>n.textContent==='Anmelden')!;
    await act(async()=>{button.click();button.click();});expect(h.login).toHaveBeenCalledOnce();await act(async()=>pending.resolve({ok:true,data:{supabaseSession:session}}));expect(h.signIn).toHaveBeenCalledOnce();expect(h.replace).toHaveBeenCalledWith('/business');
  });
  it('does not accept a late login after the screen has unmounted',async()=>{
    const pending=deferred();h.login.mockReturnValue(pending.promise);await loginForm();await click('Anmelden');await act(async()=>root.unmount());unmounted=true;await act(async()=>pending.resolve({ok:true,data:{supabaseSession:session}}));expect(h.signIn).not.toHaveBeenCalled();expect(h.replace).not.toHaveBeenCalled();
  });
  it('does not replace a different authenticated account when the old login resolves',async()=>{
    const pending=deferred();h.login.mockReturnValue(pending.promise);await loginForm();await click('Anmelden');h.user={id:'auth-other'};await act(async()=>root.render(<BusinessAccessScreen/>));await act(async()=>pending.resolve({ok:true,data:{supabaseSession:session}}));expect(h.signIn).not.toHaveBeenCalled();expect(h.replace).not.toHaveBeenCalled();
  });
  it('allows its own accepted identity while session hydration finishes',async()=>{
    const accept=deferred();h.login.mockResolvedValue({ok:true,data:{supabaseSession:session}});h.signIn.mockReturnValue(accept.promise);await loginForm();await click('Anmelden');h.user={id:'auth-new'};await act(async()=>root.render(<BusinessAccessScreen/>));await act(async()=>accept.resolve(undefined));expect(h.replace).toHaveBeenCalledWith('/business');
  });
  it('does not welcome or navigate a different identity during secure-session hydration',async()=>{
    const accept=deferred();h.login.mockResolvedValue({ok:true,data:{supabaseSession:session}});h.signIn.mockReturnValue(accept.promise);await loginForm();await click('Anmelden');h.user={id:'auth-other'};await act(async()=>root.render(<BusinessAccessScreen/>));await act(async()=>accept.resolve(undefined));expect(h.replace).not.toHaveBeenCalled();
  });
});
