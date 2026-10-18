// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { WfmLiveEmployeeRow } from '@/types/modules/wfm';
import type { AssistMobilityTracking, AssistMobilityTrackingRow } from '@/lib/assist/assistMobilityModel.web';

const state = vi.hoisted(() => ({
  tenant: 'tenant-a' as string | null, user: 'user-a' as string | null, role: 'business_admin' as RoleKey | null,
  authReady: true, authenticated: true, portal: false, focused: true, permissions: [] as PermissionKey[],
  params: {} as Record<string, string | undefined>, presence: vi.fn(), tracking: vi.fn(), push: vi.fn(), setParams: vi.fn(), live: vi.fn(), map: vi.fn(), subscribe: vi.fn(),
}));
const router = { push: state.push, setParams: state.setParams };
vi.mock('expo-router', () => ({ useRouter: () => router, useLocalSearchParams: () => state.params, useIsFocused: () => state.focused }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: state.user ? { id: state.user } : null, authReady: state.authReady, isAuthenticated: state.authenticated, portalSession: state.portal }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => state.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: state.role, permissions: state.permissions, can: (key: PermissionKey) => state.permissions.includes(key) }) }));
vi.mock('@/lib/wfm/wfmOfficeLivePresence.web', () => ({ readOfficeLivePresence: (...args: unknown[]) => state.presence(...args) }));
vi.mock('@/lib/assist/assistMobilityService.web', () => ({ fetchAssistMobilityTracking: (...args: unknown[]) => state.tracking(...args) }));
vi.mock('@/lib/realtime/presets', () => ({ subscribeToWfmLiveChanges: (...args: unknown[]) => state.subscribe(...args) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: (options: unknown) => { state.live(options); return { isLiveConnected: false }; } }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('@/components/maps/GoogleMapsLiveMap.web', () => ({ GoogleMapsLiveMap: (props: any) => { state.map(props); return <div data-live-map="true"><button type="button" onClick={() => props.onMarkerSelect?.(props.markers[0]?.id)}>Kartenpunkt auswählen</button></div>; } }));
import { OfficeLiveEmployeesScreen } from '@/components/wfm/OfficeLiveEmployeesScreen.web';
import { OfficeWfmLiveMapScreen } from '@/components/wfm/OfficeWfmLiveMapScreen.web';

const permissions: PermissionKey[] = ['time.tracking.team.view', 'assist.access', 'assist.tracking.view', 'assist.assignments.view'];
const NOW = Date.parse('2026-10-18T08:00:00Z');
const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });
function row(id: string, name: string, status: 'office' | 'paused' | 'ended' = 'office'): WfmLiveEmployeeRow {
  return { employeeId: id, employeeName: name, statusLabel: status === 'paused' ? 'Pause' : status === 'ended' ? 'Feierabend' : 'Büro', locationLabel: null, lastEventAt: '2026-10-18T07:55:00Z', session: { id: 'session-' + id, tenantId: 'tenant-a', employeeId: id, userId: null, workDate: '2026-10-18', status, workMode: 'office', displayStatus: status === 'ended' ? 'feierabend' : 'buero', startedAt: '2026-10-18T06:00:00Z', endedAt: status === 'ended' ? '2026-10-18T07:55:00Z' : null, lastEventAt: '2026-10-18T07:55:00Z', grossMinutes: 115, netMinutes: 100, pauseMinutes: 15, isOnline: status !== 'ended' } };
}
const overview = (rows = [row('anne', 'Anne Adler'), row('ben', 'Ben Berger', 'paused'), row('clara', 'Clara Claus', 'ended')]) => ({ rows, onlineCount: rows.filter(row => row.session?.isOnline).length, totalCount: rows.length });
function trackingRow(id: string, name: string, overrides: Partial<AssistMobilityTrackingRow> = {}): AssistMobilityTrackingRow {
  return { id, visitId: id, employeeId: id, employeeName: name, clientName: null, title: 'Haushaltshilfe', statusLabel: 'Im Einsatz', trackingState: 'live', trackingLabel: 'GPS aktuell', position: { latitude: 51.54, longitude: 7.22, accuracyMeters: 12, capturedAt: '2026-10-18T07:59:30Z' }, lastSignalAt: '2026-10-18T07:59:30Z', plannedStartAt: '2026-10-18T08:00:00Z', plannedEndAt: '2026-10-18T10:00:00Z', detailHref: '/assist/assignments/' + id, ...overrides };
}
const tracking = (rows = [trackingRow('visit-a', 'Anne Adler'), trackingRow('visit-b', 'Ben Berger', { trackingState: 'consent_missing', trackingLabel: 'Standort nicht freigegeben', position: null, lastSignalAt: null })]): AssistMobilityTracking => ({ rows, generatedAt: '2026-10-18T08:00:00Z', warnings: [] });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.tenant = 'tenant-a'; state.user = 'user-a'; state.role = 'business_admin'; state.authReady = true; state.authenticated = true; state.portal = false; state.focused = true; state.params = {}; state.permissions = [...permissions];
  state.presence.mockReset().mockResolvedValue(ok(overview())); state.tracking.mockReset().mockResolvedValue(ok(tracking()));
  state.push.mockReset(); state.setParams.mockReset(); state.live.mockReset(); state.map.mockReset(); state.subscribe.mockReset();
  vi.spyOn(Date, 'now').mockReturnValue(NOW); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(map = false) { await act(async () => root.render(map ? <OfficeWfmLiveMapScreen /> : <OfficeLiveEmployeesScreen />)); }
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
function button(label: string): HTMLButtonElement { const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent === label); if (!found) throw new Error('Button fehlt: ' + label); return found; }
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); }); }

