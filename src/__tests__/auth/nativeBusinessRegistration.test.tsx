import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessAccessScreen, EmployeeAccessScreen, EmployeeFirstLoginScreen, PortalAccessScreen, RegisterOrganizationScreen } from '@/liquid-command/screens/AccessScreens';
import { BusinessRegisterScreen } from '@/screens/auth/BusinessRegisterScreen';
import { CompanyRegistrationSelect } from '@/liquid-command/components/CompanyRegistrationSelect';
import { FREE_REGISTRATION_PRODUCTS } from '@/lib/auth/businessRegistrationPolicy';

const h = vi.hoisted(() => ({
  values: [] as any[], deps: [] as any[], cursor: 0, effects: [] as (() => unknown)[],
  get: vi.fn(), set: vi.fn(), remove: vi.fn(), register: vi.fn(), replace: vi.fn(),
  businessLogin: vi.fn(), employeeLogin: vi.fn(), clientLogin: vi.fn(), complete: vi.fn(),
  signIn: vi.fn(), portalSignIn: vi.fn(), updateSession: vi.fn(), firstLogin: vi.fn(),
  businessWelcome: vi.fn(), portalWelcome: vi.fn(), back: vi.fn(),
  portalSession: null as any,
}));
vi.mock('react', async original => ({
  ...await original<object>(),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.values)) h.values[index] = typeof initial === 'function' ? initial() : initial;
    return [h.values[index], (value: any) => { h.values[index] = typeof value === 'function' ? value(h.values[index]) : value; }];
  },
  useRef: (initial: any) => { const index = h.cursor++; return h.values[index] ??= { current: initial }; },
  useMemo: (compute: () => any) => compute(),
  useEffect: (effect: () => unknown, deps: any[]) => {
    const index = h.cursor++;
    if (!h.deps[index] || deps.some((value, n) => !Object.is(value, h.deps[index][n]))) h.effects.push(effect);
    h.deps[index] = deps;
  },
}));
vi.mock('react-native', () => ({
  KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Pressable: 'Pressable',
  ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View',
  Platform: { OS: 'android' }, StyleSheet: { create: (value: unknown) => value },
  BackHandler: { addEventListener: (...args: any[]) => { h.back(...args); return { remove: vi.fn() }; } },
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: (...args: any[]) => h.get(...args), setItem: (...args: any[]) => h.set(...args), removeItem: (...args: any[]) => h.remove(...args),
} }));
vi.mock('expo-router', () => ({ Link: 'Link', useRouter: () => ({ replace: h.replace }) }));
vi.mock('expo-linking', () => ({ useURL: () => null }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ signInWithSupabaseSession: h.signIn, signInPortalSession: h.portalSignIn, updatePortalSession: h.updateSession, portalSession: h.portalSession }),
  registerBusinessTenant: (...args: any[]) => h.register(...args),
  loginBusinessUser: (...args: any[]) => h.businessLogin(...args),
  loginEmployeePortal: (...args: any[]) => h.employeeLogin(...args),
  completeFirstLogin: (...args: any[]) => h.firstLogin(...args),
}));
vi.mock('@/lib/auth/authNavigation', () => ({ resolveBusinessDashboardRoute: () => '/business' }));
vi.mock('@/lib/auth/businessWelcomeSession', () => ({ markBusinessWelcomePending: () => h.businessWelcome() }));
vi.mock('@/lib/auth/portalWelcomeSession', () => ({ markPortalWelcomePending: (...args: any[]) => h.portalWelcome(...args) }));
vi.mock('@/lib/auth/clientPortalAuthService', () => ({ loginClientPortal: (...args: any[]) => h.clientLogin(...args) }));
vi.mock('@/lib/auth/clientPortalUsernameGenerator', () => ({ sanitizePortalUsernameInput: (value: string) => value }));
vi.mock('@/lib/auth/portalLoginFlow', () => ({ completePortalLogin: (...args: any[]) => h.complete(...args) }));
vi.mock('@/lib/auth/portalCodeGenerator', () => ({ normalizePortalCodeInput: (value: string) => value }));
vi.mock('@/lib/auth/passwordResetService', () => ({ requestBusinessPasswordReset: vi.fn() }));
vi.mock('@/lib/auth/passwordResetService.native', () => ({ requestBusinessPasswordReset: vi.fn(), completeBusinessPasswordReset: vi.fn() }));
vi.mock('@/lib/supabase/authService', () => ({ getSession: vi.fn(), signOut: vi.fn(), updatePassword: vi.fn() }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidBackdrop: 'Backdrop', LiquidButton: 'Button', LiquidField: 'Field', LiquidGlyph: 'Glyph',
  LiquidLogo: 'Logo', LiquidState: 'State', LiquidStatus: 'Status', LiquidSurface: 'Surface', LiquidText: 'Text',
}));
vi.mock('@/liquid-command/foundation/tokens', () => ({ liquidColors: {}, liquidRadius: {} }));
vi.mock('@/liquid-command/foundation/useLiquidLayout', () => ({ useLiquidLayout: () => ({ width: 390, isPhone: true }) }));
vi.mock('@/lib/portal/portalResponsiveLayout', () => ({ resolveAccessHeaderLogoWidth: () => 240 }));
vi.mock('@/liquid-command/screens/AccessHubScreen', () => ({ AccessHubScreen: 'AccessHub' }));

