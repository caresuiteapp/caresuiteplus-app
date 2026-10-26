// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ roleKey: 'client_portal', clientId: 'client-a', noProfile: false, refresh: vi.fn(), create: vi.fn(), profileRead: vi.fn(), contextRead: vi.fn() }));
vi.mock('react-native', () => { const Host = ({ children }: any) => <div>{children}</div>; return { Platform: { OS: 'android' }, View: Host, Text: Host, RefreshControl: () => null, StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 } }; });
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }) }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ width: 390, isTablet: false, isDesktop: false }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true, check: () => ({}), roleLabel: 'Klient' }) }));
vi.mock('@/hooks/usePlatformLayout', () => ({ usePlatformLayout: () => ({ showBottomTabs: true }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ tenantId: 'tenant-a', actorId: 'account-a', roleKey: f.roleKey, clientId: f.clientId, isLinkedReady: true }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { displayName: 'Mein Zugang' } }) }));
vi.mock('@/hooks/usePortalContext', () => ({ usePortalContext: () => { f.contextRead(); return { context: { primaryModule: 'assist', tenantName: 'Testbüro' } }; } }));
vi.mock('@/hooks/useClientPortalProfile', () => ({ useClientPortalProfile: () => { f.profileRead(); return { profile: f.noProfile ? null : { clientId: f.clientId, displayName: 'Vertrauliches Klientenprofil', careModels: [], representativeContacts: [] }, carePlans: [], loading: false, error: null, carePlanError: null, refresh: f.refresh, isReady: true, missingClientLink: false }; } }));
vi.mock('@/lib/portal/portalViewportContext', () => ({ usePortalViewport: () => ({ footerInFlow: true }) }));
vi.mock('@/design/tokens/auroraGlass', () => ({ useAuroraAdaptiveText: () => ({ primary: '#112233', muted: '#445566' }) }));
vi.mock('@/design/tokens/themeBridge', () => ({ useLegacyTheme: () => ({ colors: { primary: '#112233' } }) }));
vi.mock('@/components/auth/PortalDeviceSettingsCard', () => ({ PortalDeviceSettingsCard: () => <div>Geräteeinstellungen</div> }));
vi.mock('@/components/auth/PortalBiometricSettingsCard', () => ({ PortalBiometricSettingsCard: () => <div>Biometrische Anmeldung</div> }));
vi.mock('@/components/keyboard/PortalKeyboard', () => ({ PortalKeyboardScrollView: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/layout/TopbarProfileAvatar', () => ({ TopbarProfileAvatar: () => null }));
vi.mock('@/components/permissions', () => ({ LockedActionBanner: ({ message }: any) => <p>{message}</p> }));
vi.mock('@/components/portal/assist/PortalGlassHero', () => ({ PortalGlassHero: ({ title }: any) => <h1>{title}</h1> }));
vi.mock('@/components/portal/ClientPortalGuide', () => ({ ClientPortalGuide: ({ title, message }: any) => <section>{title}{message}</section> }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/design/components/GlassCard', () => ({ GlassCard: ({ children }: any) => <article>{children}</article> }));
vi.mock('@/components/ui', () => ({ PremiumButton: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button>, PremiumBadge: () => null, EmptyState: ({ title, message, actionLabel, onAction }: any) => <section><h2>{title}</h2><p>{message}</p><button onClick={onAction}>{actionLabel}</button></section>, ErrorState: ({ message }: any) => <p role="alert">{message}</p>, LoadingState: () => null }));
vi.mock('@/components/portal/assist/PortalRequestFormModal', () => ({ PortalRequestFormModal: ({ visible, onSubmit, submitError, submitting }: any) => visible ? <div role="dialog"><p role="alert">{submitError}</p><button disabled={submitting} onClick={() => onSubmit({ feld: 'email', neuerWert: 'neu@example.invalid' })}>Änderung senden</button></div> : null }));
vi.mock('@/lib/portal/assist', () => ({ createPortalRequest: f.create, buildPortalRequestDescription: () => 'Geänderte E-Mail-Adresse', resolvePortalRequestTypeLabel: () => 'Stammdatenänderung', serializePortalRequestPayload: (_type: unknown, value: unknown) => value, isPortalFormRequestType: () => true }));
import { ClientPortalProfileScreen } from '@/screens/portal/ClientPortalProfileScreen';
let root: Root, host: HTMLDivElement;
const render = async () => { await act(async () => root.render(<ClientPortalProfileScreen />)); };
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label)!;
const click = async (label: string) => { await act(async () => button(label).click()); };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); f.roleKey = 'client_portal'; f.clientId = 'client-a'; f.noProfile = false; f.create.mockResolvedValue({ ok: true, data: { id: 'request-a' } }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('actual client profile action lifecycle', () => {
  it('shows an actionable empty profile instead of an empty page', async () => {
    f.noProfile = true; await render();
    expect(host.textContent).toContain('Keine Profildaten');
    expect(button('Stammdaten ändern')).toBeUndefined();
    await click('Erneut laden'); expect(f.refresh).toHaveBeenCalledOnce();
    expect(f.create).not.toHaveBeenCalled();
  });
  it('retains family own-account settings without mounting full client reads or request actions', async () => {
    f.roleKey = 'family_portal'; await render();
    expect(host.textContent).toContain('Mein Angehörigenzugang'); expect(host.textContent).toContain('Geräteeinstellungen');
    expect(f.profileRead).not.toHaveBeenCalled(); expect(f.contextRead).not.toHaveBeenCalled(); expect(button('Stammdaten ändern')).toBeUndefined();
  });
  it('turns a thrown transport failure into an error and permits a confirmed retry', async () => {
    f.create.mockRejectedValueOnce(new Error('Verbindung unterbrochen'));
    await render(); await click('Stammdaten ändern'); await click('Änderung senden');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Verbindung'); expect(button('Änderung senden').disabled).toBe(false);
    await click('Änderung senden'); expect(host.textContent).toContain('Stammdaten-Anfrage wurde übermittelt');
    expect(f.create).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId: 'tenant-a', clientId: 'client-a', portalUserId: 'account-a', requestType: 'stammdaten' }));
  });
  it('sends one request for a double click and discards its old success across a client switch', async () => {
    let finish!: (value: unknown) => void; f.create.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await render(); await click('Stammdaten ändern');
    const submit = button('Änderung senden'); await act(async () => { submit.click(); submit.click(); });
    expect(f.create).toHaveBeenCalledOnce();
    f.clientId = 'client-b'; await render(); await act(async () => finish({ ok: true, data: { id: 'old-request' } }));
    expect(host.textContent).not.toContain('Stammdaten-Anfrage wurde übermittelt'); expect(host.querySelector('[role=dialog]')).toBeNull();
  });
});
