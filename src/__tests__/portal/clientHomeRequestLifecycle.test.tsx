// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalContext } from '@/lib/portal/types';
const f = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), refresh: null as null | (() => void), submit: null as null | ((payload: unknown) => void) }));
vi.mock('react-native', () => ({ View: ({ children }: any) => <div>{children}</div>, StyleSheet: { create: (value: unknown) => value } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useLocalSearchParams: () => ({}) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ actorId: 'actor-a' }) }));
vi.mock('@/hooks/usePortalAssistRealtime', () => ({ usePortalAssistRealtime: (_tenant: unknown, _client: unknown, refresh: () => void) => { f.refresh = refresh; } }));
vi.mock('@/lib/portal/engine', () => ({ canAccessPortalFeature: () => true }));
vi.mock('@/lib/portal/assist', () => ({ fetchAssistDashboardData: f.read, createPortalRequest: f.write,
  isPortalFormRequestType: () => true, buildPortalRequestDescription: () => 'Bound inquiry', serializePortalRequestPayload: () => ({ version: 1 }), resolvePortalRequestTypeLabel: () => 'Zusatztermin' }));
vi.mock('@/components/portal/assist/AssistPortalShell', () => ({ AssistPortalShell: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/portal/assist/ClientPortalHomeDashboard', () => ({ ClientPortalHomeDashboard: ({ data, onRequestExtra }: any) => <div><span>{data.marker}</span><button onClick={onRequestExtra}>Anfragen</button></div> }));
vi.mock('@/components/portal/assist/PortalRequestFormModal', () => ({ PortalRequestFormModal: ({ onSubmit, submitError }: any) => { f.submit = onSubmit; return <div role="dialog">{submitError ? <p role="alert">{submitError}</p> : null}</div>; } }));
vi.mock('@/components/portal/assist/PortalActivitiesModal', () => ({ PortalActivitiesModal: () => null }));
vi.mock('@/components/portal/assist/PortalDocumentUploadModal', () => ({ PortalDocumentUploadModal: () => null }));
vi.mock('@/components/portal/assist/PortalOpenRequestsModal', () => ({ PortalOpenRequestsModal: () => null }));
vi.mock('@/components/portal/assist/PortalServiceProofsModal', () => ({ PortalServiceProofsModal: () => null }));
vi.mock('@/components/ui', () => ({ LoadingState: ({ message }: any) => <p>{message}</p>, ErrorState: ({ message }: any) => <p role="alert">{message}</p>, SuccessState: ({ message }: any) => <p role="status">{message}</p> }));
import { AssistPortalOverview } from '@/components/portal/assist/AssistPortalOverview';
const context = { tenantId: 'tenant-a', clientId: 'client-a', roleKey: 'client_portal', careProfile: { careContexts: [] } } as unknown as PortalContext;
const data = (marker = 'current') => ({ marker, upcomingAppointments: [], contactPhone: null });
const ok = (marker?: string) => ({ ok: true, data: data(marker) });
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
let root: Root, host: HTMLDivElement;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); f.read.mockResolvedValue(ok()); f.write.mockResolvedValue({ ok: true, data: { id: 'request-a' } }); f.submit = null; f.refresh = null; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const mount = () => act(async () => { root.render(<AssistPortalOverview context={context} />); });
const open = () => act(async () => { host.querySelector('button')!.click(); });
describe('client home request and refresh lifecycle', () => {
  it('sends one tenant/client-bound inquiry for two immediate submissions', async () => {
    const flight = deferred(); f.write.mockReturnValue(flight.promise); await mount(); await open();
    await act(async () => { f.submit!({}); f.submit!({}); });
    expect(f.write).toHaveBeenCalledTimes(1);
    expect(f.write.mock.calls[0]![0]).toMatchObject({ tenantId: 'tenant-a', clientId: 'client-a', portalUserId: 'actor-a', requestType: 'zusatztermin' });
    expect(host.querySelector('[role="status"]')).toBeNull();
    await act(async () => flight.resolve({ ok: true, data: { id: 'request-a' } }));
    expect(host.querySelector('[role="status"]')?.textContent).toContain('übermittelt');
  });
  it('keeps a rejected request editable and permits a deliberate retry', async () => {
    f.write.mockRejectedValueOnce(new Error('network failure')); await mount(); await open();
    await act(async () => f.submit!({}));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('erneut');
    expect(host.querySelector('[role="status"]')).toBeNull();
    await act(async () => f.submit!({})); expect(f.write).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('übermittelt');
  });
  it('does not replace a newer realtime result with an older initial read', async () => {
    const initial = deferred(), latest = deferred(); f.read.mockReturnValueOnce(initial.promise).mockReturnValueOnce(latest.promise);
    await mount(); await act(async () => f.refresh!());
    await act(async () => latest.resolve(ok('newer')));
    await act(async () => initial.resolve(ok('outdated')));
    expect(host.textContent).toContain('newer'); expect(host.textContent).not.toContain('outdated');
  });
  it('shows a failed initial realtime read instead of rendering a null dashboard', async () => {
    const initial = deferred(), latest = deferred(); f.read.mockReturnValueOnce(initial.promise).mockReturnValueOnce(latest.promise);
    await mount(); await act(async () => f.refresh!());
    await act(async () => latest.resolve({ ok: false, error: 'Daten nicht verfügbar' }));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => initial.resolve(ok('late')));
    expect(host.textContent).not.toContain('late');
  });
});
