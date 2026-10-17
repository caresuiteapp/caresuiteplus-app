// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { AssistMobilityJournal, AssistMobilityTrip, AssistMobilityTracking, AssistMobilityTrackingRow } from '@/lib/assist/assistMobilityModel.web';

const state = vi.hoisted(() => ({
  tenant: 'tenant-a' as string | null, user: 'user-a' as string | null, role: 'business_admin' as RoleKey | null,
  authReady: true, authenticated: true, portal: false, focused: true,
  permissions: [] as PermissionKey[], params: {} as Record<string, string | undefined>,
  journal: vi.fn(), tracking: vi.fn(), detail: vi.fn(), correct: vi.fn(), setParams: vi.fn(), push: vi.fn(), replace: vi.fn(), live: vi.fn(), map: vi.fn(), dispatch: vi.fn(), preventRemove: vi.fn(),
}));
const router = { setParams: state.setParams, push: state.push, replace: state.replace };
vi.mock('expo-router', () => ({ useRouter: () => router, useLocalSearchParams: () => state.params, useIsFocused: () => state.focused, useNavigation: () => ({ dispatch: state.dispatch }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: (...args: unknown[]) => state.preventRemove(...args) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: state.user ? { id: state.user } : null, authReady: state.authReady, isAuthenticated: state.authenticated, portalSession: state.portal }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => state.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: state.role, permissions: state.permissions, can: (permission: PermissionKey) => state.permissions.includes(permission) }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/components/assist/MobilityWorkspaceNav.web', () => ({ MobilityWorkspaceNav: ({ active, beforeNavigate }: any) => <nav aria-label="Touren und Mobilität" data-active={active}><button type="button" onClick={() => { if (beforeNavigate?.() !== false) state.push('/assist/touren'); }}>Tourenplanung</button></nav> }));
vi.mock('@/components/maps/GoogleMapsLiveMap.web', () => ({ GoogleMapsLiveMap: (props: any) => { state.map(props); return <div data-test-map="true"><button type="button" onClick={() => props.onMarkerSelect?.(props.markers[0]?.id)}>Kartenpunkt wählen</button></div>; } }));
vi.mock('@/lib/assist/assistMobilityService.web', () => ({ fetchAssistMobilityJournal: (...args: unknown[]) => state.journal(...args), fetchAssistMobilityTracking: (...args: unknown[]) => state.tracking(...args), fetchAssistMobilityTrip: (...args: unknown[]) => state.detail(...args), correctAssistMobilityTrip: (...args: unknown[]) => state.correct(...args) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60000, useLiveRefresh: (options: unknown) => { state.live(options); return { isLiveConnected: false }; } }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
import { AssistMobilityWorkspace } from '@/screens/assist/AssistMobilityWorkspace.web';

const allPermissions: PermissionKey[] = ['assist.access', 'assist.trips.view', 'assist.trips.manage', 'assist.tracking.view', 'assist.assignments.view', 'office.employees.view', 'office.employees.edit'];
const NOW = new Date('2026-10-18T08:00:00Z').getTime();
const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });
function trip(id: string, overrides: Partial<AssistMobilityTrip> = {}): AssistMobilityTrip {
  return { id, source: 'logbook', tenantId: 'tenant-a', employeeId: 'employee-a', employeeName: 'Anne Adler', clientId: 'client-a', clientName: 'Mara Müller', vehicleId: 'vehicle-a', vehicleLabel: 'HER-AA 123', purpose: 'Anfahrt Haushaltshilfe', routeType: 'home_to_first_client', routeTypeLabel: 'Anfahrt zum ersten Einsatz', status: 'completed', statusLabel: 'Abgeschlossen', needsReview: false, startedAt: '2026-10-17T08:00:00Z', endedAt: '2026-10-17T08:30:00Z', startAddress: 'Büro Herne', endAddress: 'Zielweg 1, Bochum', distanceKm: 12.5, durationMinutes: 30, distanceSourceLabel: 'GPS-Aufzeichnung', notes: null, assignmentId: 'visit-a', detailHref: '/assist/fahrten/' + id + '?source=logbook', updatedAt: '2026-10-17T09:00:00Z', ...overrides };
}
function journal(rows = [trip('trip-a'), trip('trip-b', { employeeId: 'employee-b', employeeName: 'Ben Berger', purpose: 'Heimfahrt', status: 'recording', statusLabel: 'Aufzeichnung läuft', endedAt: null, distanceKm: null, durationMinutes: null }), trip('trip-c', { status: 'review_required', statusLabel: 'Prüfung erforderlich', needsReview: true, distanceKm: 4 })]): AssistMobilityJournal {
  return { month: '2026-10', rows, employees: [...new Map(rows.map(row => [row.employeeId!, { id: row.employeeId!, name: row.employeeName }])).values()], warnings: [], generatedAt: '2026-10-18T08:00:00Z' };
}
function track(id: string, overrides: Partial<AssistMobilityTrackingRow> = {}): AssistMobilityTrackingRow {
  return { id, visitId: id, employeeId: 'employee-a', employeeName: 'Anne Adler', clientName: 'Mara Müller', title: 'Haushaltshilfe', statusLabel: 'Unterwegs', trackingState: 'live', trackingLabel: 'GPS aktuell', position: { latitude: 51.54, longitude: 7.22, accuracyMeters: 9, capturedAt: '2026-10-18T07:59:45Z' }, lastSignalAt: '2026-10-18T07:59:45Z', plannedStartAt: '2026-10-18T08:00:00Z', plannedEndAt: '2026-10-18T10:00:00Z', detailHref: '/assist/assignments/' + id, ...overrides };
}
function tracking(rows = [track('visit-a'), track('visit-b', { employeeId: 'employee-b', employeeName: 'Ben Berger', trackingState: 'consent_missing', trackingLabel: 'Standort nicht freigegeben', position: null, lastSignalAt: null })]): AssistMobilityTracking { return { rows, warnings: [], generatedAt: '2026-10-18T08:00:00Z' }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.tenant = 'tenant-a'; state.user = 'user-a'; state.role = 'business_admin'; state.authReady = true; state.authenticated = true; state.portal = false; state.focused = true;
  state.permissions = [...allPermissions]; state.params = { month: '2026-10' };
  state.journal.mockReset().mockResolvedValue(ok(journal())); state.tracking.mockReset().mockResolvedValue(ok(tracking())); state.detail.mockReset().mockResolvedValue(ok(trip('outside'))); state.correct.mockReset().mockResolvedValue(ok(trip('trip-a', { distanceKm: 15, status: 'corrected', statusLabel: 'Korrigiert' })));
  state.setParams.mockReset(); state.push.mockReset(); state.replace.mockReset(); state.live.mockReset(); state.map.mockReset(); state.dispatch.mockReset(); state.preventRemove.mockReset();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const render = async (initialSelectedId?: string) => { await act(async () => root.render(<AssistMobilityWorkspace initialSelectedId={initialSelectedId} />)); };
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
function button(label: string): HTMLButtonElement { const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent === label); if (!found) throw new Error('Button fehlt: ' + label); return found; }
function input(label: string): HTMLInputElement | HTMLTextAreaElement { const found = [...host.querySelectorAll('label')].find(item => item.childNodes[0]?.textContent === label)?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea'); if (!found) throw new Error('Eingabe fehlt: ' + label); return found; }
async function change(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  await act(async () => { const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
}
function select(label: string) { return [...host.querySelectorAll('label')].find(item => item.childNodes[0]?.textContent === label)!.querySelector('select')!; }
const visibleNames = () => [...host.querySelectorAll('.amw-row-button')].map(element => element.textContent);
const chooseFirst = () => click(host.querySelector<HTMLButtonElement>('.amw-row-button')!);

describe('Mobility access and account boundaries', () => {
  it('reads the month-scoped journal only and passes effective permissions', async () => {
    await render(); expect(state.journal).toHaveBeenCalledExactlyOnceWith({ tenantId: 'tenant-a', roleKey: 'business_admin', effectivePermissions: allPermissions, month: '2026-10' });
    expect(state.tracking).not.toHaveBeenCalled(); expect(state.detail).not.toHaveBeenCalled(); expect(visibleNames()).toEqual(['Anne Adler', 'Ben Berger', 'Anne Adler']);
  });
  it('does not query before authentication or for portal users', async () => {
    state.authReady = false; await render(); expect(host.textContent).toContain('Zugang wird geprüft');
    state.authReady = true; state.authenticated = false; await render(); state.authenticated = true; state.user = null; await render(); state.user = 'user-a'; state.tenant = null; await render(); state.tenant = 'tenant-a'; state.portal = true; await render();
    state.portal = false; state.role = 'employee_portal'; await render(); expect(state.journal).not.toHaveBeenCalled(); expect(state.tracking).not.toHaveBeenCalled();
  });
  it('requires Assist access and the selected area permission', async () => {
    state.permissions = allPermissions.filter(permission => permission !== 'assist.access'); await render(); expect(state.journal).not.toHaveBeenCalled();
    state.permissions = ['assist.access', 'assist.trips.view']; state.params.tab = 'tracking'; await render(); expect(state.tracking).not.toHaveBeenCalled(); expect(host.textContent).toContain('Bereich nicht freigegeben');
  });
  it('does not fetch tracking without assignment visibility', async () => {
    state.params.tab = 'tracking'; state.permissions = allPermissions.filter(permission => permission !== 'assist.assignments.view'); await render(); expect(state.tracking).not.toHaveBeenCalled();
  });
  it('discards a previous tenant response and removes old details on access revocation', async () => {
    const pending = deferred<ServiceResult<AssistMobilityJournal>>(); state.journal.mockReturnValueOnce(pending.promise); await render();
    state.tenant = 'tenant-b'; state.journal.mockResolvedValue(ok(journal([trip('other', { tenantId: 'tenant-b', employeeName: 'Clara Neu' })]))); await render();
    await act(async () => pending.resolve(ok(journal()))); expect(visibleNames()).toEqual(['Clara Neu']);
    await chooseFirst(); state.permissions = []; await render(); expect(host.querySelector('.amw-detail')).toBeNull(); expect(host.textContent).not.toContain('Clara Neu');
  });
  it('retains state when the permission order changes', async () => {
    await render(); await change(input('Suche'), 'Ben'); const search = input('Suche'); state.permissions = [...allPermissions].reverse(); await render();
    expect(input('Suche')).toBe(search); expect(visibleNames()).toEqual(['Ben Berger']); expect(state.journal).toHaveBeenCalledTimes(1);
  });
});

describe('Journal filters and stable details', () => {
  it('restores month, search, status and card view from the URL', async () => {
    state.params = { month: '2026-09', search: 'Anne', status: 'completed', view: 'cards' }; state.journal.mockResolvedValue(ok({ ...journal(), month: '2026-09' })); await render();
    expect(state.journal.mock.calls[0][0].month).toBe('2026-09'); expect(host.querySelector('.amw-card-list')).not.toBeNull(); expect(visibleNames()).toEqual(['Anne Adler']); expect(button('Karten').getAttribute('aria-pressed')).toBe('true');
  });
  it('searches and combines employee/status filters, then resets them', async () => {
    await render(); await change(input('Suche'), 'Heimfahrt'); expect(visibleNames()).toEqual(['Ben Berger']);
    await change(select('Mitarbeitende'), 'employee-a'); expect(visibleNames()).toEqual([]); expect(host.textContent).toContain('Keine passenden Fahrten');
    await click(button('Filter zurücksetzen')); await change(select('Status'), 'review'); expect(visibleNames()).toEqual(['Anne Adler']); expect(host.textContent).toContain('Prüfung erforderlich');
    expect(state.setParams).toHaveBeenLastCalledWith({ status: 'review' });
  });
  it('changes month without retaining a previous month snapshot', async () => {
    await render(); await chooseFirst(); const pending = deferred<ServiceResult<AssistMobilityJournal>>(); state.journal.mockReturnValueOnce(pending.promise);
    await click(button('Vorheriger Monat')); expect(state.journal.mock.lastCall?.[0].month).toBe('2026-09'); expect(visibleNames()).toEqual([]); expect(host.querySelector('.amw-detail')).toBeNull();
    await act(async () => pending.resolve(ok({ ...journal([]), month: '2026-09' }))); expect(host.textContent).toContain('Keine Fahrten in diesem Monat');
  });
  it('keeps details open through refreshed row objects and closes only explicitly', async () => {
    await render(); await chooseFirst(); expect(host.querySelector('.amw-detail h2')?.textContent).toBe('Anne Adler');
    state.journal.mockResolvedValue(ok(journal([trip('trip-a', { notes: 'Aktualisiert' })]))); await click(button('Fahrtenbuch aktualisieren'));
    expect(host.querySelector('.amw-detail')).not.toBeNull(); expect(host.textContent).toContain('Aktualisiert'); await click(button('Fahrtdetails schließen')); expect(host.querySelector('.amw-detail')).toBeNull();
  });
  it('opens historical deep links and preserves filters when returning', async () => {
    state.params = { month: '2026-09', search: 'Anne', view: 'cards', source: 'legacy' }; state.detail.mockResolvedValue(ok(trip('old', { source: 'legacy' })));
    await render('old'); expect(state.detail).toHaveBeenCalledWith(expect.objectContaining({ id: 'old', source: 'legacy' })); expect(host.textContent).toContain('bisherigen Fahrtenbuch');
    await click(button('Fahrtdetails schließen')); expect(state.replace).toHaveBeenCalledWith('/assist/fahrten?tab=fahrten&month=2026-09&search=Anne&view=cards');
  });
  it('passes source-less historic links to the canonical-first lookup', async () => {
    await render('outside'); expect(state.detail).toHaveBeenCalledWith(expect.objectContaining({ id: 'outside', source: undefined }));
  });
  it('shows refresh errors without discarding valid data or announcing success', async () => {
    await render(); state.journal.mockResolvedValue({ ok: false, error: 'Abfrage fehlgeschlagen.' }); await click(button('Fahrtenbuch aktualisieren'));
    expect(visibleNames()).toHaveLength(3); expect(host.textContent).toContain('Aktualisierung fehlgeschlagen'); expect(host.textContent).not.toContain('Fahrten aktualisiert');
  });
  it('does not change the foreground URL from an unfocused workspace', async () => {
    await render(); state.focused = false; await render(); await change(input('Suche'), 'Anne'); await chooseFirst(); expect(state.setParams).not.toHaveBeenCalled();
    expect(state.live.mock.calls.some(([options]) => options.enabled === false && options.pollMs === 60000)).toBe(true);
  });
  it('distinguishes an absent distance from a measured zero', async () => {
    state.journal.mockResolvedValue(ok(journal([trip('zero', { distanceKm: 0 }), trip('unknown', { distanceKm: null })]))); await render();
    const distances = [...host.querySelectorAll('td .amw-number')].map(element => element.textContent); expect(distances).toEqual(['0 km', 'Nicht erfasst']); expect(host.textContent).toContain('Bei 1 abgeschlossenen Fahrten fehlt die Distanz');
  });
});

describe('Audited trip correction', () => {
  it('requires positive trip and Office employee write permissions independently of read-only client access', async () => {
    state.permissions = allPermissions.filter(permission => permission !== 'office.employees.edit'); await render(); await chooseFirst(); expect(host.textContent).not.toContain('Fahrt korrigieren');
    state.permissions = [...allPermissions, 'office.clients.view']; await render(); await chooseFirst(); expect(button('Fahrt korrigieren')).toBeDefined();
  });
  it('does not offer a fake close action for recordings or historical trips', async () => {
    state.journal.mockResolvedValue(ok(journal([trip('recording', { status: 'recording', endedAt: null })]))); await render(); await chooseFirst(); expect(host.textContent).not.toContain('Fahrt korrigieren'); expect(host.textContent).not.toContain('Fahrt abschließen');
    state.journal.mockResolvedValue(ok(journal([trip('recording', { source: 'legacy', endedAt: '2026-10-17T08:30:00Z' })]))); await click(button('Fahrtenbuch aktualisieren')); await chooseFirst(); expect(host.textContent).not.toContain('Fahrt korrigieren');
  });
  it('submits the selected revision with a mandatory reason and updates details after success', async () => {
    await render(); await chooseFirst(); await click(button('Fahrt korrigieren')); await change(input('Distanz in km'), '15,25'); await change(input('Grund der Korrektur'), 'Kilometerstand abgeglichen');
    state.journal.mockResolvedValue(ok(journal([trip('trip-a', { distanceKm: 15.25, status: 'corrected', statusLabel: 'Korrigiert' })])));
    state.correct.mockResolvedValue(ok(trip('trip-a', { distanceKm: 15.25, status: 'corrected', statusLabel: 'Korrigiert' })));
    await click(button('Korrektur speichern')); expect(state.correct).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'trip-a', employeeId: 'employee-a', expectedUpdatedAt: '2026-10-17T09:00:00Z', distanceKm: 15.25, reason: 'Kilometerstand abgeglichen', startAddress: 'Büro Herne', endAddress: 'Zielweg 1, Bochum' }));
    expect(host.textContent).toContain('Die Fahrt wurde korrigiert'); expect(host.querySelector('form')).toBeNull(); expect(host.querySelector('.amw-detail')?.textContent).toContain('15,25 km');
  });
  it('keeps entered values and the editor open after a concurrency rejection', async () => {
    await render(); await chooseFirst(); await click(button('Fahrt korrigieren')); await change(input('Distanz in km'), '16'); await change(input('Grund der Korrektur'), 'Neue Messung');
    state.correct.mockResolvedValue({ ok: false, error: 'Die Fahrt wurde inzwischen geändert.' }); await click(button('Korrektur speichern'));
    expect(input('Distanz in km').value).toBe('16'); expect(host.textContent).toContain('inzwischen geändert'); expect(host.textContent).not.toContain('Die Fahrt wurde korrigiert');
  });
  it('preserves pending time review when only distance and addresses are corrected', async () => {
    state.journal.mockResolvedValue(ok(journal([trip('review', { status: 'review_required', needsReview: true })]))); await render(); await chooseFirst(); await click(button('Fahrt korrigieren')); expect(host.textContent).toContain('Die Zeitprüfung bleibt offen');
  });
  it('pauses polling while a correction is being edited', async () => {
    await render(); await chooseFirst(); await click(button('Fahrt korrigieren')); expect(state.live.mock.calls.some(([options]) => options.enabled === false && options.pollMs === 60000)).toBe(true);
  });
  it('protects a correction draft during navigation and browser reload', async () => {
    await render(); await chooseFirst(); await click(button('Fahrt korrigieren'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); await click(button('Tourenplanung'));
    expect(state.push).not.toHaveBeenCalled(); expect(host.querySelector('form')).not.toBeNull();
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    expect(state.preventRemove.mock.lastCall?.[0]).toBe(true);
    confirm.mockReturnValue(true); await click(button('Tourenplanung')); expect(state.push).toHaveBeenCalledWith('/assist/touren'); expect(host.querySelector('form')).toBeNull();
  });
});

describe('Tracking truth and interaction', () => {
  it('loads only tracking data for the tracking tab and shows timestamp plus accuracy', async () => {
    state.params.tab = 'tracking'; await render(); expect(state.journal).not.toHaveBeenCalled(); expect(state.tracking).toHaveBeenCalledExactlyOnceWith({ tenantId: 'tenant-a', roleKey: 'business_admin', effectivePermissions: allPermissions });
    await click(host.querySelector<HTMLButtonElement>('.amw-tracking-row')!); expect(host.querySelector('.amw-detail')?.textContent).toContain('18.10.2026'); expect(host.querySelector('.amw-detail')?.textContent).toContain('±9 m'); expect(host.textContent).toContain('vor 15 Sek.');
    expect(state.map.mock.lastCall?.[0]).toMatchObject({ appearance: 'light', tenantId: 'tenant-a', showControls: false });
  });
  it('does not draw positions without consent and shows the reason', async () => {
    state.params.tab = 'tracking'; state.params.tracking = 'visit-b'; await render(); expect(host.querySelector('[data-test-map]')).toBeNull(); expect(host.querySelector('.amw-detail')?.textContent).toContain('keine gültige Standortfreigabe');
  });
  it('expires an otherwise live position locally even if the server snapshot is unchanged', async () => {
    state.params.tab = 'tracking'; state.params.tracking = 'visit-a'; state.tracking.mockResolvedValue(ok(tracking([track('visit-a', { position: { latitude: 51.54, longitude: 7.22, accuracyMeters: 9, capturedAt: '2026-10-18T07:55:00Z' }, lastSignalAt: '2026-10-18T07:55:00Z' })])));
    await render(); expect(host.querySelector('[data-test-map]')).toBeNull(); expect(host.querySelector('.amw-detail')?.textContent).toContain('GPS-Signal veraltet');
  });
  it('withdraws the map and live signal when consent refresh fails', async () => {
    state.params.tab = 'tracking'; state.params.tracking = 'visit-a'; await render(); expect(host.querySelector('[data-test-map]')).not.toBeNull();
    state.tracking.mockResolvedValue({ ok: false, error: 'Freigaben konnten nicht geprüft werden.' }); await click(button('Tracking aktualisieren'));
    expect(host.querySelector('[data-test-map]')).toBeNull(); expect(host.textContent).toContain('Standort nicht erneut bestätigt'); expect(host.textContent).toContain('Aktualisierung fehlgeschlagen');
  });
  it('keeps normal wheel scrolling while preventing a map wheel handler from capturing it', async () => {
    state.params.tab = 'tracking'; await render(); const map = host.querySelector<HTMLElement>('[data-test-map]')!; const handler = vi.fn((event: Event) => event.preventDefault()); map.addEventListener('wheel', handler);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 50 }); await act(async () => { map.dispatchEvent(event); });
    expect(handler).not.toHaveBeenCalled(); expect(event.defaultPrevented).toBe(false);
  });
  it('selects map markers and opens the real assignment route', async () => {
    state.params.tab = 'tracking'; await render(); await click(button('Kartenpunkt wählen')); expect(state.setParams).toHaveBeenCalledWith({ tracking: 'visit-a' }); await click(button('Einsatz öffnen')); expect(state.push).toHaveBeenCalledWith('/assist/assignments/visit-a');
  });
  it('keeps an unavailable linked selection explicit instead of silently opening another person', async () => {
    state.params.tab = 'tracking'; state.params.tracking = 'removed'; await render(); expect(host.querySelector('.amw-detail')?.textContent).toContain('nicht mehr verfügbar'); expect(host.querySelector('.amw-detail h2')?.textContent).toBe('Standorte');
  });
  it('refreshes immediately when the tracking workspace regains focus', async () => {
    state.params.tab = 'tracking'; await render(); state.focused = false; await render(); state.focused = true; await render();
    expect(state.tracking).toHaveBeenCalledTimes(2);
  });
});
