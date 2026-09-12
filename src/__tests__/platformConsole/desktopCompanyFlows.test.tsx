// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ register: vi.fn(), draft: vi.fn(), saveDraft: vi.fn(), removeDraft: vi.fn(), detail: vi.fn(), list: vi.fn(), status: vi.fn(), record: vi.fn(), push: vi.fn(), tenantId: 'a' }));
vi.mock('react-native', async () => {
  const React = await import('react');
  const element = (tag: string) => (p: any) => React.createElement(tag, { onClick: p.onPress, disabled: p.disabled, role: p.accessibilityRole, 'aria-label': p.accessibilityLabel }, p.children);
  return { useWindowDimensions: () => ({ width: 1440, height: 900, scale: 1, fontScale: 1 }), Platform: { OS: 'web' }, StyleSheet: { create: (s: any) => s }, View: element('div'), Text: element('span'), ScrollView: element('div'), KeyboardAvoidingView: element('div'), Pressable: element('button'), TextInput: (p: any) => React.createElement('input', { value: p.value, 'aria-label': p.accessibilityLabel, onInput: (e: any) => p.onChangeText(e.currentTarget.value) }) };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ push: api.push, replace: api.push }), useNavigation: () => ({ dispatch: api.push }), useLocalSearchParams: () => ({ tenantId: api.tenantId }), Link: ({ children }: any) => <a>{children}</a> }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: vi.fn() }));
