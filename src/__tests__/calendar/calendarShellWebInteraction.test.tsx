// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import type { CalendarViewConfig } from '@/types/calendar';
import { buildDefaultTenantCalendarSettings } from '@/types/modules/calendarEvent';
import { calendarWorkspaceKey, saveCalendarWorkspace } from '@/lib/calendar/calendarWorkspaceState.web';

const f = vi.hoisted(() => ({
  tenant: 'tenant-a', user: 'user-a', role: 'business_admin', readOnly: false, denied: new Set<string>(),
  calendar: {} as any, planning: {} as any, settings: {} as any,
  grid: {} as any, planner: {} as any, settingsModal: {} as any, createModal: {} as any,
  calendarArgs: [] as any[], planningArgs: [] as any[], onEvent: vi.fn(),
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.user, roleKey: f.role }, user: { id: f.user } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (key: string) => !f.denied.has(key), isReadOnly: f.readOnly }) }));
vi.mock('@/hooks/useCalendarEvents.web', () => ({ useCalendarEvents: (...args: any[]) => { f.calendarArgs = args; return f.calendar; } }));
vi.mock('@/hooks/useEmployeeMonthPlanning.web', () => ({ useEmployeeMonthPlanning: (...args: any[]) => { f.planningArgs = args; return f.planning; } }));
vi.mock('@/hooks/useTenantCalendarSettings.web', () => ({ useTenantCalendarSettings: () => f.settings }));
vi.mock('@/lib/calendar/calendarEventSaveService', () => ({ resolveCalendarFormWritePermission: () => 'assist.assignments.manage' }));
vi.mock('@/components/calendar/EmployeePlanabilityBadge', () => ({ EmployeePlanabilityBadge: () => <span>Planbarkeit</span> }));
vi.mock('@/components/calendar/CalendarEventGrid.web', () => ({ CalendarEventGrid: (props: any) => {
  f.grid = props;
  return <div data-testid="calendar-grid">{props.events.map((event: CalendarEvent) => <button key={event.id} onClick={() => props.onEventPress(event)}>{event.title}</button>)}</div>;
} }));
vi.mock('@/components/calendar/OfficeAssignmentProfileCalendarPlanner.web', () => ({ OfficeAssignmentProfileCalendarPlanner: (props: any) => {
  f.planner = props; return <div>{props.children({ selectedProfileId: null })}</div>;
} }));
vi.mock('@/components/calendar/EmployeeMonthPlanningModal.web', () => ({ EmployeeMonthPlanningModal: (props: any) => <div role="dialog" aria-label="Verfügbarkeit bearbeiten"><span>{props.employeeId} {props.month}</span><button onClick={props.onSaved}>Planung bestätigen</button></div> }));
vi.mock('@/components/office/calendar/OfficeCalendarSettingsModal.web', () => ({ OfficeCalendarSettingsModal: (props: any) => {
  f.settingsModal = props; return props.visible ? <div role="dialog" aria-label="Kalendereinstellungen" /> : null;
} }));
vi.mock('@/components/calendar/CalendarEventCreateModal.web', () => ({ CalendarEventCreateModal: (props: any) => {
  f.createModal = props; return props.visible ? <div role="dialog" aria-label="Eintrag anlegen"><button onClick={props.onCreated}>Eintrag bestätigen</button></div> : null;
} }));
import { CalendarPageShell } from '@/components/calendar/CalendarPageShell.web';

const config = { moduleKey: 'assist', calendarScope: 'module', defaultView: 'month' } as CalendarViewConfig;
const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({ id: 'event-1', title: 'Besuch Erika', type: 'einsatz',
  sourceType: 'assist_visit', start: '2026-10-20T08:00:00Z', end: '2026-10-20T09:00:00Z', color: '#247bcc',
  status: 'geplant', employeeId: 'employee-1', employeeName: 'Alex Team', clientName: 'Erika Beispiel', ...overrides });
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { resolve, promise }; };
let host: HTMLDivElement, root: Root;
const initial = (view: CalendarViewMode = 'month', anchor = '2026-10-17') => saveCalendarWorkspace(calendarWorkspaceKey(f.tenant, f.user, 'assist', new URLSearchParams(location.search).get('csWindow') ?? ''), { view, anchor, employeeId: '', query: '', status: 'all' });
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 17, 12));
  sessionStorage.clear(); history.replaceState(null, '', '/');
  f.tenant = 'tenant-a'; f.user = 'user-a'; f.role = 'business_admin'; f.readOnly = false; f.denied = new Set(); f.onEvent.mockReset();
  f.calendar = { events: [event()], allEvents: [event()], calendarReady: true, loading: false, refreshing: false, error: null, refreshError: null, refresh: vi.fn(), refreshWithResult: vi.fn().mockResolvedValue(true) };
  f.planning = { employees: [{ id: 'employee-1', name: 'Alex Team' }, { id: 'employee-2', name: 'Alex Team' }], plans: [], absences: [], ready: true, loading: false, error: null, employeeError: null, refresh: vi.fn() };
  const settings = buildDefaultTenantCalendarSettings(f.tenant);
  f.settings = { settings, form: settings, saving: false, loading: false, error: null, refresh: vi.fn(), save: vi.fn().mockResolvedValue({ ok: true, data: settings }) };
  f.grid = {}; f.planner = {}; f.settingsModal = {}; f.createModal = {}; initial();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
