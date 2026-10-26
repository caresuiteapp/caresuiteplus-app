// @vitest-environment happy-dom
// Real client screens/hooks. Only native hosts, device APIs and service transport are inert.
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalActor } from '@/hooks/usePortalActor';
import type { FamilyPortalAccessScope } from '@/lib/portal/familyPortalAccessScope';

const f = vi.hoisted(() => ({ actor: {} as PortalActor, carePanel: vi.fn(), list: vi.fn(), create: vi.fn(), pdf: vi.fn(), open: vi.fn(), push: vi.fn(), profile: vi.fn(), plans: vi.fn(), appointment: vi.fn(), change: vi.fn(), document: vi.fn(), download: vi.fn() }));
vi.mock('react-native', () => {
  const Host = ({ children, testID }: { children?: ReactNode; testID?: string }) => <div data-testid={testID}>{children}</div>;
  return { View: Host, ScrollView: Host, Text: ({ children, accessibilityRole }: any) => <span role={accessibilityRole}>{children}</span>, Pressable: ({ children, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{children}</button>, StyleSheet: { create: (s: unknown) => s }, Platform: { OS: 'android' }, AppState: { addEventListener: () => ({ remove() {} }) }, Linking: { openURL: f.open } };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ push: f.push }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => f.actor }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ width: 390, isPhone: true }) }));