describe('Arbeitszeit Live-Zugang und Tageserfassung', () => {
  it('loads presence only and opens the selected employee account', async () => {
    await render(); expect(state.presence).toHaveBeenCalledExactlyOnceWith({ tenantId: 'tenant-a', roleKey: 'business_admin', effectivePermissions: permissions }); expect(state.tracking).not.toHaveBeenCalled();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3); expect(host.textContent).toContain('1 Std. 40 Min.');
    await click(button('Zeitkonto von Anne Adler öffnen')); expect(state.push).toHaveBeenCalledWith('/business/office/time-tracking/zeitkonten?employee=anne&account=anne');
  });
  it('does not fetch before auth or for portal users or missing rights', async () => {
    state.authReady = false; await render(); state.authReady = true; state.portal = true; await render(); state.portal = false; state.permissions = []; await render();
    expect(state.presence).not.toHaveBeenCalled(); expect(state.tracking).not.toHaveBeenCalled();
  });
  it('combines name and status filters, restores URL filters, and resets them', async () => {
    state.params = { search: 'Ben', status: 'pause' }; await render(); expect(host.querySelectorAll('tbody tr')).toHaveLength(1); expect(host.querySelector('tbody')?.textContent).toContain('Ben Berger');
    await click(button('Filter zurücksetzen')); expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    await change(host.querySelector('select')!, 'ended'); expect(host.querySelector('tbody')?.textContent).toContain('Clara Claus'); expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
  });
  it('keeps loaded rows on refresh failure and clears old tenant responses', async () => {
    await render(); state.presence.mockResolvedValue({ ok: false, error: 'Abruf fehlgeschlagen.' }); await click(button('Aktualisieren'));
    expect(host.textContent).toContain('letzten erfolgreichen Abruf'); expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    const pending = deferred<ServiceResult<ReturnType<typeof overview>>>(); state.tenant = 'tenant-b'; state.presence.mockReturnValueOnce(pending.promise); await render(); expect(host.textContent).not.toContain('Anne Adler');
    state.tenant = 'tenant-c'; state.presence.mockResolvedValue(ok(overview([row('new', 'Neue Person')]))); await render(); await act(async () => pending.resolve(ok(overview())));
    expect(host.textContent).toContain('Neue Person'); expect(host.textContent).not.toContain('Anne Adler');
  });
  it('pauses subscriptions out of focus and never changes a foreground URL from a background workspace', async () => {
    await render(); state.focused = false; await render(); await change(host.querySelector('input')!, 'Anne'); expect(state.setParams).not.toHaveBeenCalled();
    expect(state.live.mock.calls.some(([options]) => options.enabled === false && options.pollMs === 30000 && options.subscribe)).toBe(true);
    state.focused = true; await render(); expect(state.presence).toHaveBeenCalledTimes(2);
  });
  it('does not link the map when tracking permission is absent', async () => {
    state.permissions = ['time.tracking.team.view']; await render(); expect(host.textContent).not.toContain('Live-Karte öffnen'); await render(true); expect(state.tracking).not.toHaveBeenCalled();
  });
});