const render = async () => { await act(async () => root.render(<CalendarPageShell config={config} onEventPress={f.onEvent} />)); };
const button = (text: string) => [...host.querySelectorAll('button')].find(element => element.textContent === text || element.getAttribute('aria-label') === text);
const press = async (text: string) => { const target = button(text); expect(target).toBeTruthy(); await act(async () => target!.click()); };
const change = async (label: string, value: string) => {
  const target = host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | HTMLSelectElement;
  expect(target).toBeTruthy();
  await act(async () => {
    const prototype = target instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    if (target instanceof HTMLInputElement && target.type === 'date') target.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('Web calendar workspace integration', () => {
  it('switches all six views and opens the selected event through the workspace callback', async () => {
    await render();
    for (const [label, view] of [['Tag', 'day'], ['Woche', 'week'], ['Monat', 'month'], ['Jahr', 'year'], ['Agenda', 'agenda'], ['Liste', 'list']]) {
      await press(label); expect(f.grid.viewMode).toBe(view);
    }
    await press('Besuch Erika'); expect(f.onEvent).toHaveBeenCalledExactlyOnceWith(f.calendar.events[0]);
  });

  it('clamps month changes, preserves chosen dates and navigates a week by seven days', async () => {
    initial('month', '2026-01-31'); await render(); await press('Nächster Zeitraum');
    expect(f.grid.anchor.getMonth()).toBe(1); expect(f.grid.anchor.getDate()).toBe(28);
    await change('Datum auswählen', '2026-10-25'); await press('Woche'); await press('Nächster Zeitraum');
    expect(f.grid.anchor.getMonth()).toBe(10); expect(f.grid.anchor.getDate()).toBe(1);
  });

  it('combines employee identity, search and status filters and resets them together', async () => {
    f.calendar.events = [event(), event({ id: 'other', title: 'Besuch Bea', clientName: 'Bea', employeeId: 'employee-2' }), event({ id: 'done', title: 'Besuch Erika erledigt', status: 'abgeschlossen' })];
    f.calendar.allEvents = f.calendar.events;
    await render(); await change('Kalender für Mitarbeitende', 'employee-2');
    expect(f.grid.events.map((value: CalendarEvent) => value.id)).toEqual(['other']);
    await change('Kalender für Mitarbeitende', 'employee-1'); await change('Kalender durchsuchen', 'ERIKA'); await change('Einsatzstatus filtern', 'scheduled');
    expect(f.grid.events.map((value: CalendarEvent) => value.id)).toEqual(['event-1']);
    await press('Filter zurücksetzen'); expect(f.grid.events).toHaveLength(3);
  });

  it('filters future planned tasks separately from past follow-up and ongoing visits', async () => {
    f.calendar.events = [
      event({ id: 'future', status: 'bestaetigt', isIncomplete: true }),
      event({ id: 'follow-up', status: 'bestaetigt', isIncomplete: true, start: '2026-10-07T08:00:00Z', end: '2026-10-07T09:00:00Z' }),
      event({ id: 'running', status: 'gestartet', isIncomplete: true, start: '2026-10-17T08:00:00Z', end: '2026-10-17T09:00:00Z' }),
    ];
    f.calendar.allEvents = f.calendar.events;
    await render();
    const statusFilter = host.querySelector('[aria-label="Einsatzstatus filtern"]') as HTMLSelectElement;
    expect(statusFilter.querySelector('[value="scheduled"]')?.textContent).toBe('Geplant / bestätigt');
    expect(statusFilter.querySelector('[value="open"]')?.textContent).toBe('Nacharbeit offen');
    for (const [state, id] of [['scheduled', 'future'], ['open', 'follow-up'], ['active', 'running']]) {
      await change('Einsatzstatus filtern', state);
      expect(f.grid.events.map((value: CalendarEvent) => value.id)).toEqual([id]);
    }
  });

  it('restores view, date and filters on remount without letting server defaults override them', async () => {
    await render(); await press('Woche'); await change('Kalender für Mitarbeitende', 'employee-2'); await change('Kalender durchsuchen', 'Alex'); await change('Datum auswählen', '2026-10-25');
    await act(async () => root.unmount()); root = createRoot(host); f.settings.settings.defaultView = 'year'; await render();
    expect(f.grid.viewMode).toBe('week'); expect(f.grid.anchor.getDate()).toBe(25);
    expect((host.querySelector('[aria-label="Kalender für Mitarbeitende"]') as HTMLSelectElement).value).toBe('employee-2');
    expect((host.querySelector('[aria-label="Kalender durchsuchen"]') as HTMLInputElement).value).toBe('Alex');
  });

  it('does not carry filters or open forms into another tenant, user or desktop window', async () => {
    await render(); await change('Kalender durchsuchen', 'Erika'); await press('Neuer Eintrag');
    f.tenant = 'tenant-b'; await render(); expect(f.createModal.visible).toBe(false); expect((host.querySelector('[aria-label="Kalender durchsuchen"]') as HTMLInputElement).value).toBe('');
    await change('Kalender durchsuchen', 'Bea'); f.user = 'user-b'; await render(); expect((host.querySelector('[aria-label="Kalender durchsuchen"]') as HTMLInputElement).value).toBe('');
    await change('Kalender durchsuchen', 'Anna'); history.replaceState(null, '', '/?csWindow=other'); await render(); expect((host.querySelector('[aria-label="Kalender durchsuchen"]') as HTMLInputElement).value).toBe('');
  });

  it('keeps complete scheduling disabled after a partial refresh and exposes a retry', async () => {
    await render(); await change('Kalender für Mitarbeitende', 'employee-1');
    f.calendar.calendarReady = false; f.calendar.refreshError = 'Abwesenheiten konnten nicht sicher geprüft werden.'; await render();
    expect(f.planner.dataReady).toBe(false); expect(button('Verfügbarkeit')?.disabled).toBe(true);
    expect(host.textContent).toContain('Abwesenheiten konnten nicht sicher geprüft werden.');
    await press('Erneut laden'); expect(f.calendar.refresh).toHaveBeenCalledOnce(); expect(f.planning.refresh).toHaveBeenCalledOnce();
  });

  it('closes the confirmed creation flow and preserves its current month', async () => {
    await render(); await press('Neuer Eintrag'); expect(f.createModal.visible).toBe(true); await press('Eintrag bestätigen');
    // Confirmed mutation notifications and the actual hooks' reload are covered
    // together in the dialog and hook suites; this test isolates shell state.
    expect(f.createModal.visible).toBe(false); expect(f.grid.anchor.getMonth()).toBe(9);
  });

  it('keeps failed settings open and applies the new view only after a successful save', async () => {
    await render(); await press('Kalendereinstellungen öffnen');
    f.settings.save.mockResolvedValueOnce({ ok: false, error: 'Nicht gespeichert' });
    await act(async () => { await expect(f.settingsModal.onSave({ ...f.settings.form, defaultView: 'week' })).rejects.toThrow('Nicht gespeichert'); });
    expect(f.settingsModal.visible).toBe(true); expect(f.grid.viewMode).toBe('month');
    await act(async () => { await f.settingsModal.onSave({ ...f.settings.form, defaultView: 'week' }); });
    expect(f.settingsModal.visible).toBe(false); expect(f.grid.viewMode).toBe('week');
  });

  it('ignores the old settings result after changing identity', async () => {
    const pending = deferred(); f.settings.save.mockReturnValue(pending.promise);
    await render(); await press('Kalendereinstellungen öffnen'); let saving!: Promise<void>;
    await act(async () => { saving = f.settingsModal.onSave({ ...f.settings.form, defaultView: 'year' }); });
    f.tenant = 'tenant-b'; await render();
    await act(async () => { pending.resolve({ ok: true }); await saving; });
    expect(f.grid.viewMode).toBe('month');
  });

  it('removes write actions in read-only mode while keeping the calendar navigable', async () => {
    f.readOnly = true; await render();
    expect(button('Neuer Eintrag')).toBeUndefined(); expect(button('Kalendereinstellungen öffnen')).toBeUndefined(); expect(f.planner.readOnly).toBe(true);
    await press('Liste'); expect(f.grid.viewMode).toBe('list');
  });
});