vi.mock('@/design/tokens/auroraGlass', () => ({ PORTAL_LIGHT_LINK_ORANGE: '#A44E0A', useAuroraAdaptiveText: () => ({ primary: '#142B4C', muted: '#4C6180' }) }));
vi.mock('@/components/pflege/PortalCarePanels', () => ({ ClientCareProofPanel: f.carePanel }));
vi.mock('@/components/portal/assist/PortalGlassHero', () => ({ PortalGlassHero: ({ title }: any) => <h1>{title}</h1> }));
vi.mock('@/components/portal/ClientPortalGuide', () => ({ ClientPortalGuide: ({ title, message }: any) => <section>{title} {message}</section> }));
vi.mock('@/design/components/GlassCard', () => ({ GlassCard: ({ children }: any) => <article>{children}</article> }));
vi.mock('@/screens/portal/PortalTabScreen', () => ({ PortalTabScreen: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/components/ui', () => ({ LoadingState: ({ message }: any) => <span>{message}</span>, ErrorState: ({ message, onRetry }: any) => <div role="alert">{message}<button onClick={onRetry}>Erneut laden</button></div>, SuccessState: ({ message }: any) => <div role="status">{message}</div>, CareLightButton: ({ title, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{title}</button> }));
vi.mock('@/lib/portal/assist/portalServiceProofService', () => ({ listPortalServiceProofs: f.list, resolvePortalServiceProofDownloadUrl: f.pdf, resolvePortalServiceProofStatusLabel: (value: string) => value }));
vi.mock('@/lib/portal/assist/portalRequestService', () => ({ createPortalRequest: f.create }));
vi.mock('@/lib/portal/portalProofCacheSignal', () => ({ subscribePortalProofCache: () => () => {} }));
vi.mock('@/lib/portal', () => ({ fetchClientPortalProfile: f.profile, fetchClientCarePlanSummaries: f.plans, fetchPortalDocumentDetail: f.document, downloadPortalDocument: f.download }));
vi.mock('@/lib/portal/appointmentService', () => ({ fetchPortalClientAppointmentDetail: f.appointment, requestPortalAppointmentChange: f.change }));
vi.mock('@/lib/offline/clientAppointmentCache', () => ({ readClientAppointmentCache: async () => null, writeClientAppointmentCache: async () => {} }));
vi.mock('@/lib/offline/idb', () => ({ offlineCacheEpoch: () => 1 }));
vi.mock('@/lib/realtime', () => ({ subscribeToPortalAssistChanges: () => () => {} }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/services/queryTimeout', () => ({ withServiceQueryTimeout: (promise: unknown) => promise, NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000 }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/hooks/core', async () => ({ ...await import('@/hooks/core/useAsyncQuery'), ...await import('@/hooks/core/useMutation'), DEFAULT_LIVE_POLL_MS: 30000 }));
import { ClientPortalProofsScreen } from '@/screens/portal/ClientPortalProofsScreen';
import { useClientPortalProfile } from '@/hooks/useClientPortalProfile';
import { usePortalClientAppointmentDetail } from '@/hooks/usePortalClientAppointmentDetail';
import { usePortalDocumentDetail } from '@/hooks/usePortalDocumentDetail';

let root: Root, host: HTMLDivElement;
const proof = { id: 'proof-a', tenantId: 'tenant-a', clientId: 'client-a', title: 'Freigegebener Nachweis April', status: 'offen', signatureRequired: true, periodLabel: 'April 2026' };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const render = async (children: ReactNode) => { await act(async () => root.render(children)); };
function button(label: string) { const found = [...host.querySelectorAll('button')].find(item => item.textContent === label); expect(found, label).toBeTruthy(); return found!; }
const click = async (label: string) => { await act(async () => button(label).click()); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  f.actor = { tenantId: 'tenant-a', clientId: 'client-a', employeeId: null, actorId: 'account-a', roleKey: 'client_portal', familyAccess: null, displayName: 'Testperson', isReady: true, isLinkedReady: true, isResolvingClientLink: false, isResolvingEmployeeLink: false, isResolvingDisplayName: false };
  f.list.mockResolvedValue({ ok: true, data: [proof] }); f.create.mockResolvedValue({ ok: true, data: { id: 'request-a' } });
  f.pdf.mockResolvedValue({ ok: true, data: 'https://example.invalid/proof-a.pdf' }); f.open.mockResolvedValue(undefined);
  f.profile.mockResolvedValue({ ok: true, data: { profile: { displayName: 'Client A', clientId: 'client-a' }, portalAccess: null } }); f.plans.mockResolvedValue({ ok: true, data: [] });
  f.appointment.mockResolvedValue({ ok: true, data: { id: 'visit-a', title: 'Einsatz A' } }); f.change.mockResolvedValue({ ok: true, data: { id: 'request-a' } });
  f.document.mockResolvedValue({ ok: true, data: { id: 'document-a' } }); f.download.mockResolvedValue({ ok: true, data: { downloadUrl: 'https://example.invalid/document-a.pdf' } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('actual client proof actions', () => {
  it('does not mount the unreleased clinical proof workflow through the released assist proof page', async () => {
    await render(<ClientPortalProofsScreen />);
    expect(host.textContent).toContain(proof.title);
    expect(f.carePanel).not.toHaveBeenCalled();
  });
  it('sends one bound inquiry while pending and acknowledges only its confirmed receipt', async () => {
    const pending = deferred<unknown>(); f.create.mockReturnValue(pending.promise);
    await render(<ClientPortalProofsScreen />);
    const send = button('Rückfrage senden');
    await act(async () => { send.click(); send.click(); });
    expect(f.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tenantId: 'tenant-a', clientId: 'client-a', portalUserId: 'account-a', requestType: 'nachweise' }));
    expect(host.textContent).not.toContain('wurde übermittelt');
    await act(async () => pending.resolve({ ok: true, data: { id: 'request-a' } }));
    expect(host.querySelector('[role=status]')?.textContent).toContain('wurde übermittelt');
    expect(button('Rückfrage gesendet').disabled).toBe(true);
  });
  it('keeps proof content and allows an explicit retry after a rejected inquiry', async () => {
    f.create.mockResolvedValueOnce({ ok: false, error: 'Verbindung unterbrochen' });
    await render(<ClientPortalProofsScreen />); await click('Rückfrage senden');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Verbindung'); expect(host.textContent).toContain(proof.title);
    await click('Rückfrage senden'); expect(f.create).toHaveBeenCalledTimes(2); expect(host.textContent).toContain('wurde übermittelt');
  });
  it('reports an external PDF opener failure without losing its proof or issuing a false navigation', async () => {
    f.open.mockRejectedValueOnce(new Error('no activity'));
    await render(<ClientPortalProofsScreen />); await click('PDF anzeigen');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('PDF konnte nicht geöffnet');
    expect(host.textContent).toContain(proof.title); expect(f.push).not.toHaveBeenCalled();
    await click('PDF anzeigen'); expect(f.open).toHaveBeenCalledTimes(2);
  });
  it('rejects a family deep link without service-record capability before any proof request', async () => {
    f.actor = { ...f.actor, roleKey: 'family_portal', familyAccess: null };
    await render(<ClientPortalProofsScreen />);
    expect(host.textContent).toContain('Nachweise nicht freigegeben'); expect(f.list).not.toHaveBeenCalled(); expect(f.create).not.toHaveBeenCalled();
  });
  it('separates family record viewing, download, signing and inquiry capabilities', async () => {
    f.actor = { ...f.actor, roleKey: 'family_portal', familyAccess: { validFrom: '2026-01-01T00:00:00.000000Z', expiresAt: null, permissions: { service_records: true } } as FamilyPortalAccessScope };
    await render(<ClientPortalProofsScreen />);
    expect(host.textContent).toContain(proof.title); expect(host.textContent).not.toContain('PDF anzeigen'); expect(host.textContent).not.toContain('Unterschreiben'); expect(host.textContent).not.toContain('Rückfrage senden');
    await click('Nachweis öffnen'); expect(f.push).toHaveBeenCalledExactlyOnceWith('/portal/client/documents/proof-a');
  });
  it('discards a prior client read and action completion across a retained route scope change', async () => {
    const pending = deferred<unknown>(); f.create.mockReturnValueOnce(pending.promise);
    await render(<ClientPortalProofsScreen />); await click('Rückfrage senden');
    f.actor = { ...f.actor, clientId: 'client-b' }; f.list.mockResolvedValue({ ok: true, data: [{ ...proof, id: 'proof-b', title: 'Nachweis B' }] });
    await render(<ClientPortalProofsScreen />); await act(async () => pending.resolve({ ok: true, data: { id: 'old-request' } }));
    expect(host.textContent).toContain('Nachweis B'); expect(host.textContent).not.toContain(proof.title); expect(host.textContent).not.toContain('wurde übermittelt');
    expect(button('Rückfrage senden').disabled).toBe(false);
  });
});

describe('retained client hook identity', () => {
  it('does not inherit a client full-profile or care-plan read from a family role', async () => {
    f.actor = { ...f.actor, roleKey: 'family_portal' };
    let state!: ReturnType<typeof useClientPortalProfile>;
    function Probe() { state = useClientPortalProfile(); return <div>{state.profile?.displayName}</div>; }
    await render(<Probe />);
    expect(f.profile).not.toHaveBeenCalled(); expect(f.plans).not.toHaveBeenCalled();
    expect(state.profile).toBeNull(); expect(state.carePlans).toEqual([]);
  });
  it('clears the previous profile immediately while the new bound client is still loading', async () => {
    let state: ReturnType<typeof useClientPortalProfile>;
    function Probe() { state = useClientPortalProfile(); return <div>{state.profile?.displayName}</div>; }
    await render(<Probe />); expect(host.textContent).toContain('Client A');
    const pending = deferred<unknown>(); f.profile.mockReturnValueOnce(pending.promise); f.actor = { ...f.actor, clientId: 'client-b' };
    await render(<Probe />); expect(host.textContent).not.toContain('Client A');
    await act(async () => pending.resolve({ ok: true, data: { profile: { displayName: 'Client B' } } })); expect(host.textContent).toContain('Client B');
  });
  it('does not publish an old appointment change success on another appointment', async () => {
    let state: ReturnType<typeof usePortalClientAppointmentDetail>;
    function Probe({ id }: { id: string }) { state = usePortalClientAppointmentDetail(id); return <div>{state.successMessage}</div>; }
    const pending = deferred<unknown>(); f.change.mockReturnValueOnce(pending.promise);
    await render(<Probe id="visit-a" />); let flight: Promise<unknown>; await act(async () => { flight = state.requestChange('Bitte später.'); });
    await render(<Probe id="visit-b" />); await act(async () => { pending.resolve({ ok: true, data: { id: 'request-a' } }); await flight; });
    expect(f.change).toHaveBeenCalledExactlyOnceWith('visit-a', 'account-a', 'client_portal', 'Bitte später.', { tenantId: 'tenant-a', clientId: 'client-a' });
    expect(state!.successMessage).toBeNull(); expect(host.textContent).not.toContain('gesendet');
  });
  it('does not open an old document download after navigation to another document', async () => {
    let state: ReturnType<typeof usePortalDocumentDetail>;
    function Probe({ id }: { id: string }) { state = usePortalDocumentDetail(id, 'client'); return <div>{state.successMessage}</div>; }
    const pending = deferred<unknown>(); f.download.mockReturnValueOnce(pending.promise);
    await render(<Probe id="document-a" />); let flight: Promise<unknown>; await act(async () => { flight = state.download(); });
    await render(<Probe id="document-b" />); await act(async () => { pending.resolve({ ok: true, data: { downloadUrl: 'https://example.invalid/old.pdf' } }); await flight; });
    expect(f.open).not.toHaveBeenCalled(); expect(state!.successMessage).toBeNull();
  });
});
