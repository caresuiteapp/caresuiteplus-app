// @vitest-environment happy-dom
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalContext } from '@/lib/portal/types';

const api = vi.hoisted(() => ({ width: 390, params: {} as Record<string, string>, fetch: vi.fn(), create: vi.fn(), push: vi.fn(), replace: vi.fn(), released: true }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' }, StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: api.push, replace: api.replace }), useLocalSearchParams: () => api.params }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ width: api.width, isPhone: api.width < 768 }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ actorId: 'authenticated-portal-actor' }) }));
vi.mock('@/hooks/usePortalAssistRealtime', () => ({ usePortalAssistRealtime: () => undefined }));
vi.mock('@/lib/portal/engine', () => ({ canAccessPortalFeature: () => api.released }));
vi.mock('@/lib/portal/assist', async () => ({
  ...await import('@/lib/portal/assist/portalRequestFormOptions'),
  resolvePortalRequestTypeLabel: (type: string) => type,
  fetchAssistDashboardData: api.fetch, createPortalRequest: api.create,
}));
vi.mock('@/components/portal/assist/ClientPortalHomeDashboard', () => ({
  ClientPortalHomeDashboard: ({ context, data, requestsReleased, uploadReleased, onRequestExtra, onUpload }: any) => <div>
    <span>{context.clientId}: {data.contactPhone}</span>
    {requestsReleased ? <button onClick={onRequestExtra}>Einsatz anfragen</button> : null}
    {uploadReleased ? <button onClick={onUpload}>Dokument hochladen</button> : null}
  </div>,
}));
vi.mock('@/components/portal/assist/PortalGlassModal', () => ({
  PortalGlassModal: ({ visible, title, children, onClose, primaryLabel, onPrimary, primaryLoading }: any) => visible ? <section role="dialog" aria-label={title}>
    {children}<button onClick={onClose}>Schließen</button><button disabled={primaryLoading} onClick={onPrimary}>{primaryLabel}</button>
  </section> : null,
}));
vi.mock('@/components/ui', () => ({
  LoadingState: ({ message }: any) => <span>{message}</span>,
  ErrorState: ({ title, message, onRetry }: any) => <div role="alert">{title}: {message}{onRetry ? <button onClick={onRetry}>Erneut laden</button> : null}</div>,
  SuccessState: ({ message }: any) => <span>{message}</span>,
  ListFilterSelect: ({ label, value, options, onChange }: any) => <select aria-label={label} value={value} onChange={event => onChange(event.currentTarget.value)}>{options.map((option: any) => <option key={option.key} value={option.key}>{option.label}</option>)}</select>,
  PremiumInput: ({ label, value, onChangeText, editable }: any) => <textarea aria-label={label} value={value} disabled={editable === false} onInput={event => onChangeText(event.currentTarget.value)} />,
}));
vi.mock('@/components/portal/assist/PortalDocumentUploadModal', () => ({
  PortalDocumentUploadModal: ({ visible, onSuccess }: any) => visible ? <button onClick={onSuccess}>Upload bestätigen</button> : null,
}));
vi.mock('@/components/portal/assist/PortalServiceProofsModal', () => ({ PortalServiceProofsModal: () => null }));
vi.mock('@/components/portal/assist/PortalOpenRequestsModal', () => ({ PortalOpenRequestsModal: () => null }));
vi.mock('@/components/portal/assist/PortalActivitiesModal', () => ({ PortalActivitiesModal: () => null }));
import { AssistPortalOverview } from '@/components/portal/assist/AssistPortalOverview';

let root: Root, host: HTMLDivElement, context: PortalContext;
const data = (phone = '0511 123456') => ({ contactPhone: phone, upcomingAppointments: [], openRequests: [], activities: [] });
const render = async () => { await act(async () => root.render(<AssistPortalOverview context={context} />)); };
const click = async (label: string) => {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label);
  expect(button, label).toBeTruthy(); await act(async () => button!.click());
};
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); api.width = 390; api.params = {}; api.released = true;
  api.fetch.mockReset().mockResolvedValue({ ok: true, data: data() }); api.create.mockReset().mockResolvedValue({ ok: true, data: { id: 'request' } });
  context = { tenantId: 'tenant-a', clientId: 'client-a', careProfile: { careContexts: ['daily_assistance'] } } as PortalContext;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('actual native client overview and request form continuity', () => {
  it('preserves typed fields across phone/tablet rotation and submits the bound client scope', async () => {
    await render(); await click('Einsatz anfragen');
    const message = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Nachricht (optional)"]')!;
    await act(async () => { message.value = 'Bitte am Donnerstag unterstützen.'; message.dispatchEvent(new Event('input', { bubbles: true })); });
    const weekday = host.querySelector<HTMLSelectElement>('select[aria-label="Bevorzugter Wochentag"]')!;
    await act(async () => { weekday.value = 'do'; weekday.dispatchEvent(new Event('change', { bubbles: true })); });
    for (const width of [1024, 390]) {
      api.width = width; await render();
      expect(host.querySelector('[role="dialog"]')).not.toBeNull();
      expect(host.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Bitte am Donnerstag unterstützen.');
      expect(host.querySelector<HTMLSelectElement>('select[aria-label="Bevorzugter Wochentag"]')?.value).toBe('do');
    }
    expect(api.fetch).toHaveBeenCalledTimes(1);
    await click('Anfrage senden');
    expect(api.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      tenantId: 'tenant-a', clientId: 'client-a', portalUserId: 'authenticated-portal-actor', requestType: 'zusatztermin',
      payload: expect.objectContaining({ formVersion: 1, requestType: 'zusatztermin', wochentag: 'do', nachricht: 'Bitte am Donnerstag unterstützen.' }),
    }));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it('keeps the actual request fields after a rejected write and permits a deliberate retry', async () => {
    api.create.mockResolvedValueOnce({ ok: false, error: 'Ihre Anfrage konnte nicht gespeichert werden.' });
    await render(); await click('Einsatz anfragen'); await click('Anfrage senden');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Ihre Anfrage konnte nicht gespeichert werden.');
    expect(host.textContent).not.toContain('Ihre Anfrage wurde übermittelt.');
    await click('Anfrage senden'); expect(api.create).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Ihre Anfrage wurde übermittelt.');
  });
  it('drops the previous client form/data on a scope switch and ignores an older unresolved response', async () => {
    let finishA!: (value: unknown) => void;
    api.fetch.mockReturnValueOnce(new Promise(resolve => { finishA = resolve; }));
    await render();
    context = { ...context, tenantId: 'tenant-b', clientId: 'client-b' };
    api.fetch.mockResolvedValueOnce({ ok: true, data: data('040 765432') }); await render();
    expect(host.textContent).toContain('client-b: 040 765432');
    await act(async () => finishA({ ok: true, data: data('OLD CLIENT PHONE') }));
    expect(host.textContent).not.toContain('OLD CLIENT PHONE');
    await click('Einsatz anfragen');
    context = { ...context, clientId: 'client-c' }; await render();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it('retains the current overview and exposes a failed reload after an upload', async () => {
    await render(); await click('Dokument hochladen');
    api.fetch.mockResolvedValueOnce({ ok: false, error: 'Aktualisieren ist gerade nicht möglich.' });
    await click('Upload bestätigen');
    expect(host.textContent).toContain('client-a: 0511 123456');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Übersicht konnte nicht aktualisiert werden');
  });
  it('preserves the existing request release gate for direct action parameters', async () => {
    api.released = false; api.params = { action: 'zusatztermin' }; await render();
    expect(host.textContent).not.toContain('Einsatz anfragen');
    expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(api.create).not.toHaveBeenCalled();
  });
});
