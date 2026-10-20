// @vitest-environment happy-dom
// Real Web list, filters and query hook. Isolated route/modal/service boundaries; no layout claim.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignmentListItem } from '@/types/modules/assist';
import type { RoleKey } from '@/types';
const f = vi.hoisted(() => ({ tenant: 'tenant-a', actor: 'actor-a', readonly: false, canView: true, canManage: true, canExecute: true,
  roleKey: 'business_admin' as RoleKey | null, focused: true,
  list: vi.fn(), remove: vi.fn(), confirm: vi.fn(), push: vi.fn(), back: vi.fn(), setParams: vi.fn(), selected: vi.fn(),
  params: {} as { create?: string | string[]; clientId?: string | string[]; assignmentDate?: string | string[]; employeeId?: string | string[] }, createProps: {} as any,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: f.push, back: f.back, setParams: f.setParams }), useLocalSearchParams: () => f.params, useIsFocused: () => f.focused }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ push: f.push, back: f.back }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.actor, roleKey: f.roleKey } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (permission: string) => permission === 'assist.execution.manage' ? f.canExecute : permission.endsWith('.view') ? f.canView : f.canManage, isReadOnly: f.readonly, roleKey: f.roleKey }) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({ isLiveConnected: false }), DEFAULT_LIVE_POLL_MS: 30000 }));
vi.mock('@/hooks/core', async () => ({ useAsyncQuery: (await import('@/hooks/core/useAsyncQuery')).useAsyncQuery, OPERATIONAL_LIVE_POLL_MS: 15000 }));
vi.mock('@/lib/realtime', () => ({ subscribeToAssistOperationsChanges: vi.fn() }));
vi.mock('@/lib/assist', () => ({ fetchAssignmentList: f.list }));
vi.mock('@/lib/assist/visitService', () => ({ deleteVisitDisposition: f.remove }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: f.confirm }));
vi.mock('@/hooks/useDesktopListViewPreference', async () => { const { useState } = await import('react'); return { useDesktopListViewPreference: () => { const [viewMode, setViewMode] = useState('cards'); return { viewMode, setViewMode }; } }; });
vi.mock('@/hooks/usePageFlag', async () => { const { useState } = await import('react'); return { usePageFlag: (_: string, initial: boolean) => useState(initial) }; });
vi.mock('@/hooks/usePageRecord', async () => { const { useState } = await import('react'); return { usePageRecord: (_: string, initial: unknown) => useState(initial) }; });
vi.mock('@/hooks/usePageTab', async () => { const { useState } = await import('react'); return { usePageTab: (_: string, initial: unknown) => useState(initial) }; });
vi.mock('@/components/assist/AssignmentCreateForm.web', () => ({ AssignmentCreateForm: (props: any) => {
  f.createProps = props;
  return props.visible ? <section aria-label="Einsatzformular"><span>{props.initialClientId || 'Keine Vorauswahl'}</span><button onClick={() => props.onCreated('created-id')}>Erstellung bestätigt</button><button onClick={props.onClose}>Formular schließen</button></section> : null;
} }));
vi.mock('@/components/assist/AssignmentDetailGlassModal.web', () => ({ AssignmentDetailGlassModal: ({ visible, assignmentId, onClose }: any) => visible ? <section aria-label="Einsatzdetails"><span>{assignmentId}</span><button onClick={onClose}>Details schließen</button></section> : null }));
import { AssignmentsListView } from '@/components/assist/AssignmentsListView.web';
import { AssignmentsListScreen } from '@/screens/assist/AssignmentsListScreen.web';

