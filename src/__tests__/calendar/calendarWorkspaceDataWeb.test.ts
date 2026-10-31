import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
const f = vi.hoisted(() => ({
  permission: vi.fn(), blocked: vi.fn(), visits: vi.fn(), fallback: vi.fn(), client: {} as object | null,
  resolve: vi.fn(), calls: [] as { table: string; operations: [string, unknown[]][] }[],
}));
vi.mock('@/lib/permissions', () => ({ enforcePermission: f.permission }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: f.blocked }));
vi.mock('@/lib/services/mode', () => ({ isDemoMode: () => false, getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message: string }) => error.message }));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({ visitSupabaseRepository: { list: f.visits } }));
vi.mock('@/lib/calendar/calendarEventService', () => ({ getCalendarEvents: f.fallback }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const call = { table, operations: [] as [string, unknown[]][] }; f.calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'order', 'range', 'gte', 'lte', 'in', 'update']) chain[method] = (...args: unknown[]) => { call.operations.push([method, args]); return chain; };
  chain.then = (resolve: (result: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(() => f.resolve(call)).then(resolve, reject);
  chain.maybeSingle = () => Promise.resolve().then(() => f.resolve(call));
  return chain;
} }));
import { getWorkspaceCalendarEvents, mergeWorkspaceOperationalEvents } from '@/lib/calendar/calendarWorkspaceService';
import { archiveCustomCalendarEvent } from '@/lib/calendar/calendarWorkspaceMutations';
const params = { tenantId: 'tenant-a', actorRoleKey: 'business_admin' as const, config: { calendarScope: 'office' as const, moduleKey: 'all' as const, showAllModules: true }, rangeStart: '2026-10-01T00:00:00Z', rangeEnd: '2026-10-31T23:59:59Z' };
const event = (id: string): CalendarEvent => ({ id, title: 'Termin', start: '2026-10-17T08:00:00Z', end: '2026-10-17T09:00:00Z', type: 'termin', color: '#1685b5' });
const record = (id: string) => ({ id, tenant_id: 'tenant-a', module_key: 'office', source_type: 'custom_event', source_id: id, event_type: 'termin', title: 'Termin', start_at: '2026-10-17T08:00:00Z', end_at: '2026-10-17T09:00:00Z', all_day: false, status: 'aktiv', is_office_visible: true, is_module_visible: true, archived_at: null });
beforeEach(() => { vi.clearAllMocks(); f.client = {}; f.calls = []; f.permission.mockReturnValue(null); f.blocked.mockReturnValue(null); f.resolve.mockReturnValue({ data: [], error: null }); f.visits.mockResolvedValue({ ok: true, data: [] }); });
describe('Web calendar data completeness and mutation truth', () => {
  it('shows the names of every selected meeting participant after reloading the central record', async () => {
    f.resolve.mockImplementation((call) => ({ data: call.table === 'calendar_events'
      ? [{ ...record('meeting'), related_employee_id: 'employee-a', participant_employee_ids: ['employee-a', 'employee-b'] }]
      : call.table === 'employees' ? [{id:'employee-a',first_name:'Tom',last_name:'Neumann'},{id:'employee-b',first_name:'Mara',last_name:'Becker'}] : [], error: null }));
    const result = await getWorkspaceCalendarEvents(params);
    expect(result.ok && result.data.find(item => item.id === 'meeting')?.employeeName).toBe('Tom Neumann, Mara Becker');
  });
  it('propagates central query failures instead of showing an empty calendar', async () => {
    f.resolve.mockReturnValue({ data: null, error: { message: 'Kalenderzugriff abgelehnt' } });
    expect(await getWorkspaceCalendarEvents(params)).toEqual({ ok: false, error: 'Kalenderzugriff abgelehnt' });
    expect(f.visits).not.toHaveBeenCalled();
  });
  it('expands genuine visits even when the Office mirror is empty', async () => {
    f.visits.mockResolvedValue({ ok: true, data: [{ id: 'visit-1', scheduledStart: '2026-10-17T08:00:00Z', scheduledEnd: '2026-10-17T09:00:00Z', title: 'Betreuung', serviceName: 'Betreuung', assignmentStatus: 'geplant', employeeId: 'employee-a', clientId: 'client-a', clientName: 'Ada Klientin' }] });
    const result = await getWorkspaceCalendarEvents(params);
    expect(result.ok && result.data.some((item) => item.sourceId === 'visit-1')).toBe(true);
    expect(result.refreshError).toBeUndefined();
    expect(f.visits).toHaveBeenCalledWith('tenant-a', { dateFrom: params.rangeStart, dateTo: params.rangeEnd });
  });
  it('loads all pages including entries above the PostgREST default cap', async () => {
    f.resolve.mockImplementation((call) => {
      if (call.table !== 'calendar_events') return { data: [], error: null };
      const from = call.operations.find(([method]: [string]) => method === 'range')[1][0];
      return { data: Array.from({ length: from < 1000 ? 500 : 1 }, (_, index) => record(`record-${from + index}`)), error: null };
    });
    const result = await getWorkspaceCalendarEvents(params);
    expect(result.ok && result.data.filter((item) => item.type === 'termin')).toHaveLength(1001);
    const queries = f.calls.filter((call) => call.table === 'calendar_events');
    expect(queries).toHaveLength(3);
    for (const query of queries) expect(query.operations).toContainEqual(['eq', ['tenant_id', 'tenant-a']]);
  });
  it('marks visit failures as incomplete without hiding already loaded appointments', async () => {
    f.resolve.mockImplementation((call) => ({ data: call.table === 'calendar_events' ? [record('meeting')] : [], error: null }));
    f.visits.mockResolvedValue({ ok: false, error: 'Offline' });
    const result = await getWorkspaceCalendarEvents(params);
    expect(result.ok && result.data.some((item) => item.id === 'meeting')).toBe(true);
    expect(result.refreshError).toContain('Einsätze');
  });
  it('marks absence failures as unsafe for availability calculations', async () => {
    f.resolve.mockImplementation((call) => call.table === 'workforce_absences' ? { data: null, error: { message: 'Abwesenheiten offline' } } : { data: [], error: null });
    const result = await getWorkspaceCalendarEvents(params);
    expect(result.ok).toBe(true); expect(result.refreshError).toContain('Abwesenheiten');
  });
  it('does not request sources without their read permission', async () => {
    f.permission.mockImplementation((_role, permission) => permission === 'office.appointments.view' ? null : { ok: false, error: 'Nur Kalender' });
    await getWorkspaceCalendarEvents(params);
    expect(f.visits).not.toHaveBeenCalled();
    expect(f.calls.map((call) => call.table)).toEqual(['calendar_events']);
  });
  it('includes birthdays on the last Berlin day despite an earlier UTC date', async () => {
    f.resolve.mockImplementation((call) => ({ data: call.table === 'employees' ? [{ id: 'e', first_name: 'Ada', last_name: 'Team', date_of_birth: '1980-10-02' }] : [], error: null }));
    const result = await getWorkspaceCalendarEvents({ ...params, rangeStart: '2026-10-01T22:00:00Z', rangeEnd: '2026-10-02T21:59:59Z' });
    expect(result.ok && result.data.find((item) => item.type === 'geburtstag')?.start).toBe('2026-10-02T00:00:00.000Z');
  });
  it('retains birthdays in separate years while replacing stale absence mirrors', () => {
    const birthdays = [2026, 2027].map((year) => ({ ...event(`birth-${year}`), type: 'geburtstag' as const, sourceType: 'employee_birthday', sourceId: 'e', start: `${year}-10-17T00:00:00Z` }));
    const old = { ...event('old'), sourceType: 'absence', sourceId: 'absence-1' };
    const current = { ...event('current'), sourceType: 'workforce_absence', sourceId: 'absence-1' };
    expect(mergeWorkspaceOperationalEvents([old], [...birthdays, current]).map((item) => item.id)).toEqual(['birth-2026', 'current', 'birth-2027']);
  });
  it('checks calendar permission and tenant before any reads', async () => {
    f.permission.mockReturnValue({ ok: false, error: 'Verboten' });
    expect((await getWorkspaceCalendarEvents(params)).ok).toBe(false); expect(f.calls).toEqual([]);
    f.permission.mockReturnValue(null); f.blocked.mockReturnValue({ ok: false, error: 'Mandant' });
    expect((await getWorkspaceCalendarEvents(params)).ok).toBe(false); expect(f.calls).toEqual([]);
  });
  it('archives only a matching tenant custom entry and verifies the returned row', async () => {
    f.resolve.mockReturnValue({ data: { id: 'own', module_key: 'office' }, error: null });
    expect((await archiveCustomCalendarEvent('tenant-a', 'own', 'business_admin')).ok).toBe(true);
    expect(f.permission).toHaveBeenCalledWith('business_admin', 'office.appointments.edit');
    expect(f.calls[1].operations).toEqual(expect.arrayContaining([['eq', ['tenant_id', 'tenant-a']], ['eq', ['id', 'own']], ['eq', ['source_type', 'custom_event']], ['eq', ['module_key', 'office']], ['is', ['archived_at', null]], ['select', ['id']]]));
  });
  it('reports zero-row and failed archives honestly', async () => {
    f.resolve.mockResolvedValueOnce({ data: { id: 'other', module_key: 'office' }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    expect((await archiveCustomCalendarEvent('tenant-a', 'other', 'business_admin')).ok).toBe(false);
    f.resolve.mockReturnValue({ data: null, error: { message: 'Schreibzugriff fehlt' } });
    expect(await archiveCustomCalendarEvent('tenant-a', 'other', 'business_admin')).toEqual({ ok: false, error: 'Schreibzugriff fehlt' });
  });
  it('uses the stored module permission and rejects attempts to remove another module’s record', async () => {
    f.resolve.mockReturnValue({ data: { id: 'assist-event', module_key: 'assist' }, error: null });
    f.permission.mockImplementation((_role, permission) => permission === 'office.appointments.edit' ? null : { ok: false, error: 'Keine Assist-Schreibrechte' });
    expect((await archiveCustomCalendarEvent('tenant-a', 'assist-event', 'business_admin')).ok).toBe(false);
    expect(f.calls.flatMap((call) => call.operations).some(([method]) => method === 'update')).toBe(false);
    f.calls = []; f.permission.mockImplementation((_role, permission) => permission === 'assist.assignments.manage' ? null : { ok: false, error: 'Nur Assist' });
    expect((await archiveCustomCalendarEvent('tenant-a', 'assist-event', 'dispatch')).ok).toBe(true);
    expect(f.calls[1].operations).toContainEqual(['eq', ['module_key', 'assist']]);
  });
});
