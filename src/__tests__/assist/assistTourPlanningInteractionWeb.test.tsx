// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { AssistReplacementCandidate, AssistTourPlanningSnapshot, AssistTourVisit } from '@/lib/assist/assistTourPlanningModel.web';

type Params = Record<string, string | string[] | undefined>;
const state = vi.hoisted(() => ({
  tenant: 'tenant-a' as string | null, user: 'user-a' as string | null,
  role: 'business_admin' as RoleKey | null, authReady: true, authenticated: true, portalSession: false, focused: true,
  permissions: [] as PermissionKey[], params: {} as Params,
  fetch: vi.fn(), candidates: [] as AssistReplacementCandidate[], setParams: vi.fn(), push: vi.fn(), live: vi.fn(),
}));
const router = { setParams: state.setParams, push: state.push };
vi.mock('expo-router', () => ({ useRouter: () => router, useLocalSearchParams: () => state.params, useIsFocused: () => state.focused }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: state.user ? { id: state.user } : null, authReady: state.authReady, isAuthenticated: state.authenticated, portalSession: state.portalSession }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => state.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: state.role, permissions: state.permissions, can: (permission: PermissionKey) => state.permissions.includes(permission) }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children, contentOwnsHeader }: any) => <main data-own-header={String(contentOwnsHeader)}>{children}</main> }));
vi.mock('@/components/assist/MobilityWorkspaceNav.web', () => ({ MobilityWorkspaceNav: ({ active }: { active: string }) => <nav data-active={active} /> }));
vi.mock('@/lib/assist/assistTourPlanningService.web', () => ({ fetchAssistTourPlanning: (...args: unknown[]) => state.fetch(...args) }));
vi.mock('@/lib/assist/assistTourPlanningModel.web', () => ({ getAssistReplacementCandidates: () => state.candidates }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60000, useLiveRefresh: (options: unknown) => { state.live(options); return { isLiveConnected: false }; } }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
import { AssistTourPlanningWorkspace } from '@/screens/assist/AssistTourPlanningWorkspace.web';

const permissions: PermissionKey[] = ['assist.access', 'assist.assignments.view', 'assist.assignments.manage'];
const visit = (id: string, clientName: string, overrides: Partial<AssistTourVisit> = {}): AssistTourVisit => ({
  id, clientId: 'client-' + id, clientName, address: 'Testweg 4, 44623 Herne', title: 'Alltagsbegleitung',
  employeeId: 'employee-a', employeeName: 'Anna Adler', scheduledStart: '2026-10-20T08:00:00Z', scheduledEnd: '2026-10-20T09:00:00Z',
  durationMinutes: 60, status: 'confirmed', statusLabel: 'Bestätigt', issues: [], canReassign: true, isVirtual: false, ...overrides,
});
const visits = () => [
  visit('visit-a', 'Clara Berg'),
  visit('series-b::2026-10-20', 'David Winter', { scheduledStart: '2026-10-20T09:30:00Z', scheduledEnd: '2026-10-20T10:30:00Z', isVirtual: true }),
  visit('visit-c', 'Eva Sommer', { employeeId: null, employeeName: null, issues: [{ code: 'unassigned', message: 'Noch niemandem zugewiesen.', severity: 'warning' }] }),
];
function snapshot(rows = visits(), changes: Partial<AssistTourPlanningSnapshot> = {}): AssistTourPlanningSnapshot {
  const grouped = new Map<string | null, AssistTourVisit[]>();
  for (const row of rows) grouped.set(row.employeeId, [...grouped.get(row.employeeId) ?? [], row]);
  return { date: '2026-10-20', loadedAt: '2026-10-20T07:00:00Z', visits: rows,
    employees: [{ id: 'employee-a', name: 'Anna Adler', active: true, qualificationStatus: 'verified', qualificationLabels: ['Betreuung'] }, { id: 'employee-b', name: 'Ben Frank', active: true, qualificationStatus: 'unknown', qualificationLabels: [] }],
    tours: [...grouped].map(([employeeId, items]) => ({ employeeId, name: employeeId ? 'Anna Adler' : 'Ohne Zuweisung', visits: items, workMinutes: items.reduce((sum, item) => sum + item.durationMinutes, 0), issues: items.flatMap(item => item.issues) })),
    warnings: [], checks: { employees: 'ready', availability: 'ready', absences: 'ready', qualifications: 'ready' }, availability: [], absences: [], ...changes };
}
const result = (data = snapshot()): ServiceResult<AssistTourPlanningSnapshot> => ({ ok: true, data });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.tenant = 'tenant-a'; state.user = 'user-a'; state.role = 'business_admin'; state.authReady = true; state.authenticated = true; state.portalSession = false; state.focused = true;
  state.permissions = [...permissions]; state.params = { tourDate: '2026-10-20' };
  state.fetch.mockReset().mockResolvedValue(result()); state.push.mockReset(); state.live.mockReset();
  state.setParams.mockReset().mockImplementation((params: Params) => { state.params = { ...state.params, ...params }; });
  state.candidates = [
    { employeeId: 'employee-b', name: 'Ben Frank', status: 'unknown', issues: [{ code: 'availability_unknown', message: 'Für diesen Zeitraum fehlt eine bestätigte Verfügbarkeit.', severity: 'unknown' }] },
    { employeeId: 'employee-d', name: 'Dora Neumann', status: 'blocked', issues: [{ code: 'absence', message: 'Genehmigte Abwesenheit überschneidet sich.', severity: 'error' }] },
    { employeeId: 'employee-e', name: 'Erik Fuchs', status: 'available', issues: [] },
  ];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async (view: 'planning' | 'replacement' = 'planning') => { await act(async () => root.render(<AssistTourPlanningWorkspace view={view} />)); };
const stops = () => [...host.querySelectorAll<HTMLButtonElement>('.atw-stop')];
const stopNames = () => stops().map(stop => stop.querySelector('.atw-stop-name')?.textContent);
const detailName = () => host.querySelector('.atw-detail h2')?.textContent;
function button(label: string, scope: ParentNode = host) { const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label); if (!found) throw new Error('Button fehlt: ' + label); return found; }
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const choose = (name: string) => click(stops().find(stop => stop.querySelector('.atw-stop-name')?.textContent === name)!);
const refresh = () => click(button('Tourenplanung aktualisieren'));
async function search(value: string) { const input = host.querySelector<HTMLInputElement>('input[type=search]')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function employee(value: string) { const input = host.querySelector<HTMLSelectElement>('select')!; await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); }); }

