// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type {
  AssistClientsWorkspaceSnapshot,
  AssistWorkspaceClient,
  AssistWorkspaceVisit,
} from '@/lib/assist/assistClientsWorkspaceModel.web';

type Params = Record<string, string | string[] | undefined>;
const state = vi.hoisted(() => ({
  tenant: 'tenant-a' as string | null,
  user: 'user-a' as string | null,
  role: 'business_admin' as RoleKey | null,
  authReady: true,
  authenticated: true,
  portalSession: false,
  focused: true,
  permissions: [] as PermissionKey[],
  params: {} as Params,
  fetch: vi.fn(),
  officeFetch: vi.fn(),
  setParams: vi.fn(),
  push: vi.fn(),
  live: vi.fn(),
}));
vi.mock('expo-router', () => ({ useRouter: () => router, useLocalSearchParams: () => state.params, useIsFocused: () => state.focused }));
const router = { setParams: state.setParams, push: state.push };
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({
  user: state.user ? { id: state.user } : null,
  authReady: state.authReady,
  isAuthenticated: state.authenticated,
  portalSession: state.portalSession,
}) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => state.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({
  roleKey: state.role,
  permissions: state.permissions,
  can: (permission: PermissionKey) => state.permissions.includes(permission),
}) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children, contentOwnsHeader }: any) => <main data-own-header={String(contentOwnsHeader)}>{children}</main> }));
vi.mock('@/components/clients/ClientAnimalAvatar', () => ({ ClientAnimalAvatar: () => <span aria-hidden="true" /> }));
vi.mock('@/lib/assist/assistClientsWorkspaceService.web', () => ({ fetchAssistClientsWorkspace: (...args: unknown[]) => state.fetch(...args) }));
// The Assist roster must not silently fall back to the unfiltered Office list.
vi.mock('@/lib/office/clientListService', () => ({ fetchClientList: (...args: unknown[]) => state.officeFetch(...args) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60000, useLiveRefresh: (options: {
  enabled?: boolean; onRefresh: () => void; pollMs?: number; refreshOnFocus?: boolean;
}) => { state.live(options); return { isLiveConnected: false }; } }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
import { AssistClientsWorkspace } from '@/liquid-command/screens/AssistClientsWorkspace.web';

const requiredPermissions: PermissionKey[] = ['assist.access', 'office.access', 'office.clients.view'];
const permissions: PermissionKey[] = [...requiredPermissions, 'assist.assignments.view', 'assist.assignments.manage', 'office.clients.edit'];
const visit = (id: string, clientId: string, changes: Partial<AssistWorkspaceVisit> = {}): AssistWorkspaceVisit => ({
  id, clientId, title: 'Alltagsbegleitung', serviceName: 'Haushaltshilfe',
  scheduledStart: '2026-10-20T08:00:00Z', scheduledEnd: '2026-10-20T09:00:00Z', durationMinutes: 60,
  employeeId: 'employee-visit', employeeName: 'Jonas Berger', status: 'planned', statusLabel: 'Geplant', ...changes,
});
const person = (id: string, firstName: string, lastName: string, changes: Partial<AssistWorkspaceClient> = {}): AssistWorkspaceClient => ({
  id, firstName, lastName, name: firstName + ' ' + lastName, clientNumber: 'K-' + id,
  dateOfBirth: '1950-05-02', careLevel: 'pg2', careLevelLabel: 'Pflegegrad 2',
  costCarrier: 'Techniker Krankenkasse', insuranceNumber: 'A123456789', selfPay: false,
  phone: '02323 123456', mobile: '+49 171 1234567', email: firstName.toLocaleLowerCase('de-DE') + '@example.test',
  street: 'Beispielstraße 7', postalCode: '44623', city: 'Herne', address: 'Beispielstraße 7, 44623 Herne',
  assignmentId: 'assignment-' + id, assignedAt: '2026-01-01T10:00:00Z',
  primaryEmployeeId: 'employee-primary', primaryEmployeeName: 'Anne Adler', primaryEmployeeAvailable: true,
  missingFields: [], warnings: [], upcomingVisits: [], nextVisit: null, sevenDayVisitCount: 0,
  planningStatus: 'unplanned', needsAttention: false, statusLabel: 'Aktiv', ...changes,
});
function fixtureClients(): AssistWorkspaceClient[] {
  const annaVisits = [visit('visit-a', 'client-a'), visit('visit-a2', 'client-a', { scheduledStart: '2026-10-22T09:00:00Z', scheduledEnd: '2026-10-22T10:00:00Z', status: 'confirmed', statusLabel: 'Bestätigt' })];
  const benVisits = [visit('visit-b', 'client-b', { scheduledStart: '2026-10-19T08:00:00Z', scheduledEnd: '2026-10-19T09:00:00Z', employeeName: 'Maja Winter' })];
  return [
    person('client-a', 'Anna', 'Müller', { upcomingVisits: annaVisits, nextVisit: annaVisits[0], planningStatus: 'planned', sevenDayVisitCount: 2 }),
    person('client-b', 'Ben', 'Schuster', { city: 'Bochum', address: 'Testweg 2, 44787 Bochum', careLevel: 'pg3', careLevelLabel: 'Pflegegrad 3', upcomingVisits: benVisits, nextVisit: benVisits[0], planningStatus: 'planned', sevenDayVisitCount: 1 }),
    person('client-c', 'Clara', 'Ziegler', { city: 'Dortmund', address: '44135 Dortmund', street: null, missingFields: ['Vollständige Einsatzadresse'], needsAttention: true }),
  ];
}
const snapshot = (clients = fixtureClients(), changes: Partial<AssistClientsWorkspaceSnapshot> = {}): AssistClientsWorkspaceSnapshot => ({
  clients, loadedAt: '2026-10-17T10:00:00Z',
  coverage: { fromDate: '2026-10-17', toDate: '2027-01-14', sevenDayToDate: '2026-10-23' },
  visitsAvailable: true, visitsError: null, warnings: [], ...changes,
});
const result = (data = snapshot()): ServiceResult<AssistClientsWorkspaceSnapshot> => ({ ok: true, data });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.tenant = 'tenant-a'; state.user = 'user-a'; state.role = 'business_admin';
  state.authReady = true; state.authenticated = true; state.portalSession = false; state.focused = true;
  state.permissions = [...permissions]; state.params = {};
  state.fetch.mockReset().mockResolvedValue(result()); state.officeFetch.mockReset();
  state.setParams.mockReset(); state.push.mockReset(); state.live.mockReset();
  // Focus callbacks are deterministic here; layout is verified separately in a real browser.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async () => { await act(async () => root.render(<AssistClientsWorkspace />)); };
const detail = () => host.querySelector<HTMLElement>('.acw-detail');
const selectedName = () => detail()?.querySelector('h2')?.textContent ?? null;
const rows = () => [...host.querySelectorAll<HTMLButtonElement>('.acw-row')];
const names = () => rows().map(row => row.querySelector('.acw-row-name')?.textContent);
function button(label: string, scope: ParentNode = host): HTMLButtonElement {
  const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(element => element.getAttribute('aria-label') === label || element.textContent?.trim() === label);
  if (!found) throw new Error('Button nicht gefunden: ' + label);
  return found;
}
async function click(element: HTMLElement) { await act(async () => element.click()); }
async function choose(name: string) { await click(rows().find(row => row.querySelector('.acw-row-name')?.textContent === name)!); }
async function search(value: string) {
  const input = host.querySelector<HTMLInputElement>('input[type=search]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function sort(value: string) {
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="Klient:innen sortieren"]')!;
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
}
const refresh = () => click(button('Assist-Übersicht aktualisieren'));
const filterButton = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('.acw-filter')].find(element => element.textContent?.startsWith(label))!;
const metric = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('.acw-metric')].find(element => element.querySelector('strong')?.textContent === label)!;

