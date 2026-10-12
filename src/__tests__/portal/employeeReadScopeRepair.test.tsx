// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ actor: {} as Record<string, unknown>, records: vi.fn(), client: vi.fn(), calendar: vi.fn(), dashboard: vi.fn(), detail: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => f.actor }));
vi.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOffline: false }) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30_000, OPERATIONAL_LIVE_POLL_MS: 5000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('@/lib/realtime', () => ({ subscribeToEmployeePortalChanges: vi.fn() }));
vi.mock('@/lib/portal/employeePortalClientRecordsService', () => ({ fetchEmployeePortalClientRecords: f.records, fetchEmployeePortalClientRecordDetail: f.client }));
vi.mock('@/lib/calendar/calendarEventService', () => ({ buildEmployeePortalCalendarConfig: () => ({}), getEmployeePortalTeamCalendarEvents: f.calendar }));
vi.mock('@/lib/offline/assignmentCacheService', () => ({ loadDashboardProjectionWithCache: f.dashboard, loadPortalAppointmentDetailWithCache: f.detail }));
import { useEmployeePortalClientRecordDetail, useEmployeePortalClientRecords } from '@/hooks/useEmployeePortalClientRecords';
import { useEmployeePortalCalendarEvents } from '@/hooks/useEmployeePortalCalendarEvents';
import { useEmployeePortalDashboard } from '@/hooks/useEmployeePortalDashboard';
import { usePortalAppointmentDetail } from '@/hooks/usePortalAppointmentDetail';

let root: Root; let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  f.actor = { tenantId: 'tenant-1', employeeId: 'employee-1', actorId: 'profile-1', roleKey: 'employee_portal', isReady: true, isResolvingEmployeeLink: false };
  f.records.mockResolvedValue({ ok: true, data: [{ clientId: 'client-1' }] });
  f.client.mockResolvedValue({ ok: true, data: { clientId: 'client-1', displayName: 'Erste Akte' } });
  f.calendar.mockResolvedValue({ ok: true, data: [{ id: 'event-1' }] });
  f.dashboard.mockResolvedValue({ ok: true, data: { label: 'today' } });
  f.detail.mockResolvedValue({ ok: true, data: { id: 'assignment-1' } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((callback) => { resolve = callback; }); return { promise, resolve }; };

describe('Mounted employee portal reads', () => {
  it('clears the old client record while a different record loads and keeps it cleared if that read fails', async () => {
    function Probe({ id }: { id: string }) { const state = useEmployeePortalClientRecordDetail(id); return <div>{state.record?.displayName ?? ''}:{state.error ?? ''}</div>; }
    await render(<Probe id="client-1" />);
    expect(host.textContent).toContain('Erste Akte');
    const flight = deferred<{ ok: false; error: string }>(); f.client.mockReturnValue(flight.promise);
    await render(<Probe id="client-2" />);
    expect(host.textContent).not.toContain('Erste Akte');
    await act(async () => flight.resolve({ ok: false, error: 'Zweite Akte verweigert.' }));
    expect(host.textContent).toBe(':Zweite Akte verweigert.');
  });
  it('clears the previous tenant directory on an actor switch', async () => {
    function Probe() { const state = useEmployeePortalClientRecords(); return <div>{state.records.map((record) => record.clientId).join(',')}</div>; }
    await render(<Probe />); expect(host.textContent).toBe('client-1');
    f.actor = { ...f.actor, tenantId: 'tenant-2', actorId: 'profile-2' }; f.records.mockReturnValue(new Promise(() => {}));
    await render(<Probe />); expect(host.textContent).toBe('');
  });
  it('clears a previous calendar period when a new period is still pending', async () => {
    function Probe({ start }: { start: string }) { const state = useEmployeePortalCalendarEvents(start, '2026-11-01'); return <div>{state.events.map((event) => event.id).join(',')}</div>; }
    await render(<Probe start="2026-10-01" />); expect(host.textContent).toBe('event-1');
    f.calendar.mockReturnValue(new Promise(() => {}));
    await render(<Probe start="2026-10-15" />); expect(host.textContent).toBe('');
  });
  it.each(['clients', 'calendar', 'dashboard', 'detail'])('reports a missing employee link for %s without calling the service', async (kind) => {
    f.actor = { ...f.actor, employeeId: null };
    function Clients() { const state = useEmployeePortalClientRecords(); return <div>{state.error}</div>; }
    function Calendar() { const state = useEmployeePortalCalendarEvents(); return <div>{state.error}</div>; }
    function Dashboard() { const state = useEmployeePortalDashboard(); return <div>{state.error}</div>; }
    function Detail() { const state = usePortalAppointmentDetail('assignment-1'); return <div>{state.error}</div>; }
    const Probe = { clients: Clients, calendar: Calendar, dashboard: Dashboard, detail: Detail }[kind]!;
    await render(<Probe />); expect(host.textContent).toContain('Mitarbeitendenprofil');
    for (const service of [f.records, f.calendar, f.dashboard, f.detail]) expect(service).not.toHaveBeenCalled();
  });
  it('preserves a successful dashboard while reporting a failed refresh as failure', async () => {
    let state!: ReturnType<typeof useEmployeePortalDashboard>;
    function Probe() { state = useEmployeePortalDashboard(); return <div>{state.refreshError}</div>; }
    await render(<Probe />);
    f.dashboard.mockResolvedValue({ ok: false, error: 'Dashboardabruf verweigert.' });
    let succeeded = true; await act(async () => { succeeded = await state.refreshWithResult(); });
    expect(succeeded).toBe(false); expect(state.dashboard).toEqual({ label: 'today' });
    expect(host.textContent).toBe('Dashboardabruf verweigert.');
  });
  it('keeps cached data readable while treating its failed live refresh as a failure', async () => {
    let state!: ReturnType<typeof useEmployeePortalDashboard>;
    function Probe() { state = useEmployeePortalDashboard(); return <div>{state.refreshError}</div>; }
    await render(<Probe />);
    f.dashboard.mockResolvedValue({ ok: true, data: { label: 'saved' }, fromCache: true, cachedAt: '2026-10-10', refreshError: 'Live-Abruf verweigert.' });
    let succeeded = true; await act(async () => { succeeded = await state.refreshWithResult(); });
    expect(succeeded).toBe(false); expect(state.fromCache).toBe(true);
    expect(state.dashboard).toEqual({ label: 'saved' }); expect(host.textContent).toBe('Live-Abruf verweigert.');
  });
});