const draft = {
  companyName: 'Testbetrieb', legalForm: 'UG', industry: 'Alltagsbegleitung',
  street: 'Teststraße 1', zip: '12345', city: 'Berlin', phone: '030123456', email: 'office@example.test',
  adminFirstName: 'Anna', adminLastName: 'Beispiel', adminEmail: 'anna@example.test',
  contactRole: 'Geschäftsführung', selectedModules: ['office'], adminPassword: 'must-never-restore',
};
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
function render(component: () => any = RegisterOrganizationScreen) {
  h.cursor = 0;
  const tree = nodes(component());
  h.effects.splice(0).forEach(effect => effect());
  return tree;
}
async function settle() { for (let n = 0; n < 12; n++) await Promise.resolve(); }
function field(label: string, value: string, component: () => any = RegisterOrganizationScreen) {
  const input = render(component).find(node => node.props.label === label && node.props.onChangeText);
  expect(input, label).toBeDefined();
  input.props.onChangeText(value);
}
function press(label: string, component: () => any = RegisterOrganizationScreen) {
  const action = render(component).find(node => node.props.label === label && node.props.onPress);
  expect(action, label).toBeDefined();
  return action.props.onPress();
}
async function prepareReview() {
  render(); await settle(); render();
  press('Weiter'); press('Weiter'); press('Weiter');
  field('Admin-Passwort', 'SecurePass123!'); field('Passwort bestätigen', 'SecurePass123!');
  render().find(node => node.props.accessibilityRole === 'checkbox').props.onPress();
  press('Weiter');
  await settle();
}
beforeEach(() => {
  vi.clearAllMocks(); h.values = []; h.deps = []; h.effects = []; h.portalSession = null;
  h.get.mockResolvedValue(JSON.stringify(draft)); h.set.mockResolvedValue(undefined); h.remove.mockResolvedValue(undefined);
  h.register.mockResolvedValue({ ok: true, data: { owner: { email: 'saved@example.test' } } });
  h.signIn.mockResolvedValue(undefined); h.portalSignIn.mockResolvedValue(undefined); h.updateSession.mockResolvedValue(undefined);
});

