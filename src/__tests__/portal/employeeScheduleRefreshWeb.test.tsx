// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({
  actor: {} as Record<string, unknown>,
  platform: { OS: 'web' },
  calendar: vi.fn(),
  appointments: vi.fn(),
  subscriptions: [] as Array<{
    options: { subscriptionKey: string; specs: Array<{ table: string; filter?: string }> };
    refresh: () => void;
    cleanup: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock('react-native', () => ({ Platform: f.platform, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => f.actor }));
vi.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOffline: false }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ authReady: true, user: { id: 'auth-1' } }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 20_000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('@/lib/calendar/calendarEventService', () => ({ buildEmployeePortalCalendarConfig: () => ({}), getEmployeePortalTeamCalendarEvents: f.calendar }));
vi.mock('@/lib/offline/assignmentCacheService', () => ({ loadPortalAppointmentsWithCache: f.appointments }));
vi.mock('@/lib/portal/employeePortalLiveOverviewService', () => ({ filterEmployeePortalAppointments: (items: unknown[]) => items }));
vi.mock('@/lib/realtime/subscribeToTenantTables', () => ({
  subscribeToTenantTables: (options: typeof f.subscriptions[number]['options'], refresh: () => void) => {
    const cleanup = vi.fn();
    f.subscriptions.push({ options, refresh, cleanup });
    return cleanup;
  },
}));
vi.mock('@/lib/realtime', async () => {
  const presets = await import('@/lib/realtime/presets');
  return { subscribeToEmployeePortalChanges: presets.subscribeToEmployeePortalChanges, subscribeToPortalAssistChanges: presets.subscribeToPortalAssistChanges };
});
import { useEmployeePortalCalendarEvents } from '@/hooks/useEmployeePortalCalendarEvents';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';