describe('Web tour planning access and query scope', () => {
  it('uses the dedicated tenant and effective permission service and a single owned header', async () => {
    await render();
    expect(state.fetch).toHaveBeenCalledExactlyOnceWith({ tenantId: 'tenant-a', roleKey: 'business_admin', effectivePermissions: permissions, date: '2026-10-20' });
    expect(host.querySelector('main')?.dataset.ownHeader).toBe('true');
    expect(host.querySelector('nav')?.dataset.active).toBe('tours');
    expect(stopNames()).toEqual(['Clara Berg', 'David Winter', 'Eva Sommer']);
  });
  it.each(['assist.access', 'assist.assignments.view'] as PermissionKey[])('does not read data without %s', async missing => {
    state.permissions = permissions.filter(permission => permission !== missing); await render();
    expect(state.fetch).not.toHaveBeenCalled(); expect(stops()).toHaveLength(0);
    expect(host.textContent).toContain('Freigabe für Assist und Einsätze');
  });
  it('blocks loading before authentication and in portal sessions', async () => {
    state.authReady = false; await render(); expect(host.textContent).toContain('Zugang wird geprüft');
    state.authReady = true; state.authenticated = false; await render();
    state.authenticated = true; state.user = null; await render(); state.user = 'user-a';
    state.portalSession = true; await render(); state.portalSession = false;
    for (const role of ['employee_portal', 'client_portal', 'family_portal', null] as const) { state.role = role; await render(); }
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it('discards pending old tenant data after changing identity', async () => {
    const pending = deferred<ServiceResult<AssistTourPlanningSnapshot>>(); state.fetch.mockReturnValueOnce(pending.promise);
    await render(); state.tenant = 'tenant-b'; state.fetch.mockResolvedValue(result(snapshot([visit('new', 'Neue Person')]))); await render();
    await act(async () => pending.resolve(result())); expect(stopNames()).toEqual(['Neue Person']); expect(host.textContent).not.toContain('Clara Berg');
  });
  it('clears old day data while the newly selected day loads', async () => {
    await render(); await choose('Clara Berg');
    const pending = deferred<ServiceResult<AssistTourPlanningSnapshot>>(); state.fetch.mockReturnValueOnce(pending.promise);
    await click(button('Nächster Tag'));
    expect(state.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ date: '2026-10-21' }));
    expect(stops()).toHaveLength(0); expect(detailName()).toBeUndefined();
    expect(state.params.tourVisit).toBeUndefined();
    await act(async () => pending.resolve(result(snapshot([], { date: '2026-10-21' }))));
    expect(host.textContent).toContain('Für diesen Tag sind keine Einsätze hinterlegt');
  });
});