describe('native company registration UI flow', () => {
  it('uses the canonical registration for the legacy screen entry', () => {
    expect(BusinessRegisterScreen).toBe(RegisterOrganizationScreen);
  });
  it('waits for stored data before writing a sanitized draft and never restores passwords', async () => {
    let finish!: (value: string) => void;
    h.get.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    expect(render().some(node => node.props.kind === 'loading')).toBe(true);
    await settle(); expect(h.set).not.toHaveBeenCalled();
    finish(JSON.stringify(draft)); await settle(); render(); await settle();
    expect(render().find(node => node.props.label === 'Firmenname').props.value).toBe('Testbetrieb');
    const saved = JSON.parse(h.set.mock.calls.at(-1)![1]);
    expect(saved).not.toHaveProperty('adminPassword');
    expect(saved.selectedModules).toEqual(FREE_REGISTRATION_PRODUCTS);
    press('Weiter'); press('Weiter'); press('Weiter');
    expect(render().find(node => node.props.label === 'Admin-Passwort').props.value).toBe('');
  });
  it('shows five steps without module choices and submits accepted terms once until the backend confirms', async () => {
    let finish!: (value: any) => void;
    h.register.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await prepareReview();
    const review = render();
    expect(review[0].props.eyebrow).toContain('SCHRITT 5 VON 5');
    expect(review.some(node => node.props.children === 'Module')).toBe(false);
    const submit = review.find(node => node.props.label === 'Unternehmen kostenlos registrieren').props.onPress;
    const pending = submit(); await submit();
    expect(h.register).toHaveBeenCalledTimes(1);
    expect(h.register).toHaveBeenCalledWith(expect.objectContaining({ termsAccepted: true, selectedModules: FREE_REGISTRATION_PRODUCTS, adminPassword: 'SecurePass123!' }));
    expect(render().some(node => node.props.kind === 'success')).toBe(false);
    expect(h.back.mock.calls.at(-1)![1]()).toBe(true);
    finish({ ok: true, data: { owner: { email: 'saved@example.test' } } }); await pending; await settle();
    expect(render().find(node => node.props.kind === 'success').props.message).toContain('saved@example.test');
    expect(h.remove).toHaveBeenCalled(); expect(h.replace).not.toHaveBeenCalled();
    await submit(); expect(h.register).toHaveBeenCalledTimes(1);
    press('Zur Anmeldung'); expect(h.replace).toHaveBeenCalledWith('/auth/business-login');
  });
  it('preserves entries after a backend error and validates edited previous steps', async () => {
    await prepareReview();
    press('Zurück'); press('Zurück'); press('Zurück'); press('Zurück');
    field('Firmenname', '');
    expect(render()[0].props.eyebrow).toContain('SCHRITT 1 VON 5');
    press('Weiter'); expect(h.register).not.toHaveBeenCalled();
    expect(render().some(node => node.props.message?.includes('Firmenname'))).toBe(true);
    field('Firmenname', 'Testbetrieb');
    press('Weiter'); press('Weiter'); press('Weiter'); press('Weiter');
    h.register.mockResolvedValue({ ok: false, error: 'Backend nicht erreichbar' });
    await press('Unternehmen kostenlos registrieren');
    expect(render().some(node => node.props.message === 'Backend nicht erreichbar')).toBe(true);
    expect(render().some(node => node.props.kind === 'success')).toBe(false);
    press('Zurück');
    expect(render().find(node => node.props.label === 'Admin-Passwort').props.value).toBe('SecurePass123!');
    expect(h.remove).not.toHaveBeenCalled();
  });
  it('validates all registration fields again on the final submission', async () => {
    render(); await settle();
    const companyInput = render().find(node => node.props.label === 'Firmenname');
    press('Weiter'); press('Weiter'); press('Weiter');
    field('Admin-Passwort', 'SecurePass123!'); field('Passwort bestätigen', 'SecurePass123!');
    render().find(node => node.props.accessibilityRole === 'checkbox').props.onPress();
    press('Weiter');
    companyInput.props.onChangeText('');
    await press('Unternehmen kostenlos registrieren'); await settle();
    expect(h.register).not.toHaveBeenCalled();
    expect(render().some(node => node.props.message?.includes('vollständig'))).toBe(true);
  });
  it('does not skip a step when Weiter receives rapid repeated presses', async () => {
    render(); await settle();
    const next = render().find(node => node.props.label === 'Weiter').props.onPress;
    next(); next();
    expect(render()[0].props.eyebrow).toContain('SCHRITT 2 VON 5');
  });
  it('offers canonical native choices and requires details for Sonstige', () => {
    const changed = vi.fn();
    const picker = () => CompanyRegistrationSelect({ kind: 'legal_form', label: 'Rechtsform', value: 'Sonstige: ', onChange: changed, showError: true });
    expect(render(picker).some(node => node.props.accessibilityRole === 'alert')).toBe(true);
    render(picker).find(node => node.props.accessibilityLabel === 'Andere Rechtsform angeben').props.onChangeText('Spezialform');
    expect(changed).toHaveBeenCalledWith('Sonstige: Spezialform');
    render(picker).find(node => node.type === 'Pressable' && node.props.accessibilityLabel?.startsWith('Rechtsform:')).props.onPress();
    const option = render(picker).find(node => node.type === 'Pressable' && nodes(node).some(child => child.props.children === 'UG (haftungsbeschränkt)'));
    expect(option).toBeDefined();
    option.props.onPress();
    expect(changed).toHaveBeenLastCalledWith('UG (haftungsbeschränkt)');
  });
});

