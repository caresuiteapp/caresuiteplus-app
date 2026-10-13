// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ resume: vi.fn(), stop: vi.fn(), flush: vi.fn(), assistFlush: vi.fn(), push: vi.fn(), foreground: vi.fn(), actor: { tenantId: 'tenant', employeeId: 'employee-a', isReady: true } }));
vi.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>,
  Pressable: ({ children, onPress }: any) => <button onClick={onPress}>{children}</button>,
  Platform: { OS: 'web' },
  AppState: { addEventListener: (_event: string, callback: (state: string) => void) => { h.foreground.mockImplementation(callback); return { remove: vi.fn() }; } }, StyleSheet: { create: (v: any) => v },
}));
vi.mock('expo-router', () => ({ usePathname: () => '/portal/employee', useRouter: () => ({ push: h.push }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/lib/employeeLogbook', () => ({ resumeActiveEmployeeLogbookTracking: h.resume, stopEmployeeLogbookTrackingForScope: h.stop, flushLogbookPointQueue: h.flush }));
vi.mock('@/features/liveTracking/assistLocationPointQueue', () => ({ flushAssistLocationPointQueue: h.assistFlush }));
import { EmployeeLogbookLifecycleGate } from '@/components/portal/EmployeeLogbookLifecycleGate';
import { EmployeeLogbookLifecycleGate as WebEmployeeLogbookLifecycleGate } from '@/components/portal/EmployeeLogbookLifecycleGate.web';
let root: Root, host: HTMLDivElement;
let Gate = EmployeeLogbookLifecycleGate;
const trip = { id: 'trip-a', assignmentId: 'visit-a', status: 'recording', routeType: 'client_to_home' };
beforeEach(() => {
  vi.clearAllMocks(); h.actor.employeeId = 'employee-a'; h.actor.isReady = true; h.resume.mockResolvedValue(trip); h.stop.mockResolvedValue(undefined);
  h.flush.mockResolvedValue({ remaining: 0 }); h.assistFlush.mockResolvedValue({ remaining: 0 });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<Gate />)); };
describe.each([['native', EmployeeLogbookLifecycleGate], ['web', WebEmployeeLogbookLifecycleGate]] as const)('%s recovery gate actor and synchronization behavior', (_surface, Component) => {
  beforeEach(() => { Gate = Component; });
  it('reports an unknown sync state when a queue flush fails instead of claiming synchronized GPS', async () => {
    h.flush.mockRejectedValue(new Error('Offline')); await render();
    expect(host.textContent).toContain('Synchronisierung noch nicht bestätigt');
    expect(host.textContent).not.toContain('GPS-Hintergrunddienst angefordert');
    await act(async () => host.querySelector('button')!.click());
    expect(h.push).toHaveBeenCalledWith({ pathname: '/portal/employee/assignments/[id]/execute', params: { id: 'visit-a' } });
  });
  it('discards an old employee trip which resolves after switching to another employee', async () => {
    let resolve!: (value: unknown) => void;
    h.resume.mockImplementation((_tenant, employee) => employee === 'employee-a' ? new Promise(r => { resolve = r; }) : Promise.resolve(null));
    await render(); h.actor.employeeId = 'employee-b'; await render();
    await act(async () => resolve(trip));
    expect(host.querySelector('button')).toBeNull(); expect(h.push).not.toHaveBeenCalled();
    expect(h.resume).toHaveBeenCalledWith('tenant', 'employee-b', expect.objectContaining({ shouldContinue: expect.any(Function) }));
    expect(h.stop).toHaveBeenCalledWith('tenant', 'employee-a');
  });
  it('removes an already displayed old trip during a new employee read', async () => {
    await render(); expect(host.querySelector('button')).not.toBeNull();
    h.resume.mockReturnValue(new Promise(() => undefined)); h.actor.employeeId = 'employee-b'; await render();
    expect(host.querySelector('button')).toBeNull();
  });
  it('invalidates a waiting native permission/start guard and removes producers on unmount', async () => {
    h.resume.mockReturnValue(new Promise(() => undefined)); await render();
    const shouldContinue = h.resume.mock.calls[0][2].shouldContinue as () => boolean;
    expect(shouldContinue()).toBe(true);
    await act(async () => root.render(null));
    expect(shouldContinue()).toBe(false); expect(h.stop).toHaveBeenCalledWith('tenant', 'employee-a');
  });
  it('shows point durability errors instead of confirming safely buffered GPS points', async () => {
    h.flush.mockResolvedValue({ remaining: 3 }); await render();
    expect(host.textContent).toContain('3 GPS-Punkte sicher zwischengespeichert');
    await act(async () => h.resume.mock.calls[0][2].onError(new Error('Gerätespeicher nicht verfügbar')));
    expect(host.textContent).toContain('GPS-Punkt konnte nicht sicher gespeichert werden'); expect(host.textContent).not.toContain('3 GPS-Punkte sicher zwischengespeichert');
  });
  it('keeps a point error across successful refreshes and clears it only after current-scope point persistence', async () => {
    await render();
    await act(async () => h.resume.mock.calls[0][2].onError(new Error('Gerätespeicher nicht verfügbar')));
    await act(async () => h.foreground('active'));
    expect(h.resume).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Gerätespeicher nicht verfügbar');
    await act(async () => h.resume.mock.calls[1][2].onPointPersisted());
    expect(host.textContent).not.toContain('GPS-Punkt konnte nicht sicher gespeichert werden');
  });
  it('does not let a late old-scope point recovery clear the new employee point error', async () => {
    await render();
    const oldCallbacks = h.resume.mock.calls[0][2];
    h.actor.employeeId = 'employee-b'; await render();
    const currentCallbacks = h.resume.mock.calls[1][2];
    await act(async () => currentCallbacks.onError(new Error('Speicher des aktuellen Kontos nicht verfügbar')));
    await act(async () => oldCallbacks.onPointPersisted());
    expect(host.textContent).toContain('Speicher des aktuellen Kontos nicht verfügbar');
    await act(async () => currentCallbacks.onPointPersisted());
    expect(host.textContent).not.toContain('GPS-Punkt konnte nicht sicher gespeichert werden');
  });
});