let root: Root;
let host: HTMLDivElement;
let calendarState: ReturnType<typeof useEmployeePortalCalendarEvents>;
let appointmentsState: ReturnType<typeof usePortalAppointments>;
function Calendar() {
  calendarState = useEmployeePortalCalendarEvents('2026-10-26T00:00:00Z', '2026-11-02T00:00:00Z');
  return <div>{calendarState.events.map(event => event.id).join(',')}|{calendarState.refreshError ?? calendarState.error}</div>;
}
function Assignments() {
  appointmentsState = usePortalAppointments('employee');
  return <div>{appointmentsState.items.map(item => item.id).join(',')}|{appointmentsState.refreshError}</div>;
}
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(callback => { resolve = callback; });
  return { promise, resolve };
};
const visibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  f.platform.OS = 'web';
  f.subscriptions.length = 0;
  f.actor = { tenantId: 'tenant-1', employeeId: 'employee-1', actorId: 'account-1', roleKey: 'employee_portal', isReady: true, isLinkedReady: true, isResolvingEmployeeLink: false };
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  f.calendar.mockResolvedValue({ ok: true, data: [{ id: 'existing-visit' }] });
  f.appointments.mockResolvedValue({ ok: true, data: [{ id: 'existing-visit' }] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('Employee web schedule refresh against actual query/live hooks', () => {
  it('reloads newly assigned and changed calendar entries from the server on planning events', async () => {
    await render(<Calendar />);
    expect(host.textContent).toBe('existing-visit|');
    expect(f.subscriptions).toHaveLength(1);
    expect(f.subscriptions[0].options.specs).toEqual(expect.arrayContaining([
      { table: 'assist_visits', filter: 'tenant_id=eq.tenant-1' },
      { table: 'calendar_events', filter: 'tenant_id=eq.tenant-1' },
    ]));
    f.calendar.mockResolvedValue({ ok: true, data: [{ id: 'new-assigned-visit' }, { id: 'rescheduled-visit' }] });
    await act(async () => f.subscriptions[0].refresh());
    expect(host.textContent).toBe('new-assigned-visit,rescheduled-visit|');
    // Removing/reassigning a visit is authoritative on the next scoped read.
    f.calendar.mockResolvedValue({ ok: true, data: [] });
    await act(async () => f.subscriptions[0].refresh());
    expect(calendarState.events).toEqual([]);
  });

  it('uses polling when realtime is missed and refreshes after visibility and window focus return', async () => {
    await render(<Calendar />);
    f.calendar.mockResolvedValue({ ok: true, data: [{ id: 'poll-update' }] });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(host.textContent).toBe('poll-update|');
    await act(async () => visibility('hidden'));
    const hiddenCalls = f.calendar.mock.calls.length;
    f.calendar.mockResolvedValue({ ok: true, data: [{ id: 'while-away' }] });
    await act(async () => {
      f.subscriptions[0].refresh();
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(f.calendar).toHaveBeenCalledTimes(hiddenCalls);
    await act(async () => visibility('visible'));
    expect(host.textContent).toBe('while-away|');
    f.calendar.mockResolvedValue({ ok: true, data: [{ id: 'after-window-focus' }] });
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(host.textContent).toBe('after-window-focus|');
  });

  it('clears the previous employee and rejects an old in-flight refresh after an account switch', async () => {
    await render(<Calendar />);
    const oldRead = deferred<{ ok: true; data: Array<{ id: string }> }>();
    f.calendar.mockReturnValueOnce(oldRead.promise);
    await act(async () => f.subscriptions[0].refresh());
    const newRead = deferred<{ ok: true; data: Array<{ id: string }> }>();
    f.calendar.mockReturnValueOnce(newRead.promise);
    f.actor = { ...f.actor, tenantId: 'tenant-2', employeeId: 'employee-2', actorId: 'account-2' };
    await render(<Calendar />);
    expect(host.textContent).toBe('|');
    expect(f.subscriptions[0].cleanup).toHaveBeenCalledOnce();
    expect(f.subscriptions[1].options.subscriptionKey).toContain('tenant-2:employee-2');
    await act(async () => oldRead.resolve({ ok: true, data: [{ id: 'private-old-employee' }] }));
    expect(calendarState.events).toEqual([]);
    await act(async () => newRead.resolve({ ok: true, data: [{ id: 'own-new-employee' }] }));
    expect(host.textContent).toBe('own-new-employee|');
  });

  it('retains the last successful calendar while reporting a failed refresh', async () => {
    await render(<Calendar />);
    f.calendar.mockResolvedValue({ ok: false, error: 'Abruf verweigert.' });
    await act(async () => f.subscriptions[0].refresh());
    expect(calendarState.events).toEqual([{ id: 'existing-visit' }]);
    expect(calendarState.refreshError).toBe('Abruf verweigert.');
  });

  it('does not subscribe or fetch while the employee identity is still resolving', async () => {
    f.actor = { ...f.actor, isResolvingEmployeeLink: true };
    await render(<Calendar />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(f.calendar).not.toHaveBeenCalled();
    expect(f.subscriptions).toHaveLength(0);
  });

  it('subscribes the own assignment list to actual assist and calendar changes', async () => {
    await render(<Assignments />);
    expect(f.subscriptions).toHaveLength(1);
    expect(f.subscriptions[0].options.specs).toEqual(expect.arrayContaining([
      { table: 'assignments', filter: 'employee_id=eq.employee-1' },
      { table: 'assist_visits', filter: 'employee_id=eq.employee-1' },
      { table: 'calendar_events', filter: 'tenant_id=eq.tenant-1' },
    ]));
    f.appointments.mockResolvedValue({ ok: true, data: [{ id: 'newly-assigned' }] });
    await act(async () => f.subscriptions[0].refresh());
    expect(host.textContent).toBe('newly-assigned|');
    expect(f.appointments).toHaveBeenLastCalledWith('account-1', 'employee_portal', 'tenant-1', 'employee-1', null, { preferCache: false });
  });

  it('retains native calendar and assignment subscription behavior', async () => {
    f.platform.OS = 'android';
    await render(<Calendar />);
    expect(f.subscriptions).toHaveLength(0);
    expect(f.calendar).toHaveBeenCalledOnce();
    await render(<Assignments />);
    expect(f.subscriptions).toHaveLength(1);
    expect(f.subscriptions[0].options.subscriptionKey).toBe('employee-portal:tenant-1:employee-1');
    expect(f.subscriptions[0].options.specs.map(spec => spec.table)).not.toContain('assist_visits');
    expect(f.subscriptions[0].options.specs.map(spec => spec.table)).not.toContain('calendar_events');
  });

  it('unsubscribes and stops browser refreshes after leaving the portal', async () => {
    await render(<Calendar />);
    await render(null);
    expect(f.subscriptions[0].cleanup).toHaveBeenCalledOnce();
    const calls = f.calendar.mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      visibility('hidden');
      visibility('visible');
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(f.calendar).toHaveBeenCalledTimes(calls);
  });
});