describe('Web tour planning filters, selection, navigation and recovery', () => {
  it('restores date, employee and virtual occurrence selection from the URL', async () => {
    state.params = { tourDate: ['2026-10-20'], tourEmployee: 'employee-a', tourVisit: 'series-b::2026-10-20', tourDetail: '1' }; await render();
    expect(detailName()).toBe('David Winter'); expect(stopNames()).toEqual(['Clara Berg', 'David Winter']);
    await click(button('Einsatz öffnen')); expect(state.push).toHaveBeenLastCalledWith('/assist/assignments/series-b%3A%3A2026-10-20');
    await click(button('Zuweisung & Zeiten bearbeiten')); expect(state.push).toHaveBeenLastCalledWith('/assist/assignments/series-b%3A%3A2026-10-20/edit');
  });
  it('retains the selected occurrence on refresh and never substitutes another visit when it disappears', async () => {
    await render(); await choose('David Winter'); await refresh(); expect(detailName()).toBe('David Winter');
    state.fetch.mockResolvedValue(result(snapshot([visits()[0]]))); await refresh();
    expect(detailName()).toBeUndefined(); expect(host.textContent).toContain('an diesem Tag nicht mehr verfügbar');
    expect(state.params.tourVisit).toBe('series-b::2026-10-20');
  });
  it('searches real names and addresses, and restores the list after clearing filters', async () => {
    await render(); await search('David'); expect(stopNames()).toEqual(['David Winter']); expect(state.params.tourSearch).toBe('David');
    await search('NichtsPassendes'); expect(host.textContent).toContain('Keine passenden Einsätze');
    await click(button('Filter zurücksetzen')); expect(stopNames()).toHaveLength(3);
    await employee('unassigned'); expect(stopNames()).toEqual(['Eva Sommer']); expect(state.params.tourEmployee).toBe('unassigned');
  });
  it('keeps selection visible as a notice when filters exclude it and supports returning to it', async () => {
    await render(); await choose('David Winter'); await click(button('Ohne Zuweisung', host.querySelector('.atw-filters')!));
    expect(detailName()).toBeUndefined(); expect(host.textContent).toContain('durch die aktuellen Filter ausgeblendet');
    await click(button('Filter zurücksetzen')); expect(detailName()).toBe('David Winter');
  });
  it('writes focus-safe URL updates and pauses background live refresh', async () => {
    await render(); state.focused = false; await render(); state.setParams.mockClear();
    await click(button('Nächster Tag')); await choose('Clara Berg'); await search('David');
    expect(state.setParams).not.toHaveBeenCalled(); expect(state.push).not.toHaveBeenCalled();
    expect(state.live).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    state.focused = true; await render(); expect(state.live).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true, pollMs: 60000 }));
  });
  it('opens replacement mode with the actual selected day and occurrence', async () => {
    await render(); await choose('David Winter'); await click(button('Vertretung prüfen'));
    expect(state.push).toHaveBeenLastCalledWith('/assist/touren-vertretung?tourDate=2026-10-20&tourVisit=series-b%3A%3A2026-10-20&tourDetail=1');
  });
  it('passes the selected day and active employee to the real create workflow', async () => {
    await render(); await employee('employee-a'); await click(button('Einsatz planen'));
    expect(state.push).toHaveBeenLastCalledWith('/assist/assignments?create=1&assignmentDate=2026-10-20&employeeId=employee-a');
    await employee('unassigned'); await click(button('Einsatz planen'));
    expect(state.push).toHaveBeenLastCalledWith('/assist/assignments?create=1&assignmentDate=2026-10-20');
  });
  it('keeps stale data and selection with an inline retry after a failed refresh', async () => {
    await render(); await choose('David Winter'); state.fetch.mockResolvedValue({ ok: false, error: 'Planungsdaten nicht lesbar.' }); await refresh();
    expect(detailName()).toBe('David Winter'); expect(host.textContent).toContain('zuletzt geladene Stand'); expect(host.querySelector('[role=alert]')?.textContent).toContain('Planungsdaten nicht lesbar.');
    expect(host.querySelector('[role=dialog]')).toBeNull(); state.fetch.mockResolvedValue(result()); await click(button('Erneut laden')); expect(host.querySelector('[role=alert]')).toBeNull();
  });
  it('does not turn a failed initial query into an empty successful tour list', async () => {
    state.fetch.mockResolvedValue({ ok: false, error: 'Einsätze nicht lesbar.' }); await render();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Einsätze nicht lesbar.');
    expect(host.textContent).not.toContain('Für diesen Tag sind keine Einsätze hinterlegt');
    expect(host.querySelector('.atw-metric strong')?.textContent).toBe('—');
  });
});