vi.mock('@/components/platformConsole/PlatformConfirmModal.web', () => ({ PlatformConfirmModal: ({ visible, onConfirm, onCancel, loading }: any) => visible ? <div><button disabled={loading} onClick={() => onConfirm('Grund zum Testen')}>Bestätigen</button><button onClick={onCancel}>Abbrechen</button></div> : null }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: api.draft, setItem: api.saveDraft, removeItem: api.removeDraft } }));
vi.mock('@/lib/auth', () => ({ registerBusinessTenant: api.register, useAuth: vi.fn(), completeFirstLogin: vi.fn(), loginBusinessUser: vi.fn(), loginEmployeePortal: vi.fn() }));
vi.mock('@/lib/auth/clientPortalAuthService', () => ({ loginClientPortal: vi.fn() }));
vi.mock('@/lib/auth/clientPortalUsernameGenerator', () => ({ sanitizePortalUsernameInput: vi.fn() }));
vi.mock('@/lib/auth/portalLoginFlow', () => ({ completePortalLogin: vi.fn() }));
vi.mock('@/lib/auth/portalCodeGenerator', () => ({ normalizePortalCodeInput: vi.fn() }));
vi.mock('@/lib/auth/passwordResetService', () => ({ requestBusinessPasswordReset: vi.fn() }));
vi.mock('@/lib/supabase/authService', () => ({ getSession: vi.fn(), signOut: vi.fn(), updatePassword: vi.fn() }));
vi.mock('@/liquid-command/screens/AccessHubScreen', () => ({ AccessHubScreen: () => null }));
vi.mock('@/liquid-command/foundation/useLiquidLayout', () => ({ useLiquidLayout: () => ({ width: 1440, isDesktop: true }) }));
vi.mock('@/liquid-command/foundation/tokens', () => ({ liquidColors: {}, liquidRadius: {} }));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => {
  const Box = ({ children }: any) => <div>{children}</div>;
  return { LiquidBackdrop: Box, LiquidSurface: Box, LiquidText: Box, LiquidLogo: () => null, LiquidGlyph: () => null,
    LiquidStatus: ({ label }: any) => <span>{label}</span>, LiquidState: ({ title, message }: any) => <div>{title}{message}</div>,
    LiquidButton: ({ label, onPress, loading, disabled }: any) => <button disabled={loading || disabled} onClick={onPress}>{label}</button>,
    LiquidField: ({ label, value, onChangeText }: any) => <input aria-label={label} value={value} onInput={(e) => onChangeText(e.currentTarget.value)} /> };
});
vi.mock('@/theme', () => ({ spacing: {} }));
vi.mock('@/components/platformConsole/PlatformShellLayout.web', () => ({ PlatformShellLayout: ({ children, title }: any) => <div>{title}{children}</div> }));
vi.mock('@/components/ui', () => ({ LoadingState: ({ message }: any) => <div>{message}</div>, ErrorState: ({ message, onRetry }: any) => <div>{message}<button onClick={onRetry}>Erneut laden</button></div> }));
vi.mock('@/lib/platformConsole/PlatformAuthProvider', () => ({ usePlatformAuth: () => ({ platformUser: { role: 'admin' } }) }));
vi.mock('@/lib/platformConsole/platformCompanyDirectoryService', () => ({ listPlatformCompanies: api.list }));
vi.mock('@/lib/platformConsole', () => ({ getPlatformTenantDetail: api.detail, platformRoleHasCapability: () => true, updatePlatformTenantStatus: api.status, updatePlatformTenantRecord: api.record, resolvePlatformTenantDetailId: (row: any) => row.id }));
vi.mock('@/components/platformConsole', () => ({
  PLATFORM_COLORS: {}, PlatformAuditLink: () => <span>Audit-Verweis</span>, PlatformFormField: ({ label, children }: any) => <label>{label}{children}</label>,
  PlatformStatusBadge: ({ status }: any) => <span>{status}</span>, PlatformTenantEnvironmentBadge: ({ mode }: any) => <span>{mode}</span>,
  PlatformConfirmModal: ({ visible, onConfirm, onCancel, loading }: any) => visible ? <div><button disabled={loading} onClick={() => onConfirm('Grund zum Testen')}>Bestätigen</button><button onClick={onCancel}>Abbrechen</button></div> : null,
  PlatformFilterChipRow: ({ children }: any) => <div>{children}</div>, PlatformFilterChip: ({ label, onPress }: any) => <button onClick={onPress}>{label}</button>,
  PlatformDataTable: ({ data }: any) => <div>{data.map((row: any) => <span key={row.id}>{row.tenantName}</span>)}</div>,
}));
vi.mock('@/screens/platformConsole/PlatformTenantOperatorTabs', () => Object.fromEntries(['Audit', 'BillingPreview', 'Credits', 'Diagnosis', 'Discounts', 'Entitlements', 'FeatureFlags', 'Invoices', 'Limits', 'Payments', 'Subscription', 'Support', 'Users'].map(name => [`Tenant${name}Tab`, () => null])));
import { RegisterOrganizationScreen } from '@/liquid-command/screens/AccessScreens.web';
import { PlatformTenantDetailScreen } from '@/screens/platformConsole/PlatformTenantDetailScreen.web';
import { PlatformTenantsScreen } from '@/screens/platformConsole/PlatformTenantsScreen.web';
const draft = { companyName: 'Musterpflege', legalForm: 'GmbH', industry: 'Pflege', street: 'Testweg 1', zip: '10115', city: 'Berlin', phone: '030123456', email: 'kontakt@example.test', adminFirstName: 'Anna', adminLastName: 'Test', adminEmail: 'anna@example.test', adminPassword: 'NeverRestoreThis', selectedModules: ['office'] };
const detail = (id: string, mode = 'production') => ({ ok: true, data: { tenant: { tenant_id: id, tenant_name: `Unternehmen ${id}`, environment_mode: mode, environment_notes: 'Einordnung vorhanden' }, modules: [], plan: null } });
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
let host: HTMLDivElement; let root: Root;
const button = (text: string) => [...host.querySelectorAll('button')].find(b => b.textContent === text)!;
const input = (label: string) => host.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
const render = async (node: React.ReactNode) => { await act(async () => { root.render(node); }); };
const click = async (text: string) => { await act(async () => { button(text).click(); }); };
const write = async (label: string, value: string) => { await act(async () => { input(label).value = value; input(label).dispatchEvent(new Event('input', { bubbles: true })); }); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); api.register.mockReset(); api.tenantId = 'a'; api.draft.mockResolvedValue(JSON.stringify(draft)); api.saveDraft.mockResolvedValue(undefined); api.removeDraft.mockResolvedValue(undefined);
  api.detail.mockImplementation(async (id: string) => detail(id)); api.list.mockResolvedValue({ ok: true, data: { items: [] } }); api.status.mockResolvedValue({ ok: true, data: {} });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