describe('Arbeitszeit Live-Karte', () => {
  it('uses the consent-aware reader and only renders current approved markers', async () => {
    await render(true); expect(state.tracking).toHaveBeenCalledExactlyOnceWith({ tenantId: 'tenant-a', roleKey: 'business_admin', effectivePermissions: permissions });
    expect(state.map.mock.lastCall?.[0].markers).toHaveLength(1); expect(state.map.mock.lastCall?.[0].markers[0].id).toBe('visit-a'); expect(host.textContent).toContain('Standort nicht freigegeben');
    expect(button('Standort von Anne Adler auswählen').getAttribute('aria-pressed')).toBe('true'); await click(button('Standort von Ben Berger auswählen')); expect(button('Standort von Ben Berger auswählen').getAttribute('aria-pressed')).toBe('true');
    await click(button('Einsatz öffnen')); expect(state.push).toHaveBeenCalledWith('/assist/assignments/visit-b');
  });
  it('filters current positions and selects through the map without reloading', async () => {
    await render(true); await change(host.querySelector('select')!, 'live'); expect(host.querySelectorAll('.ow-live-position')).toHaveLength(1);
    await click(button('Kartenpunkt auswählen')); expect(state.setParams).toHaveBeenLastCalledWith({ tracking: 'visit-a' }); expect(state.tracking).toHaveBeenCalledTimes(1);
  });
  it('suppresses all map coordinates after a refresh failure until access is rechecked', async () => {
    await render(true); expect(host.querySelector('[data-live-map]')).not.toBeNull(); state.tracking.mockResolvedValue({ ok: false, error: 'Standortfreigaben nicht prüfbar.' }); await click(button('Karte aktualisieren'));
    expect(host.querySelector('[data-live-map]')).toBeNull(); expect(host.textContent).toContain('Kartenpunkte bleiben'); expect(host.textContent).toContain('Anne Adler');
    state.tracking.mockResolvedValue(ok(tracking())); await click(button('Erneut laden')); expect(host.querySelector('[data-live-map]')).not.toBeNull();
  });
  it('expires a stored live position when its signal becomes too old', async () => {
    await render(true); vi.spyOn(Date, 'now').mockReturnValue(NOW + 180000); await render(true); expect(host.querySelector('[data-live-map]')).toBeNull(); expect(host.textContent).toContain('GPS-Signal veraltet');
  });
  it('clears selected person and all coordinates after tenant change or permission revocation', async () => {
    await render(true); await click(button('Standort von Ben Berger auswählen')); state.tenant = 'tenant-b'; state.tracking.mockResolvedValue(ok(tracking([]))); await render(true);
    expect(host.textContent).not.toContain('Ben Berger'); expect(host.querySelector('[data-live-map]')).toBeNull(); state.permissions = ['time.tracking.team.view']; await render(true); expect(host.querySelector('.ow-live-toolbar')).toBeNull();
  });
});