describe('Assist client workspace permissions and identity', () => {
  it('loads only the dedicated Assist roster with the effective account permissions', async () => {
    await render();
    expect(state.fetch).toHaveBeenCalledExactlyOnceWith({ tenantId: 'tenant-a', roleKey: 'business_admin', effectivePermissions: permissions });
    expect(state.officeFetch).not.toHaveBeenCalled();
    expect(host.querySelector('main')?.dataset.ownHeader).toBe('true');
    expect(names()).toEqual(['Anna Müller', 'Ben Schuster', 'Clara Ziegler']);
    expect(selectedName()).toBe('Anna Müller');
    expect(host.querySelector('[data-assist-clients]')?.getAttribute('data-detail-open')).toBe('false');
  });

  it.each(requiredPermissions)('requires the positive %s permission, even for an administrator', async missing => {
    state.permissions = permissions.filter(permission => permission !== missing); await render();
    expect(state.fetch).not.toHaveBeenCalled(); expect(rows()).toHaveLength(0);
    expect(host.textContent).toContain('Freigabe für Assist und Klient:innen');
  });

  it('does not read private data before auth readiness, without an identity, or in any portal context', async () => {
    state.authReady = false; await render(); expect(host.textContent).toContain('Zugang wird geprüft');
    state.authReady = true; state.authenticated = false; await render();
    state.authenticated = true; state.user = null; await render();
    state.user = 'user-a'; state.tenant = null; await render();
    state.tenant = 'tenant-a'; state.portalSession = true; await render();
    state.portalSession = false;
    for (const role of ['employee_portal', 'client_portal', 'family_portal', null] as const) { state.role = role; await render(); }
    expect(state.fetch).not.toHaveBeenCalled(); expect(state.officeFetch).not.toHaveBeenCalled(); expect(detail()).toBeNull();
  });

  it('drops a pending old tenant response and clears person selection across user changes', async () => {
    const pending = deferred<ServiceResult<AssistClientsWorkspaceSnapshot>>(); state.fetch.mockReturnValueOnce(pending.promise);
    await render(); expect(host.textContent).toContain('Assist wird geladen');
    state.tenant = 'tenant-b';
    state.fetch.mockResolvedValue(result(snapshot([person('client-other', 'Dora', 'Neumann')])));
    await render(); expect(selectedName()).toBe('Dora Neumann');
    await act(async () => pending.resolve(result()));
    expect(names()).toEqual(['Dora Neumann']); expect(host.textContent).not.toContain('Anna Müller');
    await search('Dora'); state.user = 'user-b';
    state.fetch.mockResolvedValue(result(snapshot([person('client-new-user', 'Erik', 'Walter')])));
    await render(); expect(names()).toEqual(['Erik Walter']); expect(selectedName()).toBe('Erik Walter');
    expect(host.querySelector<HTMLInputElement>('input[type=search]')?.value).toBe('');
  });

  it('keeps current search and selection when permission order changes, but closes on revoked access', async () => {
    await render(); await choose('Ben Schuster'); await search('Ben');
    const input = host.querySelector('input');
    state.permissions = [...permissions].reverse().concat('office.clients.view'); await render();
    expect(state.fetch).toHaveBeenCalledTimes(1); expect(host.querySelector('input')).toBe(input);
    expect(names()).toEqual(['Ben Schuster']); expect(selectedName()).toBe('Ben Schuster');
    state.permissions = []; await render();
    expect(detail()).toBeNull(); expect(rows()).toHaveLength(0); expect(state.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Assist roster search, filters and navigation', () => {
  it('searches normalized names, care grades, carrier numbers and both fixed and planned staff', async () => {
    await render();
    for (const [query, expected] of [
      ['muller', ['Anna Müller']], ['pflegegrad 2 herne', ['Anna Müller']],
      ['Jonas Berger', ['Anna Müller']], ['Maja Winter', ['Ben Schuster']],
      ['Anne Adler', ['Anna Müller', 'Ben Schuster', 'Clara Ziegler']],
      ['A123456789', ['Anna Müller', 'Ben Schuster', 'Clara Ziegler']],
      ['Techniker Bochum', ['Ben Schuster']],
      ['ben@example.test', ['Ben Schuster']],
    ] as [string, string[]][]) { await search(query); expect(names()).toEqual(expected); }
    await search('keine passende Person'); expect(names()).toEqual([]); expect(host.textContent).toContain('Keine passenden Klient:innen');
    await click(button('Filter zurücksetzen')); expect(names()).toHaveLength(3);
    expect(state.setParams).toHaveBeenLastCalledWith({ assistSearch: undefined, assistFilter: undefined, assistDetail: '0' });
  });

  it('computes all roster counts, filters by real planning, and sorts without changing their scope', async () => {
    await render();
    expect(metric('Klient:innen').querySelector('.acw-metric-number')?.textContent).toBe('3');
    expect(metric('Einsätze in 7 Tagen').querySelector('.acw-metric-number')?.textContent).toBe('3');
    expect(metric('Klärungsbedarf').querySelector('.acw-metric-number')?.textContent).toBe('1');
    expect(metric('Ohne Einsatz').querySelector('.acw-metric-number')?.textContent).toBe('1');
    await click(filterButton('Klärungsbedarf')); expect(names()).toEqual(['Clara Ziegler']);
    expect(metric('Klient:innen').querySelector('.acw-metric-number')?.textContent).toBe('3');
    await click(filterButton('Mit Einsatz')); expect(names()).toEqual(['Anna Müller', 'Ben Schuster']);
    await click(filterButton('Ohne Einsatz')); expect(names()).toEqual(['Clara Ziegler']);
    await click(metric('Einsätze in 7 Tagen')); expect(names()).toEqual(['Anna Müller', 'Ben Schuster']);
    await click(filterButton('Alle')); await sort('next_visit'); expect(names()).toEqual(['Ben Schuster', 'Anna Müller', 'Clara Ziegler']);
    expect(state.setParams).toHaveBeenLastCalledWith({ assistSort: 'next_visit' });
    await sort('attention'); expect(names()).toEqual(['Clara Ziegler', 'Anna Müller', 'Ben Schuster']);
    await sort('name'); expect(names()).toEqual(['Anna Müller', 'Ben Schuster', 'Clara Ziegler']);
  });

  it('preserves the requested person in record, portal, budget and planning routes', async () => {
    await render(); await choose('Ben Schuster');
    expect(state.setParams).toHaveBeenLastCalledWith({ clientId: 'client-b', record: undefined, assistDetail: '1' });
    expect(host.querySelector('[data-assist-clients]')?.getAttribute('data-detail-open')).toBe('true');
    for (const [label, route] of [
      ['Klientenakte', '/business/office/clients/client-b'],
      ['Portal & Freigaben', '/business/office/clients/client-b?tab=portal'],
      ['Budget öffnen', '/assist/abrechnungsquellen?clientId=client-b'],
      ['Einsatz planen', '/assist/assignments?create=1&clientId=client-b'],
    ]) { await click(button(label, detail()!)); expect(state.push).toHaveBeenLastCalledWith(route); }
    await click(button('Einsatz für Ben Schuster planen')); expect(state.push).toHaveBeenLastCalledWith('/assist/assignments?create=1&clientId=client-b');
    await click(detail()!.querySelector<HTMLButtonElement>('.acw-visit')!);
    expect(state.push).toHaveBeenLastCalledWith('/assist/assignments/visit-b');
    await click(button('Zur Liste')); expect(host.querySelector('[data-assist-clients]')?.getAttribute('data-detail-open')).toBe('false');
    expect(state.setParams).toHaveBeenLastCalledWith({ assistDetail: '0' });
  });

  it('offers only permitted edit and planning actions while retaining read-only record access', async () => {
    state.permissions = [...requiredPermissions, 'assist.assignments.view']; await render(); await choose('Clara Ziegler');
    expect(host.querySelector('[aria-label^="Einsatz für"]')).toBeNull();
    expect([...host.querySelectorAll('button')].some(item => item.textContent === 'Einsatz planen')).toBe(false);
    await click(button('Stammdaten ansehen')); expect(state.push).toHaveBeenLastCalledWith('/business/office/clients/client-c?tab=stammdaten');
    state.permissions = [...permissions]; await render(); await choose('Clara Ziegler');
    await click(button('Stammdaten ergänzen')); expect(state.push).toHaveBeenLastCalledWith('/business/office/clients/client-c?edit=1');
  });

  it('does not silently switch the selected person when a search hides them', async () => {
    await render(); await choose('Ben Schuster'); await search('Anna');
    expect(detail()).toBeNull(); expect(host.textContent).toContain('passt nicht zur aktuellen Suche');
    expect(names()).toEqual(['Anna Müller']);
    await search(''); expect(selectedName()).toBe('Ben Schuster');
  });
});

describe('Assist URL restoration and refresh safety', () => {
  it('does not change the visible route from an unfocused workspace refresh', async () => {
    state.params = { clientId: 'client-a' }; await render();
    state.focused = false; state.live.mockClear(); await render();
    expect(state.live.mock.calls.every(([options]) => options.enabled === false)).toBe(true);
    state.setParams.mockClear();
    state.fetch.mockResolvedValue(result(snapshot(fixtureClients().slice(1)))); await refresh();
    expect(state.setParams).not.toHaveBeenCalled();
    state.focused = true; await render();
    expect(detail()).toBeNull(); expect(host.textContent).toContain('nicht mehr aktiv Assist zugeordnet');
    expect(state.setParams).toHaveBeenLastCalledWith({ clientId: undefined, record: undefined, assistDetail: undefined });
  });

  it('wires periodic and focus refresh to the real query without replacing manual selection', async () => {
    await render(); await choose('Ben Schuster');
    const liveOptions = state.live.mock.calls.map(([options]) => options).filter(options => options.enabled).pop();
    expect(liveOptions).toMatchObject({ enabled: true, pollMs: 60000, refreshOnFocus: true });
    const clients = fixtureClients(); clients[1] = { ...clients[1], costCarrier: 'Aktualisierte Kasse', insuranceNumber: 'N987654321' };
    state.fetch.mockResolvedValue(result(snapshot(clients)));
    await act(async () => { liveOptions.onRefresh(); });
    expect(state.fetch).toHaveBeenCalledTimes(2); expect(selectedName()).toBe('Ben Schuster');
    expect(host.querySelector('[data-testid="assist-client-carrier"]')?.textContent).toContain('Aktualisierte Kasse');
  });

  it('restores repeated URL parameters and allows a manual choice to survive refresh with an old URL', async () => {
    state.params = { clientId: ['client-b', 'client-a'] }; await render(); expect(selectedName()).toBe('Ben Schuster');
    await choose('Anna Müller'); await refresh(); expect(selectedName()).toBe('Anna Müller');
    state.params = { clientId: 'client-a' }; await render(); expect(selectedName()).toBe('Anna Müller');
    state.params = { clientId: 'client-b' }; await render(); expect(selectedName()).toBe('Ben Schuster');
    state.params = { record: ['client-c', 'client-b'] }; await render(); expect(selectedName()).toBe('Clara Ziegler');
  });

  it('restores filters, sort, search and compact detail state from the URL', async () => {
    state.params = { clientId: 'client-b', assistSearch: ['Bochum', 'Herne'], assistFilter: ['planned'], assistSort: ['next_visit'], assistDetail: '0' };
    await render(); expect(names()).toEqual(['Ben Schuster']); expect(selectedName()).toBe('Ben Schuster');
    expect(host.querySelector<HTMLInputElement>('input[type=search]')?.value).toBe('Bochum');
    expect(filterButton('Mit Einsatz').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector<HTMLSelectElement>('select')?.value).toBe('next_visit');
    expect(host.querySelector('[data-assist-clients]')?.getAttribute('data-detail-open')).toBe('false');
    await search('Anna'); await click(filterButton('Alle')); await sort('attention'); await refresh();
    expect(names()).toEqual(['Anna Müller']); expect(host.querySelector<HTMLSelectElement>('select')?.value).toBe('attention');
    state.params = { assistSearch: 'Dortmund', assistFilter: 'attention', assistSort: 'name', clientId: 'client-c', assistDetail: '1' };
    await render(); expect(names()).toEqual(['Clara Ziegler']); expect(selectedName()).toBe('Clara Ziegler');
  });

  it('shows an invalid deep link without opening or navigating to the first person', async () => {
    state.params = { clientId: ['outside-tenant', 'client-a'] }; await render();
    expect(detail()).toBeNull(); expect(host.textContent).toContain('Die verlinkte Person');
    expect(state.setParams).not.toHaveBeenCalled(); await refresh(); expect(detail()).toBeNull();
    await choose('Ben Schuster'); expect(selectedName()).toBe('Ben Schuster');
  });

  it('clears a removed person and waits for an explicit alternative even after the URL is cleared', async () => {
    state.params = { clientId: 'client-a' }; await render();
    state.fetch.mockResolvedValue(result(snapshot(fixtureClients().slice(1)))); await refresh();
    expect(detail()).toBeNull(); expect(host.textContent).toContain('nicht mehr aktiv Assist zugeordnet');
    expect(state.setParams).toHaveBeenLastCalledWith({ clientId: undefined, record: undefined, assistDetail: undefined });
    state.params = {}; await render(); await refresh(); expect(detail()).toBeNull();
    await choose('Ben Schuster'); expect(selectedName()).toBe('Ben Schuster');
  });

  it('retains the current data and person with an explicit refresh error, then recovers on retry', async () => {
    await render(); await choose('Ben Schuster');
    state.fetch.mockResolvedValue({ ok: false, error: 'Abfrage abgelehnt.' }); await refresh();
    expect(selectedName()).toBe('Ben Schuster'); expect(names()).toHaveLength(3);
    expect(host.querySelector('[role=alert]')?.textContent).toContain('zuletzt geladene Stand');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Abfrage abgelehnt.');
    expect(state.officeFetch).not.toHaveBeenCalled();
    state.fetch.mockResolvedValue(result()); await click(button('Erneut laden'));
    expect(host.querySelector('[role=alert]')).toBeNull(); expect(selectedName()).toBe('Ben Schuster');
  });

  it('distinguishes first-load failure from an empty roster and retries the dedicated source', async () => {
    state.fetch.mockResolvedValue({ ok: false, error: 'Abfrage abgelehnt.' }); await render();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Assist-Übersicht konnte nicht geladen werden');
    expect(host.textContent).not.toContain('Noch keine aktiven Assist-Zuordnungen'); expect(detail()).toBeNull();
    state.fetch.mockResolvedValue(result(snapshot([]))); await click(button('Erneut laden'));
    expect(host.querySelector('[role=alert]')).toBeNull(); expect(host.textContent).toContain('Noch keine aktiven Assist-Zuordnungen');
    expect(detail()).toBeNull(); await click(button('Zuordnungen öffnen'));
    expect(state.push).toHaveBeenLastCalledWith('/business/office/modules/clients'); expect(state.officeFetch).not.toHaveBeenCalled();
  });
});

describe('Assist detail evidence and partial data', () => {
  it('shows missing planning as unknown, disables misleading filters and retries a failed planning read', async () => {
    const clients = fixtureClients().map(client => ({ ...client, upcomingVisits: [], nextVisit: null, sevenDayVisitCount: null, planningStatus: 'unknown' as const }));
    state.fetch.mockResolvedValue(result(snapshot(clients, { visitsAvailable: false, visitsError: 'Einsatzplanung nicht freigegeben.' })));
    await render();
    expect(metric('Einsätze in 7 Tagen').querySelector('.acw-metric-number')?.textContent).toBe('—');
    expect(metric('Ohne Einsatz').querySelector('.acw-metric-number')?.textContent).toBe('—');
    for (const label of ['Mit Einsatz', 'Ohne Einsatz', 'Nächste 7 Tage']) expect(filterButton(label).disabled).toBe(true);
    expect(metric('Einsätze in 7 Tagen').disabled).toBe(true); expect(metric('Ohne Einsatz').disabled).toBe(true);
    expect(host.textContent).toContain('Planung nicht verfügbar'); expect(detail()?.textContent).toContain('Nicht verfügbar');
    expect(detail()?.textContent).not.toContain('ist kein weiterer Einsatz geplant');
    state.fetch.mockResolvedValue(result()); await click(button('Planung erneut laden'));
    expect(metric('Einsätze in 7 Tagen').querySelector('.acw-metric-number')?.textContent).toBe('3'); expect(filterButton('Mit Einsatz').disabled).toBe(false);
  });

  it('places the matching member number within the carrier fact and provides valid direct contacts', async () => {
    await render();
    const carrier = host.querySelector('[data-testid="assist-client-carrier"]')!;
    expect(carrier.querySelector('dt')?.textContent).toBe('Kostenträger');
    expect(carrier.querySelector('dd')?.firstChild?.textContent).toBe('Techniker Krankenkasse');
    expect(carrier.querySelector('dd > small')?.textContent).toBe('Versichertennummer: A123456789');
    expect(detail()?.querySelector('a[href="tel:02323123456"]')).toBeTruthy();
    expect(detail()?.querySelector('a[href="tel:+491711234567"]')).toBeTruthy();
    expect(detail()?.querySelector('a[href="mailto:anna%40example.test"]')).toBeTruthy();
    const responsibility = [...detail()!.querySelectorAll('dt')].find(item => item.textContent === 'Feste Zuständigkeit')?.nextElementSibling;
    expect(responsibility?.textContent).toContain('Anne Adler');
    expect(detail()?.querySelector('.acw-visits')?.textContent).toContain('Jonas Berger');
  });

  it('does not call assigned staff unassigned when their names are unavailable', async () => {
    const clients = fixtureClients();
    const visits = [visit('visit-private-staff', 'client-a', { employeeName: null })];
    clients[0] = { ...clients[0], primaryEmployeeName: null, primaryEmployeeAvailable: false, upcomingVisits: visits, nextVisit: visits[0] };
    state.fetch.mockResolvedValue(result(snapshot(clients))); await render();
    expect(rows()[0].querySelector('.acw-row-planning')?.textContent).toContain('Mitarbeitende zugeordnet');
    expect(detail()?.querySelector('.acw-visits')?.textContent).toContain('Mitarbeitende zugeordnet');
    expect(detail()?.querySelector('.acw-visits')?.textContent).not.toContain('Mitarbeitende noch nicht zugeordnet');
    const responsibility = [...detail()!.querySelectorAll('dt')].find(item => item.textContent === 'Feste Zuständigkeit')?.nextElementSibling;
    expect(responsibility?.textContent).toContain('Mitarbeitende zugeordnet');
  });

  it('preserves real lifecycle labels and exposes all upcoming visits through load more', async () => {
    const labels = ['Geplant', 'Bestätigt', 'Unterwegs', 'In Durchführung', 'Pausiert', 'Angekommen', 'Planung prüfen'];
    const visits = labels.map((label, index) => visit('visit-' + index, 'client-a', {
      scheduledStart: `2026-10-${String(18 + index).padStart(2, '0')}T08:00:00Z`,
      scheduledEnd: `2026-10-${String(18 + index).padStart(2, '0')}T09:00:00Z`,
      status: index === 0 || index === 6 ? 'planned' : index === 1 ? 'confirmed' : 'active', statusLabel: label,
    }));
    const clients = fixtureClients(); clients[0] = { ...clients[0], upcomingVisits: visits, nextVisit: visits[0], sevenDayVisitCount: 6 };
    state.fetch.mockResolvedValue(result(snapshot(clients))); await render();
    expect(detail()?.querySelectorAll('.acw-visit')).toHaveLength(5);
    expect([...detail()!.querySelectorAll('.acw-visit .acw-badge')].map(item => item.textContent)).toEqual(labels.slice(0, 5));
    await click(button('Weitere Einsätze anzeigen (2)'));
    expect(detail()?.querySelectorAll('.acw-visit')).toHaveLength(7);
    expect([...detail()!.querySelectorAll('.acw-visit .acw-badge')].map(item => item.textContent)).toEqual(labels);
    expect(detail()?.querySelector('.acw-more')).toBeNull();
    await click(detail()!.querySelectorAll<HTMLButtonElement>('.acw-visit')[6]); expect(state.push).toHaveBeenLastCalledWith('/assist/assignments/visit-6');
    await choose('Ben Schuster'); await choose('Anna Müller'); expect(detail()?.querySelectorAll('.acw-visit')).toHaveLength(5);
  });
});
