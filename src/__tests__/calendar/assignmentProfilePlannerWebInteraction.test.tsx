// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientAssignmentProfile } from '@/types/modules/clientAssignmentProfile';
import type { AssignmentProfileDateSelection } from '@/components/calendar/AssignmentProfileDateSelection';

const f = vi.hoisted(() => ({
  tenant: 'tenant-a', profiles: [] as ClientAssignmentProfile[], loading: false,
  error: null as string | null, refreshError: null as string | null,
  refresh: vi.fn(), schedule: vi.fn(), modal: {} as Record<string, any>,
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 1440, height: 900 }),
  StyleSheet: { create: (s: unknown) => s },
  View: ({ children, ref }: any) => <div ref={ref}>{children}</div>, ScrollView: ({ children }: any) => <div>{children}</div>,
  Text: ({ children, accessibilityRole }: any) => <span role={accessibilityRole}>{children}</span>,
  Pressable: ({ children, onPress, disabled, accessibilityLabel, accessibilityState }: any) => <button aria-label={accessibilityLabel} aria-expanded={accessibilityState?.expanded} aria-pressed={accessibilityState?.selected} disabled={disabled} onClick={onPress}>{children}</button>,
  TextInput: ({ value, onChangeText, accessibilityLabel }: any) => <input aria-label={accessibilityLabel} value={value} onChange={(event) => onChangeText(event.target.value)} />,
}));
vi.mock('@/components/ui', () => ({
  PremiumButton: ({ title, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{title}</button>,
  LoadingState: ({ message }: any) => <span>{message}</span>,
  ErrorState: ({ message, onRetry }: any) => <div>{message}<button onClick={onRetry}>Neu laden</button></div>,
  EmptyState: ({ title, actionLabel, onAction }: any) => <div>{title}<button onClick={onAction}>{actionLabel}</button></div>,
}));
vi.mock('@/components/layout/platform/AppGlassModal', () => ({ AppGlassModal: (props: any) => {
  f.modal = props;
  return props.visible ? <div role="dialog">{props.children}{props.footerActions.map((a: any) => <button key={a.title} disabled={a.disabled} onClick={a.onPress}>{a.title}</button>)}</div> : null;
} }));
vi.mock('@/components/inputs/CareTimeInput', () => ({ CareTimeInput: (props: any) => <input aria-label="Startzeit" value={props.value} onChange={(event) => props.onChange(event.target.value)} /> }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: () => ({
  data: f.profiles, loading: f.loading, error: f.error, refreshError: f.refreshError, refresh: f.refresh,
}) }));
vi.mock('@/lib/realtime', () => ({ subscribeToClientAssignmentProfileChanges: vi.fn() }));
vi.mock('@/lib/office/clientAssignmentProfileService', () => ({
  listClientAssignmentProfiles: vi.fn(), scheduleClientAssignmentProfile: f.schedule,
}));
import { OfficeAssignmentProfileCalendarPlanner } from '@/components/calendar/OfficeAssignmentProfileCalendarPlanner.web';
import { useAssignmentProfileDateSelection } from '@/components/calendar/AssignmentProfileDateSelection';

let host: HTMLDivElement; let root: Root;
let drop: (id: string, date: Date, time?: string) => void;
let selection: AssignmentProfileDateSelection | null;
let selectedProfile: string | null;
const day = (date = 19) => new Date(2026, 9, date, 12);
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
const profile = (overrides: Partial<ClientAssignmentProfile> = {}) => ({
  id: 'profile-a', tenantId: 'tenant-a', clientId: 'client-a', employeeId: 'employee-a',
  employeeName: 'Anna Test', clientName: 'Klient A', profileName: 'Haushalt',
  assignmentTitle: 'Haushalt', taskTitles: ['Einkaufen'], durationMinutes: 60, isActive: true,
  ...overrides,
}) as ClientAssignmentProfile;
function Calendar() {
  selection = useAssignmentProfileDateSelection();
  return <div data-cs-assignment-drop-date="2026-10-19" data-cs-assignment-drop-time="10:00">Kalender</div>;
}
const render = async ({ readOnly = false, dataReady = true, employeeIdFilter, onScheduled = vi.fn(async () => true) }: {
  readOnly?: boolean; dataReady?: boolean; employeeIdFilter?: string; onScheduled?: () => Promise<boolean>;
} = {}) => {
  await act(async () => root.render(<OfficeAssignmentProfileCalendarPlanner readOnly={readOnly} dataReady={dataReady} employeeIdFilter={employeeIdFilter} onScheduled={onScheduled}>
    {(state) => { drop = state.onProfileDrop; selectedProfile = state.selectedProfileId; return <Calendar />; }}
  </OfficeAssignmentProfileCalendarPlanner>));
  return onScheduled;
};
const byText = (text: string) => [...host.querySelectorAll('button')].find((button) => button.textContent === text);
const click = async (text: string) => { await act(async () => { const button = byText(text); if (!button) throw new Error(`Button fehlt: ${text}`); button.click(); }); };
const clickLabel = async (label: string) => { await act(async () => { const button = host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`); if (!button) throw new Error(`Button fehlt: ${label}`); button.click(); }); };
const chooseProfile = async () => {
  await clickLabel('Einsatzprofile öffnen');
  await clickLabel('Anna Test, 1 Einsatzprofile');
  await clickLabel('Einsatzprofil Haushalt auswählen');
};
const mark = async (date: number, count = 1) => { await act(async () => selection?.selectDate(day(date), count)); };
const openDrop = async (id = 'profile-a', date = day(), time = '09:00') => { await act(async () => drop(id, date, time)); };

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); f.tenant = 'tenant-a'; f.profiles = [profile()]; f.loading = false; f.error = null; f.refreshError = null; f.modal = {};
  f.refresh.mockResolvedValue(true); f.schedule.mockResolvedValue({ ok: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Web calendar profile planning', () => {
  it('enables date selection only while open, preserves it when collapsed and supports exclusive double-click selection', async () => {
    await render(); expect(selection).toBeNull(); expect(host.textContent).toContain('Kalender');
    await chooseProfile(); await mark(19); await mark(21);
    expect(selection?.selectedDateKeys).toEqual(['2026-10-19', '2026-10-21']);
    await clickLabel('Einsatzprofile einklappen'); expect(selection).toBeNull(); expect(selectedProfile).toBeNull(); expect(host.textContent).toContain('2 Tage ausgewählt');
    await clickLabel('Einsatzprofile öffnen'); expect(selectedProfile).toBe('profile-a');
    await mark(22, 2); expect(selection?.selectedDateKeys).toEqual(['2026-10-22']);
  });
  it('releases all selected days once at the chosen shared time', async () => {
    const refresh = await render(); await chooseProfile(); await mark(19); await mark(21);
    await openDrop('profile-a', day(19), '930');
    await click('2 Einsätze freigeben');
    expect(f.schedule.mock.calls).toEqual([
      ['tenant-a', 'profile-a', '2026-10-19', '09:30'],
      ['tenant-a', 'profile-a', '2026-10-21', '09:30'],
    ]);
    expect(refresh).toHaveBeenCalledOnce(); expect(host.querySelector('[role=dialog]')).toBeNull();
    expect(host.textContent).toContain('2 Einsätze um 09:30 Uhr freigegeben.');
  });
  it('retries only unsaved days after a partial failure and keeps the shared start time', async () => {
    f.schedule.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: 'Zeit überschneidet sich.' }).mockResolvedValueOnce({ ok: true });
    await render(); await chooseProfile(); await mark(19); await mark(21); await openDrop('profile-a', day(19), '10:00');
    await click('2 Einsätze freigeben');
    expect(host.textContent).toContain('Gespeichert: 1 von 2'); expect(host.querySelector('[aria-label=Startzeit]')).toBeNull();
    await click('Einsatz direkt freigeben');
    expect(f.schedule.mock.calls.map((call) => call.slice(2))).toEqual([
      ['2026-10-19', '10:00'], ['2026-10-21', '10:00'], ['2026-10-21', '10:00'],
    ]);
  });
  it('keeps partial success and retry dates while the calendar refresh temporarily blocks new actions', async () => {
    const refresh = deferred<boolean>();
    const onScheduled = vi.fn().mockReturnValueOnce(refresh.promise).mockResolvedValue(true);
    f.schedule.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: 'Zeit überschneidet sich.' }).mockResolvedValueOnce({ ok: true });
    await render({ onScheduled }); await chooseProfile(); await mark(19); await mark(21); await openDrop('profile-a', day(19), '10:00');
    await click('2 Einsätze freigeben'); expect(host.textContent).toContain('Gespeichert: 1 von 2');
    await render({ onScheduled, dataReady: false });
    expect(host.querySelector('[role=dialog]')).not.toBeNull(); expect(host.textContent).toContain('Kalenderdaten werden geprüft');
    expect(selection?.selectedDateKeys).toEqual(['2026-10-21']); expect(byText('Einsatz direkt freigeben')?.disabled).toBe(true);
    await act(async () => refresh.resolve(true));
    await render({ onScheduled, dataReady: true });
    expect(host.textContent).toContain('Gespeichert: 1 von 2'); expect(byText('Einsatz direkt freigeben')?.disabled).toBe(false);
    await click('Einsatz direkt freigeben');
    expect(f.schedule.mock.calls.map((call) => call.slice(2))).toEqual([
      ['2026-10-19', '10:00'], ['2026-10-21', '10:00'], ['2026-10-21', '10:00'],
    ]);
  });
  it('blocks new date selections and drops until calendar data is ready without discarding the selection', async () => {
    await render(); await chooseProfile(); await mark(19);
    await render({ dataReady: false }); expect(selection?.disabled).toBe(true);
    await mark(21); await openDrop(); expect(selection?.selectedDateKeys).toEqual(['2026-10-19']);
    expect(host.querySelector('[role=dialog]')).toBeNull(); expect(f.schedule).not.toHaveBeenCalled();
    await render({ dataReady: true }); expect(selection?.disabled).toBe(false); expect(selectedProfile).toBe('profile-a');
  });
  it('blocks duplicate submissions and cancels remaining old-tenant days after a tenant change', async () => {
    const pending = deferred<any>(); f.schedule.mockReturnValueOnce(pending.promise);
    const refresh = await render(); await chooseProfile(); await mark(19); await mark(21); await openDrop();
    const submit = f.modal.footerActions[1].onPress;
    await act(async () => { void submit(); void submit(); }); expect(f.schedule).toHaveBeenCalledOnce();
    f.tenant = 'tenant-b'; f.profiles = [profile({ id: 'profile-b', tenantId: 'tenant-b' })]; await render({ onScheduled: refresh });
    await act(async () => pending.resolve({ ok: true }));
    expect(f.schedule).toHaveBeenCalledOnce(); expect(refresh).not.toHaveBeenCalled(); expect(host.querySelector('[role=dialog]')).toBeNull(); expect(selection?.selectedDateKeys).toEqual([]);
    await openDrop('profile-b'); await click('Einsatz direkt freigeben'); expect(f.schedule).toHaveBeenCalledTimes(2);
  });
  it('clears selection for employee-filter changes and rejects hidden or read-only profiles', async () => {
    f.profiles = [profile(), profile({ id: 'profile-b', employeeId: 'employee-b', employeeName: 'Ben Test' })];
    await render({ employeeIdFilter: 'employee-a' }); await chooseProfile(); await mark(19);
    await render({ employeeIdFilter: 'employee-b' }); expect(selection?.selectedDateKeys).toEqual([]); expect(selectedProfile).toBeNull();
    await openDrop(); expect(host.querySelector('[role=dialog]')).toBeNull();
    await render({ readOnly: true }); expect(selection).toBeNull(); await openDrop(); expect(host.querySelector('[role=dialog]')).toBeNull(); expect(f.schedule).not.toHaveBeenCalled();
  });
  it('keeps equally named employees as separate selectable groups', async () => {
    f.profiles = [profile(), profile({ id: 'profile-b', employeeId: 'employee-b', profileName: 'Begleitung' })];
    await render(); await clickLabel('Einsatzprofile öffnen');
    const groups = host.querySelectorAll<HTMLButtonElement>('[aria-label="Anna Test, 1 Einsatzprofile"]');
    expect(groups).toHaveLength(2);
    await act(async () => groups[0].click()); expect(host.querySelector('[aria-label="Einsatzprofil Haushalt auswählen"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Einsatzprofil Begleitung auswählen"]')).toBeNull();
  });
  it('does not retry uncertain writes and preserves saved feedback when refresh fails', async () => {
    f.schedule.mockRejectedValueOnce(new Error('Verbindung unterbrochen'));
    const refresh = await render({ onScheduled: vi.fn(async () => false) }); await openDrop(); await click('Einsatz direkt freigeben');
    expect(refresh).toHaveBeenCalledOnce(); expect(host.textContent).toContain('Speicherung konnte nicht bestätigt');
    expect(byText('Einsatz direkt freigeben')?.disabled).toBe(true); expect(host.textContent).toContain('Kalender konnte nicht aktualisiert');
    await click('Schließen'); expect(host.querySelector('[role=dialog]')).toBeNull();
  });
  it('prevents invalid dates, invalid start times and removed profiles from scheduling', async () => {
    await render(); await openDrop('profile-a', new Date(NaN)); expect(host.querySelector('[role=dialog]')).toBeNull();
    await openDrop('profile-a', day(), '25:99'); expect(byText('Einsatz direkt freigeben')?.disabled).toBe(true);
    await click('Abbrechen'); await openDrop(); f.profiles = []; await render();
    expect(host.textContent).toContain('Einsatzprofil ist nicht mehr verfügbar'); expect(byText('Einsatz direkt freigeben')?.disabled).toBe(true); expect(f.schedule).not.toHaveBeenCalled();
  });
  it('accepts only this planner’s drag on its own calendar and clears drag state after dropping', async () => {
    await render(); await chooseProfile();
    const card = host.querySelector<HTMLDivElement>('[draggable="true"]')!;
    const target = host.querySelector<HTMLElement>('[data-cs-assignment-drop-date]')!;
    const transfer = new DataTransfer();
    const point = vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);
    await act(async () => window.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true })));
    expect(host.querySelector('[role=dialog]')).toBeNull();
    await act(async () => card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: transfer, bubbles: true })));
    expect(document.documentElement.dataset.csAssignmentProfileDragging).toBe('true');
    await act(async () => window.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true })));
    expect(host.querySelector('[role=dialog]')).not.toBeNull();
    expect(document.documentElement.dataset.csAssignmentProfileDragging).toBeUndefined();
    await click('Abbrechen');
    const outside = document.createElement('div'); outside.dataset.csAssignmentDropDate = '2026-10-20'; document.body.append(outside);
    point.mockReturnValue(outside);
    await act(async () => card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: transfer, bubbles: true })));
    await act(async () => window.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true })));
    expect(host.querySelector('[role=dialog]')).toBeNull(); expect(f.schedule).not.toHaveBeenCalled();
    outside.remove(); point.mockRestore();
  });
  it('surfaces profile refresh failures while collapsed and retains a working retry', async () => {
    f.refreshError = 'Profilabruf fehlgeschlagen'; await render(); expect(host.textContent).toContain('Profilabruf fehlgeschlagen'); await click('Neu laden'); expect(f.refresh).toHaveBeenCalledOnce();
  });
});
