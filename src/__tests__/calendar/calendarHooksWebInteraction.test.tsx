// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDefaultTenantCalendarSettings } from '@/types/modules/calendarEvent';
const f = vi.hoisted(() => ({ tenant: 'tenant-a', actor: 'actor-a', role: 'business_admin', planningEnabled: true, read: vi.fn(), write: vi.fn(), events: vi.fn(), employees: vi.fn(), planning: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.actor, roleKey: f.role } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null, isLiveServiceMode: () => true }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message: string }) => error.message }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/calendar/calendarWorkspaceService', () => ({ getWorkspaceCalendarEvents: f.events }));
vi.mock('@/lib/calendar/employeeMonthPlanningService', () => ({ listPlanningEmployees: f.employees, loadPlanningSnapshot: f.planning }));
vi.mock('@/lib/calendar/calendarEventService', () => ({ buildOfficeCalendarConfig: () => ({ moduleKey: 'all', calendarScope: 'office' }), buildModuleCalendarConfig: () => ({ moduleKey: 'assist', calendarScope: 'module' }), filterEventsByVisibleTypes: (events: any[], visible: Record<string, boolean>) => events.filter((event) => visible[event.type] !== false) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  let tenant = '', payload: unknown;
  const chain = { select: () => chain, eq: (_key: string, value: string) => { tenant = value; return chain; }, maybeSingle: () => f.read(tenant), upsert: (value: unknown) => { payload = value; return chain; }, single: () => f.write(payload) };
  return chain;
} }));
import { useTenantCalendarSettings } from '@/hooks/useTenantCalendarSettings.web';
import { useCalendarEvents } from '@/hooks/useCalendarEvents.web';
import { useEmployeeMonthPlanning } from '@/hooks/useEmployeeMonthPlanning.web';
import { notifyCalendarWorkspaceChanged } from '@/lib/calendar/calendarWorkspaceRefresh.web';
const pending = () => { let resolve!: (value: any) => void; const promise = new Promise<any>((done) => { resolve = done; }); return { resolve, promise }; };
let root: Root, host: HTMLDivElement;
let api: { first: ReturnType<typeof useTenantCalendarSettings>; second: ReturnType<typeof useTenantCalendarSettings>; calendar: ReturnType<typeof useCalendarEvents>; planning: ReturnType<typeof useEmployeeMonthPlanning> };
function Harness({ start = '2026-10-01' }: { start?: string }) {
  api = { first: useTenantCalendarSettings(), second: useTenantCalendarSettings(), calendar: useCalendarEvents(start, '2026-10-31'), planning: useEmployeeMonthPlanning(f.tenant, 'employee-a', '2026-10', '2026-10', f.planningEnabled) };
  return <span>{api.calendar.events.map((event) => event.title).join(',')}</span>;
}
const event = (id: string, type: 'termin' | 'einsatz') => ({ id, type, title: id, start: '2026-10-17T08:00:00Z', end: '2026-10-17T09:00:00Z', color: '#1685b5' });
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); f.tenant = 'tenant-a'; f.actor = 'actor-a'; f.role = 'business_admin';
  f.read.mockResolvedValue({ data: { settings: buildDefaultTenantCalendarSettings('tenant-a') }, error: null });
  f.write.mockImplementation(async (data) => ({ data, error: null }));
  f.events.mockResolvedValue({ ok: true, data: [event('Besprechung', 'termin'), event('Betreuung', 'einsatz')] });
  f.planningEnabled = true; f.employees.mockResolvedValue([{ id: 'employee-a', name: 'Ada Team' }]); f.planning.mockResolvedValue({ plans: [], absences: [] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (start?: string) => { await act(async () => root.render(<Harness start={start} />)); };
describe('Web calendar hook identity and settings synchronization', () => {
  it('updates both settings instances and the event filter after a confirmed save', async () => {
    await render(); expect(api.calendar.events).toHaveLength(2);
    await act(async () => { await api.first.save({ ...api.first.form!, visibleTypes: { ...api.first.form!.visibleTypes, einsatz: false } }); });
    expect(api.second.settings?.visibleTypes.einsatz).toBe(false);
    expect(api.calendar.events.map((item) => item.title)).toEqual(['Besprechung']);
  });
  it('does not let a pending older read overwrite a newly saved setting', async () => {
    await render(); const old = pending(); f.read.mockReturnValueOnce(old.promise);
    await act(async () => { void api.second.refresh(); });
    await act(async () => { await api.first.save({ ...api.first.form!, defaultView: 'week' }); });
    await act(async () => old.resolve({ data: { settings: buildDefaultTenantCalendarSettings('tenant-a') }, error: null }));
    expect(api.second.settings?.defaultView).toBe('week'); expect(api.second.loading).toBe(false);
  });
  it('clears old data immediately on actor or range changes and ignores old responses', async () => {
    await render(); const old = pending(), current = pending();
    f.events.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await render('2026-11-01'); expect(api.calendar.events).toEqual([]); expect(api.calendar.calendarReady).toBe(false);
    f.actor = 'actor-b'; await render('2026-11-01');
    await act(async () => old.resolve({ ok: true, data: [event('Alt', 'termin')] })); expect(api.calendar.events).toEqual([]);
    await act(async () => current.resolve({ ok: true, data: [event('Neu', 'termin')] }));
    expect(api.calendar.events.map((item) => item.title)).toEqual(['Neu']); expect(api.calendar.calendarReady).toBe(true);
  });
  it('does not retain another tenant’s settings or events while the replacement loads', async () => {
    await render(); const next = pending(), settings = pending(); f.events.mockReturnValue(next.promise); f.read.mockReturnValue(settings.promise);
    f.tenant = 'tenant-b'; await render();
    expect(api.first.settings).toBeNull(); expect(api.second.settings).toBeNull(); expect(api.calendar.events).toEqual([]);
    await act(async () => { settings.resolve({ data: null, error: null }); next.resolve({ ok: true, data: [] }); });
    expect(api.first.settings?.tenantId).toBe('tenant-b');
  });
  it('blocks planning readiness when a source is incomplete and reports failed refreshes', async () => {
    f.events.mockResolvedValue({ ok: true, data: [event('Besprechung', 'termin')], refreshError: 'Abwesenheiten fehlen' });
    await render(); expect(api.calendar.events).toHaveLength(1); expect(api.calendar.calendarReady).toBe(false); expect(api.calendar.refreshError).toContain('Abwesenheiten');
    f.events.mockResolvedValue({ ok: false, error: 'Zugriff abgelehnt' });
    let refreshed = true; await act(async () => { refreshed = await api.calendar.refreshWithResult(); });
    expect(refreshed).toBe(false); expect(api.calendar.calendarReady).toBe(false); expect(api.calendar.refreshError).toBe('Zugriff abgelehnt');
  });
  it('keeps failed settings saves open for retry without changing filters', async () => {
    await render(); f.write.mockResolvedValue({ data: null, error: { message: 'Nicht gespeichert' } });
    await act(async () => { await api.first.save({ ...api.first.form!, visibleTypes: { ...api.first.form!.visibleTypes, einsatz: false } }); });
    expect(api.first.saving).toBe(false); expect(api.first.error).toBe('Nicht gespeichert'); expect(api.calendar.events).toHaveLength(2);
  });
  it('clears planning and employee identity on role changes and rejects late old snapshots', async () => {
    await render(); expect(api.planning.employees).toHaveLength(1); expect(api.planning.ready).toBe(true);
    const old = pending(), current = pending(), people = pending(); f.planning.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise); f.employees.mockReturnValue(people.promise);
    await act(async () => api.planning.refresh()); f.role = 'dispatch'; await render();
    expect(api.planning.employees).toEqual([]); expect(api.planning.ready).toBe(false);
    await act(async () => old.resolve({ plans: [{ employee_id: 'wrong' }], absences: [] })); expect(api.planning.plans).toEqual([]);
    await act(async () => { people.resolve([{ id: 'employee-a', name: 'Aktuelles Team' }]); current.resolve({ plans: [], absences: [] }); });
    expect(api.planning.employees[0].name).toBe('Aktuelles Team'); expect(api.planning.ready).toBe(true);
  });
  it('removes planning data and stops new requests when access is disabled', async () => {
    await render(); f.planningEnabled = false; const calls = f.planning.mock.calls.length; await render();
    expect(api.planning.employees).toEqual([]); expect(api.planning.ready).toBe(false); expect(api.planning.loading).toBe(false); expect(f.planning).toHaveBeenCalledTimes(calls);
  });
  it('refreshes events and availability after a same-tenant external mutation only', async () => {
    await render(); f.events.mockResolvedValue({ ok: true, data: [event('Gespeichert', 'termin')] });
    const calendarCalls = f.events.mock.calls.length, planningCalls = f.planning.mock.calls.length;
    await act(async () => notifyCalendarWorkspaceChanged('tenant-b'));
    expect(f.events).toHaveBeenCalledTimes(calendarCalls); expect(f.planning).toHaveBeenCalledTimes(planningCalls);
    await act(async () => notifyCalendarWorkspaceChanged('tenant-a'));
    expect(f.events).toHaveBeenCalledTimes(calendarCalls + 1); expect(f.planning).toHaveBeenCalledTimes(planningCalls + 1);
    expect(api.calendar.events.map((item) => item.title)).toEqual(['Gespeichert']);
  });
});