describe('native login destination and welcome markers', () => {
  it('opens the native business dashboard only after the secure session is accepted', async () => {
    h.businessLogin.mockResolvedValue({ ok: true, data: { supabaseSession: { access_token: 'test-token' } } });
    field('E-Mail', 'anna@example.test', BusinessAccessScreen); field('Passwort', '  keep-spaces  ', BusinessAccessScreen);
    await press('Anmelden', BusinessAccessScreen); await settle();
    expect(h.businessLogin).toHaveBeenCalledWith('anna@example.test', '  keep-spaces  ');
    expect(h.signIn).toHaveBeenCalled(); expect(h.businessWelcome).toHaveBeenCalledOnce();
    expect(h.replace).toHaveBeenCalledWith('/business');
  });  it('marks employee welcome after a completed portal login, except for a required password change', async () => {
    const session = { loginType: 'employee_portal', mustChangePassword: false };
    h.employeeLogin.mockResolvedValue({ ok: true, data: { portalSession: session, mustChangePassword: false } });
    h.complete.mockResolvedValue({ ok: true, data: { portalSession: session } });
    field('Benutzername', 'anna', EmployeeAccessScreen); field('Passwort oder Einmalpasswort', 'test-password', EmployeeAccessScreen);
    await press('Mitarbeitenden-App öffnen', EmployeeAccessScreen); await settle();
    expect(h.portalWelcome).toHaveBeenCalledWith('employee');
    expect(h.replace).toHaveBeenCalledWith('/portal/employee');
    h.portalWelcome.mockClear();
    const firstSession = { ...session, mustChangePassword: true };
    h.employeeLogin.mockResolvedValue({ ok: true, data: { portalSession: firstSession, mustChangePassword: true } });
    h.complete.mockResolvedValue({ ok: true, data: { portalSession: firstSession } });
    await press('Mitarbeitenden-App öffnen', EmployeeAccessScreen); await settle();
    expect(h.portalWelcome).not.toHaveBeenCalled();
    expect(h.replace).toHaveBeenLastCalledWith('/auth/employee-first-login');
  });
  it('marks client welcome only after successful secure portal setup', async () => {
    const session = { loginType: 'client_portal' };
    h.clientLogin.mockResolvedValue({ ok: true, data: { portalSession: session } });
    h.complete.mockResolvedValue({ ok: false, error: 'Session konnte nicht eingerichtet werden' });
    const client = () => PortalAccessScreen({ portal: 'client' });
    field('Benutzername', 'client', client); field('Portal-Code', 'ABCDEF', client);
    await press('Portal sicher öffnen', client); await settle();
    expect(h.portalWelcome).not.toHaveBeenCalled(); expect(h.replace).not.toHaveBeenCalled();
    h.complete.mockResolvedValue({ ok: true, data: { portalSession: session } });
    await press('Portal sicher öffnen', client); await settle();
    expect(h.portalWelcome).toHaveBeenCalledWith('client');
    expect(h.replace).toHaveBeenCalledWith('/portal/client');
  });
  it('marks employee welcome after the first password has been saved in the session', async () => {
    h.portalSession = { loginType: 'employee_portal', accountId: 'employee', sessionToken: 'test-session' };
    h.firstLogin.mockResolvedValue({ ok: true });
    field('Aktuelles Einmalpasswort', 'temporary', EmployeeFirstLoginScreen);
    field('Neues Passwort', 'SecurePass123!', EmployeeFirstLoginScreen);
    field('Passwort bestätigen', 'SecurePass123!', EmployeeFirstLoginScreen);
    await press('Passwort speichern und fortfahren', EmployeeFirstLoginScreen); await settle();
    expect(h.updateSession).toHaveBeenCalledWith({ mustChangePassword: false });
    expect(h.portalWelcome).toHaveBeenCalledWith('employee');
    expect(h.replace).toHaveBeenCalledWith('/portal/employee');
  });

});