const rows = (): AssignmentListItem[] => [
  { id: 'visit-a', tenantId: f.tenant, clientName: 'Anna Muster', employeeId: 'employee-a', employeeName: 'Tom Test', title: 'Haushalt', serviceName: 'Haushalt', scheduledStart: '2026-10-16T08:00:00Z', scheduledEnd: '2026-10-16T09:00:00Z', assignmentStatus: 'geplant', status: 'aktiv', location: 'Herne', updatedAt: '2026-10-16T07:00:00Z' },
  { id: 'visit-b', tenantId: f.tenant, clientName: 'Berta Beispiel', employeeId: 'employee-b', employeeName: 'Kim Beispiel', title: 'Begleitung', serviceName: 'Begleitung', scheduledStart: '2026-10-16T11:00:00Z', scheduledEnd: '2026-10-16T12:00:00Z', assignmentStatus: 'bestaetigt', status: 'aktiv', location: 'Dortmund', updatedAt: '2026-10-16T07:00:00Z' },
];
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-16T09:00:00Z')); vi.clearAllMocks();
  f.tenant = 'tenant-a'; f.actor = 'actor-a'; f.readonly = false; f.canView = true; f.canManage = true; f.canExecute = true; f.roleKey = 'business_admin'; f.focused = true; f.params = {}; f.createProps = {};
  f.list.mockImplementation(async () => ({ ok: true, data: rows() })); f.confirm.mockResolvedValue(true); f.remove.mockResolvedValue({ ok: true, data: { id: 'visit-a' } });
  f.setParams.mockImplementation((params: any) => { f.params = { ...f.params, ...params }; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
async function mount(props: React.ComponentProps<typeof AssignmentsListView> = {}) { await act(async () => root.render(<AssignmentsListView {...props}/>)); }
async function screen() { await act(async () => root.render(<AssignmentsListScreen/>)); }
function button(label: string) { const match = [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label || b.textContent === label); expect(match, label).toBeTruthy(); return match!; }
async function click(label: string) { await act(async () => button(label).click()); }
function clients() { return [...host.querySelectorAll('.awl-name')].map(node => node.textContent); }
async function choose(label: string, value: string) {
  const select = [...host.querySelectorAll('label')].find(node => node.querySelector('span.aw-label')?.textContent === label)?.querySelector('select'); expect(select, label).toBeTruthy();
  await act(async () => { select!.value = value; select!.dispatchEvent(new Event('change', { bubbles: true })); });
}
describe('Web assignment list controls and record actions', () => {
  it('carries the selected tour day and employee into planning and resets them for a fresh creation', async () => {
    f.params = { create: ['1'], assignmentDate: ['2026-11-03', '2026-11-04'], employeeId: ['employee-b', 'ignored'] };
    await screen();
    expect(f.createProps).toMatchObject({ visible: true, initialAssignmentDate: '2026-11-03', initialEmployeeId: 'employee-b' });
    await click('Formular schließen'); await click('Neuer Einsatz');
    expect(f.createProps).toMatchObject({ visible: true, initialAssignmentDate: null, initialEmployeeId: null });
  });
  it('rejects impossible route dates and does not consume a creation link in a background workspace', async () => {
    f.params = { create: '1', assignmentDate: '2026-02-31', employeeId: 'employee-b' }; f.focused = false;
    await screen(); expect(f.setParams).not.toHaveBeenCalled(); expect(f.createProps.visible).toBe(false);
    f.focused = true; await screen();
    expect(f.createProps).toMatchObject({ visible: true, initialAssignmentDate: null, initialEmployeeId: 'employee-b' });
  });
  it('opens distinct detail, edit and execution targets for the selected record', async () => {
    await mount(); await click('Anna Muster'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-a');
    await click('Einsatz für Anna Muster bearbeiten'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-a/edit');
    await click('Durchführung und Nachbearbeitung für Anna Muster öffnen'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-a/execute');
  });
  it('lets dispatch execute with read-only Office data and without assignment manage permission', async () => {
    f.roleKey = 'dispatch'; f.readonly = true; f.canManage = false; await mount();
    await click('Durchführung und Nachbearbeitung für Anna Muster öffnen');
    expect(f.push).toHaveBeenCalledWith('/assist/assignments/visit-a/execute');
    expect(host.querySelector('[aria-label="Einsatz für Anna Muster bearbeiten"]')).toBeNull();
    f.canExecute = false; await mount();
    expect(host.querySelector('[aria-label="Durchführung und Nachbearbeitung für Anna Muster öffnen"]')).toBeNull();
  });
  it('does not grant execution from assignment manage permission alone', async () => {
    f.canExecute = false; await mount();
    expect(host.querySelector('[aria-label="Einsatz für Anna Muster bearbeiten"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Durchführung und Nachbearbeitung für Anna Muster öffnen"]')).toBeNull();
  });
  it('uses the embedded detail callback without navigating away', async () => {
    await mount({ onAssignmentPress: f.selected, embedded: true }); await click('Berta Beispiel');
    expect(f.selected).toHaveBeenCalledWith('visit-b'); expect(f.push).not.toHaveBeenCalled();
  });
  it('filters with real inputs, changes view, sorts and clears the search', async () => {
    await mount(); expect(clients()).toEqual(['Anna Muster', 'Berta Beispiel']);
    const search = host.querySelector('input[type=search]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Dortmund'); search.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(clients()).toEqual(['Berta Beispiel']); await click('Suche leeren'); await click('Tabellenansicht');
    expect(host.querySelector('table')).not.toBeNull(); await click('Termin ↑'); expect(clients()).toEqual(['Berta Beispiel', 'Anna Muster']);
    await click('Weitere Filter'); await choose('Mitarbeitende', 'employee-a'); expect(clients()).toEqual(['Anna Muster']);
    await click('Filter zurücksetzen · Heute'); expect(clients()).toEqual(['Anna Muster', 'Berta Beispiel']);
  });
  it('opens the create flow and returns to the concrete created record', async () => {
    await mount(); await click('Neuer Einsatz'); expect(host.querySelector('[aria-label="Einsatzformular"]')).not.toBeNull();
    await click('Erstellung bestätigt'); expect(f.push).toHaveBeenCalledWith('/assist/assignments/created-id');
    expect(host.querySelector('[aria-label="Einsatzformular"]')).toBeNull(); expect(f.list.mock.calls.length).toBeGreaterThan(1);
  });
  it('consumes an array create query once with the requested client and keeps modal selection local', async () => {
    f.params = { create: ['1'], clientId: ['client-a', 'ignored'] }; await screen();
    expect(f.createProps.visible).toBe(true); expect(f.createProps.initialClientId).toBe('client-a');
    expect(f.setParams).toHaveBeenCalledWith({ create: undefined, clientId: undefined, assignmentDate: undefined, employeeId: undefined });
    await click('Formular schließen'); await click('Anna Muster'); expect(host.querySelector('[aria-label="Einsatzdetails"]')?.textContent).toContain('visit-a');
    expect(f.push).not.toHaveBeenCalled();
  });
  it('lets dispatch plan the requested client without permission to edit Office master data', async () => {
    f.roleKey = 'dispatch'; f.readonly = true;
    f.params = { create: '1', clientId: 'client-a' }; await screen();
    expect(f.createProps.visible).toBe(true); expect(f.createProps.initialClientId).toBe('client-a');
    expect(f.setParams).toHaveBeenCalledWith({ create: undefined, clientId: undefined, assignmentDate: undefined, employeeId: undefined });
    await click('Formular schließen'); await click('Neuer Einsatz');
    expect(host.querySelector('[aria-label="Einsatzformular"]')).not.toBeNull();
  });
  it('requires assignment view as well as manage before consuming a create link', async () => {
    f.canView = false; f.params = { create: '1', clientId: 'client-a' }; await screen();
    expect(f.list).not.toHaveBeenCalled(); expect(f.setParams).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Einsatzformular"]')).toBeNull();
  });
  it.each(['employee_portal', 'client_portal', 'family_portal', null] as const)('rejects a %s session even with stale assignment permissions', async (roleKey) => {
    f.roleKey = roleKey; f.params = { create: '1', clientId: 'client-a' }; await screen();
    expect(f.list).not.toHaveBeenCalled(); expect(f.setParams).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Einsatzformular"]')).toBeNull();
    expect(host.querySelector('[aria-label="Durchführung und Nachbearbeitung für Anna Muster öffnen"]')).toBeNull();
    expect(host.textContent).toContain('keine Berechtigung');
  });
  it('never deletes a cancelled confirmation and leaves a failed delete visible', async () => {
    f.confirm.mockResolvedValueOnce(false); await mount(); await click('Einsatz für Anna Muster löschen'); expect(f.remove).not.toHaveBeenCalled();
    f.remove.mockResolvedValueOnce({ ok: false, error: 'Nachweise verhindern das Löschen' }); await click('Einsatz für Anna Muster löschen');
    expect(f.remove).toHaveBeenCalledOnce(); expect(clients()).toContain('Anna Muster'); expect(host.textContent).toContain('Nachweise verhindern das Löschen');
    expect(host.textContent).not.toContain('Der Einsatz wurde gelöscht.');
  });
  it('serializes delete confirmation and removes only the confirmed record after success', async () => {
    const confirmation = deferred(); f.confirm.mockReturnValue(confirmation.promise); await mount(); const remove = button('Einsatz für Anna Muster löschen');
    await act(async () => { remove.click(); remove.click(); }); expect(f.confirm).toHaveBeenCalledOnce(); expect(f.remove).not.toHaveBeenCalled();
    await act(async () => confirmation.resolve(true)); expect(f.remove).toHaveBeenCalledOnce(); expect(clients()).toEqual(['Berta Beispiel']);
    expect(host.textContent).toContain('Der Einsatz wurde gelöscht.');
  });
  it('does not delete after switching company while confirmation is open', async () => {
    const confirmation = deferred(); f.confirm.mockReturnValue(confirmation.promise); await mount(); await click('Einsatz für Anna Muster löschen');
    f.tenant = 'tenant-b'; await mount(); await act(async () => confirmation.resolve(true));
    expect(f.remove).not.toHaveBeenCalled(); expect(clients()).toHaveLength(2);
  });
  it('hides every mutation action without assignment manage permission and does not load unauthorized lists', async () => {
    f.readonly = true; f.canManage = false; await mount();
    expect([...host.querySelectorAll('button')].some(b => /Neuer Einsatz|bearbeiten|löschen/.test(b.getAttribute('aria-label') || b.textContent || ''))).toBe(false);
    await click('Anna Muster'); expect(f.push).toHaveBeenCalledWith('/assist/assignments/visit-a');
    await act(async () => root.render(<span/>)); f.list.mockClear(); f.canView = false; await mount();
    expect(f.list).not.toHaveBeenCalled(); expect(host.textContent).toContain('keine Berechtigung');
  });
  it('does not delete after assignment manage permission is revoked during confirmation', async () => {
    const confirmation = deferred(); f.confirm.mockReturnValue(confirmation.promise); await mount();
    await click('Einsatz für Anna Muster löschen'); f.canManage = false; await mount();
    await act(async () => confirmation.resolve(true)); expect(f.remove).not.toHaveBeenCalled();
    expect(clients()).toHaveLength(2);
  });
});