describe('Web replacement checks and lifecycle protection', () => {
  it('shows employee names, reasons and unknown checks without scores or fake availability', async () => {
    await render('replacement'); await choose('Clara Berg');
    expect(host.querySelector('nav')?.dataset.active).toBe('replacement');
    const candidates = [...host.querySelectorAll('.atw-candidate')];
    expect(candidates[0].textContent).toContain('Ben Frank'); expect(candidates[0].textContent).toContain('Prüfung offen'); expect(candidates[0].textContent).toContain('bestätigte Verfügbarkeit');
    expect(candidates[1].textContent).toContain('Nicht passend'); expect(candidates[2].textContent).toContain('Zeitlich möglich');
    expect(host.textContent).not.toContain('employee-b'); expect(host.textContent).not.toContain('Score');
    expect(host.textContent).toContain('Die Auswahl wird im Einsatz unter „Personen“ gespeichert.');
    expect(host.querySelector('.atw-candidates button')).toBeNull();
  });
  it('distinguishes an unavailable employee check from an empty eligible roster', async () => {
    state.candidates = []; state.fetch.mockResolvedValue(result(snapshot(undefined, { checks: { employees: 'unknown', availability: 'unknown', absences: 'unknown', qualifications: 'unknown' }, warnings: ['Personalprüfung nicht verfügbar.'] })));
    await render('replacement'); await choose('Clara Berg'); expect(host.textContent).toContain('Mitarbeitende konnten nicht vollständig geprüft werden');
    expect(host.textContent).not.toContain('keine weiteren Mitarbeitenden');
  });
  it('allows viewing without management permission while removing all edit and create actions', async () => {
    state.permissions = ['assist.access', 'assist.assignments.view']; await render('replacement'); await choose('Clara Berg');
    expect([...host.querySelectorAll('button')].map(item => item.textContent)).not.toContain('Zuweisung & Zeiten bearbeiten');
    expect([...host.querySelectorAll('button')].map(item => item.textContent)).not.toContain('Einsatz planen');
    expect(host.textContent).toContain('Zum Ändern benötigen Sie die Freigabe'); await click(button('Einsatz öffnen')); expect(state.push).toHaveBeenCalled();
  });
  it.each(['active', 'follow_up', 'completed', 'cancelled', 'unknown'] as const)('does not offer replacement or edit for %s visits', async status => {
    state.fetch.mockResolvedValue(result(snapshot([visit('locked', 'Clara Berg', { status, statusLabel: 'Status ' + status, canReassign: false })])));
    await render('replacement'); await choose('Clara Berg');
    expect(host.querySelectorAll('.atw-candidate')).toHaveLength(0); expect(host.textContent).toContain('nicht mehr in einem umplanbaren Status');
    expect([...host.querySelectorAll('button')].some(item => item.textContent === 'Zuweisung & Zeiten bearbeiten')).toBe(false);
  });
  it('labels gaps as time intervals rather than calculated travel or available break time', async () => {
    await render(); expect(host.querySelector('.atw-gap')?.textContent).toBe('30 Min. Zeitabstand · Fahrzeit offen');
    await search('Clara'); expect(host.querySelector('.atw-gap')).toBeNull();
  });
});
