// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ load: vi.fn(), offline: false }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ authReady: true, user: { id: 'user-1' } }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ tenantId: 'tenant-1', clientId: 'client-1', actorId: 'account-1', roleKey: 'client_portal', isLinkedReady: true, isResolvingClientLink: false }) }));
vi.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOffline: f.offline }) }));
vi.mock('@/lib/offline/assignmentCacheService', () => ({ loadPortalAppointmentsWithCache: f.load }));
vi.mock('@/lib/realtime', () => ({ subscribeToEmployeePortalChanges: vi.fn(), subscribeToPortalAssistChanges: vi.fn() }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('@/lib/portal/employeePortalLiveOverviewService', () => ({ filterEmployeePortalAppointments: (items: unknown[]) => items }));
import { usePortalAppointments } from '@/hooks/usePortalAppointments';

let root: Root;
let host: HTMLDivElement;
let state: ReturnType<typeof usePortalAppointments>;
function Probe() {
  state = usePortalAppointments('client');
  return <div>{state.items.length}:{String(state.showSuccess)}:{state.refreshError}</div>;
}
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); f.offline = false;
  f.load.mockResolvedValue({ ok: true, data: [{ id: 'visit-1' }] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Client appointment refresh feedback', () => {
  it('keeps existing content and exposes refresh failure without showing success', async () => {
    await act(async () => root.render(<Probe />));
    f.load.mockResolvedValue({ ok: false, error: 'Aktualisieren fehlgeschlagen.' });
    await act(async () => { await state.refresh(); });
    expect(state.items).toHaveLength(1);
    expect(state.showSuccess).toBe(false);
    expect(state.refreshError).toBeTruthy();
  });
  it('shows success only after a successful live reload', async () => {
    await act(async () => root.render(<Probe />));
    expect(state.showSuccess).toBe(false);
    await act(async () => { await state.refresh(); });
    expect(state.showSuccess).toBe(true);
    expect(state.refreshError).toBeNull();
  });
  it('does not claim a live update when only offline cache is read', async () => {
    f.offline = true;
    f.load.mockResolvedValue({ ok: true, data: [{ id: 'visit-1' }], fromCache: true });
    await act(async () => root.render(<Probe />));
    await act(async () => { await state.refresh(); });
    expect(state.showSuccess).toBe(false);
    expect(state.fromCache).toBe(true);
  });
});