describe('free web registration', () => {
  it('waits for the stored draft before accepting edits', async () => {
    const pending = deferred(); api.draft.mockReturnValue(pending.promise);
    await render(<RegisterOrganizationScreen />); expect(input('Firmenname')).toBeNull();
    await act(async () => pending.resolve(JSON.stringify(draft)));
    expect(input('Firmenname').value).toBe('Musterpflege');
    await write('Firmenname', 'Neu'); expect(input('Firmenname').value).toBe('Neu');
  });
  it('keeps malformed email input on its own step', async () => {
    await render(<RegisterOrganizationScreen />); await click('Weiter'); await write('Organisations-E-Mail', 'ungueltig'); await click('Weiter');
    expect(host.textContent).toContain('gültige E-Mail-Adresse'); expect(input('Organisations-E-Mail')).not.toBeNull(); expect(input('Admin E-Mail')).toBeNull();
  });
  it('locks previous steps during submission, clears passwords and grants all included products', async () => {
    const pending = deferred(); api.register.mockReturnValue(pending.promise);
    await render(<RegisterOrganizationScreen />); await click('Weiter'); await click('Weiter'); await click('Weiter');
    expect(input('Admin-Passwort').value).toBe('');
    await write('Admin-Passwort', 'Testpasswort123'); await write('Passwort bestätigen', 'Testpasswort123');
    await act(async () => (host.querySelector('[role="checkbox"]') as HTMLButtonElement).click()); await click('Weiter');
    await click('Unternehmen kostenlos registrieren');
    expect([...host.querySelectorAll('button')].filter(b => b.textContent?.includes('Stammdaten und Leistungsbereich')).every(b => b.disabled)).toBe(true);
    expect([...host.querySelectorAll('button')].filter(b => b.textContent === 'Zurück').every(b => b.disabled)).toBe(true);
    await click('Zurück'); expect(api.push).not.toHaveBeenCalled();
    await click('Unternehmen kostenlos registrieren'); expect(api.register).toHaveBeenCalledTimes(1);
    expect(api.register.mock.calls[0][0].selectedModules).toHaveLength(6);
    expect(api.saveDraft.mock.calls.every(([, value]) => JSON.parse(value).adminPassword === '')).toBe(true);
    await act(async () => pending.resolve({ ok: true, data: { owner: { email: draft.adminEmail } } }));
    expect(host.textContent).toContain('Registrierung erfolgreich'); expect(api.removeDraft).toHaveBeenCalled();
  });
  it.each(['response', 'exception'])('preserves a failed %s and clears the draft only after a successful retry', async failure => {
    if (failure === 'exception') api.register.mockRejectedValueOnce(new Error('Verbindung unterbrochen'));
    else api.register.mockResolvedValueOnce({ ok: false, error: 'Verbindung unterbrochen' });
    await render(<RegisterOrganizationScreen />); await click('Weiter'); await click('Weiter'); await click('Weiter');
    await write('Admin-Passwort', 'Testpasswort123'); await write('Passwort bestätigen', 'Testpasswort123');
    await act(async () => (host.querySelector('[role="checkbox"]') as HTMLButtonElement).click()); await click('Weiter');
    await click('Unternehmen kostenlos registrieren');
    expect(host.textContent).toContain('Verbindung unterbrochen');
    expect(host.textContent).toContain('Registrierung nicht abgeschlossen');
    expect(button('Unternehmen kostenlos registrieren').disabled).toBe(false);
    expect(api.removeDraft).not.toHaveBeenCalled();
    const stored = JSON.parse(api.saveDraft.mock.calls.at(-1)![1]);
    expect(stored).toMatchObject({ companyName: draft.companyName, adminEmail: draft.adminEmail, adminPassword: '' });
    const stepBack = [...host.querySelectorAll('button')].filter(b => b.textContent === 'Zurück').at(-1)!;
    await act(async () => stepBack.click());
    expect(input('Admin-Passwort').value).toBe('Testpasswort123');
    expect(input('Passwort bestätigen').value).toBe('Testpasswort123');
    await click('Weiter');
    api.register.mockResolvedValueOnce({ ok: true, data: { owner: { email: draft.adminEmail } } });
    await click('Unternehmen kostenlos registrieren');
    expect(host.textContent).toContain('Registrierung erfolgreich');
    expect(api.removeDraft).toHaveBeenCalledTimes(1);
    const removedAt = api.removeDraft.mock.invocationCallOrder[0];
    expect(api.saveDraft.mock.invocationCallOrder.every(order => order < removedAt)).toBe(true);
    await click('Zur Anmeldung'); expect(api.push).toHaveBeenLastCalledWith('/auth/business-login');
  });
});
describe('company management failures', () => {
  it('ignores a late result for the previous company', async () => {
    const a = deferred(); const b = deferred(); api.detail.mockImplementation((id: string) => id === 'a' ? a.promise : b.promise);
    await render(<PlatformTenantDetailScreen />); api.tenantId = 'b'; await render(<PlatformTenantDetailScreen />);
    await act(async () => b.resolve(detail('b'))); await act(async () => a.resolve(detail('a')));
    expect(host.textContent).toContain('Unternehmen b'); expect(host.textContent).not.toContain('Unternehmen a');
    await click('Zugriff & Support'); await click('Support'); await click('Support-Zentrale öffnen');
    expect(api.push).toHaveBeenCalledWith({ pathname: '/platform/support', params: { company: 'Unternehmen b' } });
  });
  it('does not report a rejected suspension as audited success', async () => {
    api.status.mockResolvedValue({ ok: false, error: 'Zugriff verweigert' });
    await render(<PlatformTenantDetailScreen />); await click('Sperren'); await click('Bestätigen');
    expect(host.textContent).toContain('Zugriff verweigert'); expect(host.textContent).not.toContain('Aktion protokolliert'); expect(host.textContent).toContain('Unternehmen a');
  });
  it('requires explicit classification of an unclassified company', async () => {
    api.detail.mockResolvedValue(detail('a', 'unclassified')); await render(<PlatformTenantDetailScreen />); await click('Stammdaten bearbeiten');
    expect(button('Mandantenakte speichern').disabled).toBe(true); await click('Interner Test'); expect(button('Mandantenakte speichern').disabled).toBe(false);
  });
  it('shows missing IDs and thrown loading failures instead of a perpetual spinner', async () => {
    api.tenantId = ''; await render(<PlatformTenantDetailScreen />); expect(host.textContent).toContain('Unternehmens-ID fehlt'); expect(api.detail).not.toHaveBeenCalled();
    api.tenantId = 'a'; api.detail.mockRejectedValue(new Error('Verbindung unterbrochen')); await render(<PlatformTenantDetailScreen />); expect(host.textContent).toContain('Verbindung unterbrochen');
    api.detail.mockResolvedValue(detail('a')); await click('Erneut laden'); expect(host.textContent).toContain('Unternehmen a');
  });
  it('recovers the directory after a thrown request', async () => {
    vi.useFakeTimers(); api.list.mockRejectedValue(new Error('Liste offline')); await render(<PlatformTenantsScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); }); expect(host.textContent).toContain('Liste offline');
    api.list.mockResolvedValue({ ok: true, data: { items: [{ id: 'b', tenantName: 'Unternehmen b' }] } }); await click('Erneut laden'); expect(host.textContent).toContain('Unternehmen b');
  });
});
