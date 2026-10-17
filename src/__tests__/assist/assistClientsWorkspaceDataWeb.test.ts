import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types/permissions';
import { activeAssistAssignments, addAssistDays, assistBerlinTimestamp, assistWorkspaceCoverage, assistText, buildAssistClientsWorkspace, buildAssistWorkspaceVisits, filterAssistWorkspaceClients, summarizeAssistWorkspaceClients, validAssistDate, type AssistWorkspaceSource, type AssistWorkspaceRow } from '@/lib/assist/assistClientsWorkspaceModel.web';
type Call = { table: string; ops: [string, unknown[]][] };
const state = vi.hoisted(() => ({ calls: [] as Call[], resolve: vi.fn(), client: {} as object | null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.client }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_: unknown, table: string) => chain(table) }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (id: string) => id === 'tenant-1' ? null : { ok: false, error: 'Kein Zugriff.' } }));
function chain(table: string) {
  const call: Call = { table, ops: [] }; state.calls.push(call);
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'lte', 'gte', 'lt', 'neq', 'order', 'range', 'or', 'is']) query[method] = (...args: unknown[]) => { call.ops.push([method, args]); return query; };
  query.then = (yes: (result: unknown) => void, no: (error: unknown) => void) => Promise.resolve().then(() => state.resolve(call)).then(yes, no);
  return query;
}
import { fetchAssistClientsWorkspace } from '@/lib/assist/assistClientsWorkspaceService.web';
const now = new Date('2026-10-17T10:00:00Z');
const clientId = 'client-1';
const visitId = '11111111-1111-4111-8111-111111111111';
const assignment = (changes: AssistWorkspaceRow = {}) => ({ id: 'membership-1', tenant_id: 'tenant-1', client_id: clientId, module_key: 'assist', assigned_at: '2026-01-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', is_active: true, status: 'active', primary_employee_id: 'employee-1', ...changes });
const person = (changes: AssistWorkspaceRow = {}) => ({ id: clientId, tenant_id: 'tenant-1', first_name: 'Erika', last_name: 'Müller', client_number: 'K-001', care_level: 'pg2', date_of_birth: '1950-05-02', status: 'active', phone: '02323 100', street: 'Testweg', house_number: '7', postal_code: '44623', city: 'Herne', cost_bearer: 'Alte Kasse', insurance_number: 'A123', ...changes });
const employee = (changes: AssistWorkspaceRow = {}) => ({ id: 'employee-1', tenant_id: 'tenant-1', first_name: 'Anne', last_name: 'Beispiel', status: 'active', entry_date: '2026-01-01', ...changes });
const visit = (changes: AssistWorkspaceRow = {}) => ({ id: visitId, tenant_id: 'tenant-1', client_id: clientId, employee_id: 'employee-1', title: 'Alltagsbegleitung', assignment_date: '2026-10-20', planned_start_at: '2026-10-20T08:00:00Z', planned_end_at: '2026-10-20T09:00:00Z', planning_status: 'scheduled', execution_status: 'pending', canonical_status: 'planned', recurrence_json: { pattern: 'none' }, ...changes });
const source = (changes: Partial<AssistWorkspaceSource> = {}): AssistWorkspaceSource => ({ tenantId: 'tenant-1', now, assignments: [assignment()], people: [person()], entitlements: [], careLevels: [], insurance: [], employees: [employee()], employeesAvailable: true, visits: [visit()], visitsAvailable: true, ...changes });
const permissions: PermissionKey[] = ['assist.access', 'office.access', 'office.clients.view', 'assist.assignments.view', 'office.employees.view'];
const load = (changes: Partial<Parameters<typeof fetchAssistClientsWorkspace>[0]> = {}) => fetchAssistClientsWorkspace({ tenantId: 'tenant-1', roleKey: 'business_admin', effectivePermissions: permissions, now, ...changes });
beforeEach(() => {
  state.calls = []; state.client = {}; state.resolve.mockReset();
  state.resolve.mockImplementation((call: Call) => ({ error: null, data: call.table === 'client_module_assignments' ? [assignment()] : call.table === 'clients' ? [person()] : call.table === 'employees' ? [employee()] : call.table === 'assist_visits' ? [visit()] : [] }));
});

describe('active Assist roster and concrete record quality', () => {
  it('requires active same-tenant Assist membership effective now and chooses one current relation per person', () => {
    const rows = [assignment(), assignment({ id: 'new', updated_at: '2026-10-02T10:00:00Z' }), assignment({ id: 'inactive', is_active: false, updated_at: '2026-10-03T10:00:00Z' }), assignment({ client_id: 'draft', status: 'draft' }), assignment({ client_id: 'future', assigned_at: '2027-01-01T00:00:00Z' }), assignment({ client_id: 'foreign', tenant_id: 'tenant-2' }), assignment({ client_id: 'office', module_key: 'office' })];
    expect(activeAssistAssignments(rows, 'tenant-1', now).map(row => row.id)).toEqual(['new']);
  });
  it('does not infer Assist membership from clients, default products or an old visit', () => { expect(buildAssistClientsWorkspace(source({ assignments: [] })).clients).toEqual([]); });
  it('does not show deleted or archived records with a leftover active relation', () => {
    for (const changes of [{ deleted_at: now.toISOString() }, { status: 'archived' }, { status: 'deleted' }]) expect(buildAssistClientsWorkspace(source({ people: [person(changes)] })).clients).toEqual([]);
  });
  it('reports an unavailable linked client instead of displaying an invented person', () => {
    const result = buildAssistClientsWorkspace(source({ people: [] })); expect(result.clients).toEqual([]); expect(result.warnings).toHaveLength(1);
  });
  it('uses currently valid canonical care and matching carrier/member pair over stale legacy fields', () => {
    const result = buildAssistClientsWorkspace(source({ entitlements: [ { id: 'old', tenant_id: 'tenant-1', client_id: clientId, valid_from: '2025-01-01', valid_until: '2026-10-16', care_grade: 'pg1' }, { id: 'current', tenant_id: 'tenant-1', client_id: clientId, valid_from: '2026-10-17', valid_until: null, care_grade: 'pg3', care_fund_name: 'Neue Kasse', care_fund_member_id: null }, { id: 'future', tenant_id: 'tenant-1', client_id: clientId, valid_from: '2027-01-01', care_grade: 'pg5' } ] }));
    expect(result.clients[0]).toMatchObject({ careLevel: 'pg3', careLevelLabel: 'Pflegegrad 3', costCarrier: 'Neue Kasse', insuranceNumber: null });
    expect(result.clients[0].missingFields).toContain('Versichertennummer');
  });
  it('never pairs an insurance-profile health fund with a stale base-record member number', () => {
    const result = buildAssistClientsWorkspace(source({ people: [person({ cost_bearer: null, insurance_name: 'Old', insurance_number: 'OLD-NUMBER' })], insurance: [{ tenant_id: 'tenant-1', client_id: clientId, is_primary: true, health_insurance: 'Current', insurance_number: 'CURRENT-NUMBER' }] }));
    expect(result.clients[0]).toMatchObject({ costCarrier: 'Current', insuranceNumber: 'CURRENT-NUMBER' });
  });
  it('falls back to current legacy care, then base record and current primary insurance', () => {
    const legacy = { id: 'care', tenant_id: 'tenant-1', client_id: clientId, valid_from: '2026-01-01', grade: 'pg4' };
    expect(buildAssistClientsWorkspace(source({ careLevels: [legacy] })).clients[0].careLevel).toBe('pg4');
    const insurance = { id: 'insurance', tenant_id: 'tenant-1', client_id: clientId, is_primary: true, care_level: 'pg3', care_level_valid_from: '2027-01-01' };
    expect(buildAssistClientsWorkspace(source({ people: [person({ care_level: null })], insurance: [insurance] })).clients[0].careLevel).toBeNull();
  });
  it('does not expose a mirrored future or expired grade as current when dated records exist', () => {
    for (const dates of [{ valid_from: '2027-01-01', valid_until: null }, { valid_from: '2025-01-01', valid_until: '2026-10-16' }]) {
      const result = buildAssistClientsWorkspace(source({ entitlements: [{ id: 'dated', tenant_id: 'tenant-1', client_id: clientId, care_grade: 'pg2', ...dates }] }));
      expect(result.clients[0].careLevel).toBeNull(); expect(result.clients[0].missingFields).toContain('Pflegegrad');
    }
  });
  it('does not flag an explicitly absent care grade as missing or impose insurance fields on self pay', () => {
    expect(buildAssistClientsWorkspace(source({ people: [person({ care_level: 'none' })] })).clients[0].missingFields).not.toContain('Pflegegrad');
    const result = buildAssistClientsWorkspace(source({ people: [person({ billing_party: 'self_pay', care_level: null, cost_bearer: null, insurance_number: null })] }));
    expect(result.clients[0].missingFields).toEqual([]);
  });
  it('identifies precise missing information and normalizes placeholder phones', () => {
    const result = buildAssistClientsWorkspace(source({ people: [person({ phone: ' — ', mobile: '-', city: ' ', date_of_birth: '2026-02-30' })] }));
    expect(result.clients[0]).toMatchObject({ phone: null, mobile: null, dateOfBirth: null, needsAttention: true });
    expect(result.clients[0].missingFields).toEqual(['Geburtsdatum', 'Vollständige Einsatzadresse', 'Telefonnummer']);
    expect(assistText(' n/a ')).toBeNull();
  });
  it('keeps actual primary responsibility distinct from planned staff and warns on expired responsibility', () => {
    const result = buildAssistClientsWorkspace(source({ employees: [employee({ exit_date: '2026-10-16' }), employee({ id: 'employee-2', first_name: 'Berta' })], visits: [visit({ employee_id: 'employee-2' })] }));
    expect(result.clients[0]).toMatchObject({ primaryEmployeeId: 'employee-1', primaryEmployeeName: 'Anne Beispiel', primaryEmployeeAvailable: false });
    expect(result.clients[0].nextVisit?.employeeName).toBe('Berta Beispiel'); expect(result.clients[0].warnings).toHaveLength(1);
  });
  it('does not call a hidden staff member unassigned or inactive', () => {
    const result = buildAssistClientsWorkspace(source({ employees: [], employeesAvailable: false }));
    expect(result.clients[0].primaryEmployeeId).toBe('employee-1'); expect(result.clients[0].warnings).toEqual([]);
  });
});

describe('planning lifecycle, period and recurring identity', () => {
  it.each(['finished', 'documentation_open', 'signature_open', 'completed', 'cancelled', 'no_show', 'beendet', 'dokumentation_offen', 'unterschrift_offen'])('excludes future-dated %s visits from upcoming and unplanned counts', status => {
    expect(buildAssistClientsWorkspace(source({ visits: [visit({ canonical_status: status })] })).clients[0]).toMatchObject({ upcomingVisits: [], planningStatus: 'unplanned', sevenDayVisitCount: 0 });
  });
  it('excludes drafts, ended execution and independent legacy cancellations even when canonical planning is stale', () => {
    for (const changes of [{ planning_status: 'draft' }, { execution_status: 'completed' }, { actual_end_at: '2026-10-20T08:30:00Z' }]) expect(buildAssistWorkspaceVisits(source({ visits: [visit(changes)] }))).toEqual([]);
    expect(buildAssistWorkspaceVisits(source({ visits: [visit({ legacy_assignment_id: 'legacy-1' })], legacyAssignments: [{ id: 'legacy-1', tenant_id: 'tenant-1', status: 'cancelled' }] }))).toEqual([]);
    expect(buildAssistWorkspaceVisits(source({ executionStates: [{ tenant_id: 'tenant-1', visit_id: visitId, assignment_status: 'dokumentation_offen', service_ended_at: '2026-10-20T08:30:00Z' }] }))).toEqual([]);
  });
  it('includes an ongoing visit and distinguishes confirmed from planned', () => {
    const result = buildAssistWorkspaceVisits(source({ visits: [visit({ planned_start_at: '2026-10-17T09:30:00Z', planned_end_at: '2026-10-17T10:30:00Z', execution_status: 'in_progress' }), visit({ id: 'other', planning_status: 'confirmed' })] }));
    expect(result.map(item => item.status)).toEqual(['active', 'confirmed']);
  });
  it('retains a real ongoing visit beyond its planned end while excluding expired unstarted plans', () => {
    const late = visit({ planned_start_at: '2026-10-17T08:00:00Z', planned_end_at: '2026-10-17T09:00:00Z' });
    expect(buildAssistWorkspaceVisits(source({ visits: [late] }))).toEqual([]);
    expect(buildAssistWorkspaceVisits(source({ visits: [{ ...late, execution_status: 'in_progress' }] }))[0].status).toBe('active');
  });
  it('uses Berlin calendar dates across DST and midnight rather than browser-local or UTC dates', () => {
    expect(assistWorkspaceCoverage(new Date('2026-10-17T23:30:00Z'))).toEqual({ fromDate: '2026-10-18', toDate: '2027-01-15', sevenDayToDate: '2026-10-24' });
    expect(assistBerlinTimestamp('2026-10-24', '10:00:00')).toBe('2026-10-24T08:00:00.000Z');
    expect(assistBerlinTimestamp('2026-10-25', '10:00:00')).toBe('2026-10-25T09:00:00.000Z');
    expect(validAssistDate('2026-02-30')).toBe(false); expect(validAssistDate('2028-02-29')).toBe(true);
  });
  it('limits seven-day metrics to today plus six days and the future horizon to ninety days', () => {
    const coverage = assistWorkspaceCoverage(now);
    const visits = [visit({ id: 'within', planned_start_at: assistBerlinTimestamp(coverage.sevenDayToDate, '23:00:00'), planned_end_at: assistBerlinTimestamp(addAssistDays(coverage.sevenDayToDate, 1)) }), visit({ id: 'later', planned_start_at: assistBerlinTimestamp(addAssistDays(coverage.sevenDayToDate, 1), '10:00:00'), planned_end_at: assistBerlinTimestamp(addAssistDays(coverage.sevenDayToDate, 1), '11:00:00') }), visit({ id: 'outside', planned_start_at: assistBerlinTimestamp(addAssistDays(coverage.toDate, 1), '10:00:00'), planned_end_at: assistBerlinTimestamp(addAssistDays(coverage.toDate, 1), '11:00:00') })];
    expect(buildAssistClientsWorkspace(source({ visits })).clients[0]).toMatchObject({ sevenDayVisitCount: 1, upcomingVisits: [expect.objectContaining({ id: 'within' }), expect.objectContaining({ id: 'later' })] });
  });
  it('expands long-running daily series past the old 52 occurrence cap and preserves detail route IDs', () => {
    const result = buildAssistWorkspaceVisits(source({ visits: [visit({ assignment_date: '2026-01-01', planned_start_at: '2026-01-01T09:00:00Z', planned_end_at: '2026-01-01T10:00:00Z', canonical_status: 'completed', execution_status: 'completed', recurrence_json: { pattern: 'daily' } })] }));
    expect(result.length).toBeGreaterThan(80); expect(result[0].id).toMatch(new RegExp(`^${visitId}::2026-10-`)); expect(result[0].status).toBe('confirmed');
    expect(result.find(item => item.id.endsWith('2026-10-25'))?.scheduledStart).toBe('2026-10-25T09:00:00.000Z');
  });
  it('keeps monthly month-end and fortnightly rules, occurrence counts and explicit end dates', () => {
    const january = new Date('2027-01-30T12:00:00Z');
    const monthly = buildAssistWorkspaceVisits(source({ now: january, visits: [visit({ assignment_date: '2027-01-31', planned_start_at: '2027-01-31T09:00:00Z', planned_end_at: '2027-01-31T10:00:00Z', recurrence_json: { pattern: 'monthly', occurrenceCount: 3 } })] }));
    expect(monthly.map(item => item.scheduledStart.slice(0, 10))).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    const fortnight = buildAssistWorkspaceVisits(source({ visits: [visit({ recurrence_json: { pattern: 'biweekly', weekdays: ['di'], endDate: '2026-11-05' } })] }));
    expect(fortnight.map(item => item.scheduledStart.slice(0, 10))).toEqual(['2026-10-20', '2026-11-03']);
  });
  it('keeps overnight series end dates after the start', () => {
    const result = buildAssistWorkspaceVisits(source({ visits: [visit({ assignment_date: '2026-10-16', planned_start_at: '2026-10-16T21:00:00Z', planned_end_at: '2026-10-17T00:00:00Z', recurrence_json: { pattern: 'daily', occurrenceCount: 3 } })] }));
    expect(result.map(item => item.durationMinutes)).toEqual([180, 180]);
  });
  it('does not resurrect detached or materialized occurrences when the child is absent', () => {
    const result = buildAssistWorkspaceVisits(source({ visits: [visit({ recurrence_json: { pattern: 'daily', occurrenceCount: 3, detachedOccurrenceDates: ['2026-10-21'], materializedOccurrences: { '2026-10-22': 'moved-child' } } })] }));
    expect(result.map(item => item.id)).toEqual([visitId]);
  });
  it('physical cancelled children override synthesized dates and duplicate physical copies', () => {
    const child = visit({ id: 'child', assignment_date: '2026-10-21', planned_start_at: '2026-10-21T08:00:00Z', planned_end_at: '2026-10-21T09:00:00Z', canonical_status: 'cancelled', recurrence_json: { pattern: 'none', parentSeriesId: visitId, sourceOccurrenceDate: '2026-10-21' } });
    const result = buildAssistWorkspaceVisits(source({ visits: [visit({ recurrence_json: { pattern: 'daily', occurrenceCount: 2 } }), child, { ...child, id: 'duplicate', canonical_status: 'planned' }] }));
    expect(result.map(item => item.id)).toEqual([visitId]);
  });
  it('neutralizes copied completion on physical series children without their own execution evidence', () => {
    const copied = visit({ id: 'child', canonical_status: 'completed', execution_status: 'completed', recurrence_json: { pattern: 'none', parentSeriesId: visitId, sourceOccurrenceDate: '2026-10-20' } });
    expect(buildAssistWorkspaceVisits(source({ visits: [copied] }))[0].status).toBe('confirmed');
    expect(buildAssistWorkspaceVisits(source({ visits: [{ ...copied, actual_end_at: '2026-10-20T08:30:00Z' }] }))).toEqual([]);
    expect(buildAssistWorkspaceVisits(source({ visits: [{ ...copied, proof_status: 'signed' }] }))).toEqual([]);
    expect(buildAssistWorkspaceVisits(source({ visits: [{ ...copied, documentation_status: 'complete' }] }))).toEqual([]);
  });
  it('does not overlay a parent legacy execution mirror onto a child occurrence', () => {
    const master = visit({ legacy_assignment_id: 'shared', actual_end_at: '2026-10-20T08:30:00Z', recurrence_json: { pattern: 'daily', occurrenceCount: 1 } });
    const child = visit({ id: 'child', legacy_assignment_id: 'shared', recurrence_json: { pattern: 'none', parentSeriesId: visitId, sourceOccurrenceDate: '2026-10-21' } });
    expect(buildAssistWorkspaceVisits(source({ visits: [master, child], legacyAssignments: [{ id: 'shared', tenant_id: 'tenant-1', status: 'completed', actual_end_at: '2026-10-20T08:30:00Z' }] })).map(item => item.id)).toEqual(['child']);
  });
  it('keeps deliberate independent visits at the same time rather than guessing duplicates', () => { expect(buildAssistWorkspaceVisits(source({ visits: [visit(), visit({ id: 'independent' })] }))).toHaveLength(2); });
  it('reports invalid active schedules without converting unavailable planning into an empty count', () => {
    const result = buildAssistClientsWorkspace(source({ visits: [visit({ planned_start_at: 'invalid' })] }));
    expect(result.visitsAvailable).toBe(false); expect(result.clients[0]).toMatchObject({ planningStatus: 'unknown', sevenDayVisitCount: null });
    expect(summarizeAssistWorkspaceClients(result.clients, result.visitsAvailable)).toMatchObject({ planned: null, unplanned: null, sevenDayVisits: null });
  });
  it('does not silently shift a nonexistent spring DST series time', () => {
    expect(() => assistBerlinTimestamp('2027-03-28', '02:30:00')).toThrow();
  });
});

describe('search and honest filtering', () => {
  it('searches accents, multiple terms, city, client number and planned employees without changing responsibility', () => {
    const snapshot = buildAssistClientsWorkspace(source({ employees: [employee(), employee({ id: 'other', first_name: 'Berta', last_name: 'Strauß' })], visits: [visit({ employee_id: 'other' })] }));
    for (const query of ['muller herne', 'K-001', 'berta strauss', 'Pflegegrad 2', 'pg2']) expect(filterAssistWorkspaceClients(snapshot.clients, query)).toHaveLength(1);
    expect(snapshot.clients[0].primaryEmployeeName).toBe('Anne Beispiel');
  });
  it('keeps unavailable planning out of both planned and unplanned filters', () => {
    const snapshot = buildAssistClientsWorkspace(source({ visitsAvailable: false, visitsError: 'Nicht freigegeben.' }));
    expect(filterAssistWorkspaceClients(snapshot.clients, '', 'planned')).toEqual([]); expect(filterAssistWorkspaceClients(snapshot.clients, '', 'unplanned')).toEqual([]);
  });
});

describe('scoped, paginated read-only Web service', () => {
  it('blocks foreign tenants, portal roles and an explicitly empty permission set before reading data', async () => {
    for (const input of [{ tenantId: 'foreign' }, { roleKey: 'employee_portal' as const }, { effectivePermissions: [] }]) expect((await load(input)).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });
  it('loads only assigned people and relevant planning, with tenant filters on every read', async () => {
    const result = await load(); expect(result).toMatchObject({ ok: true, data: { clients: [{ id: clientId, planningStatus: 'planned' }] } });
    for (const call of state.calls) expect(call.ops).toContainEqual(['eq', ['tenant_id', 'tenant-1']]);
    const people = state.calls.find(call => call.table === 'clients')!;
    expect(people.ops).toContainEqual(['in', ['id', [clientId]]]);
    expect(state.calls.some(call => /budget|invoice|document/.test(call.table))).toBe(false);
    expect(state.calls.some(call => call.ops.some(([method]) => ['insert', 'update', 'upsert', 'delete', 'rpc'].includes(method)))).toBe(false);
  });
  it('does not request visits without explicit view permission or render unplanned zero', async () => {
    const result = await load({ effectivePermissions: permissions.filter(key => key !== 'assist.assignments.view') });
    expect(result).toMatchObject({ ok: true, data: { visitsAvailable: false, clients: [{ planningStatus: 'unknown', sevenDayVisitCount: null }] } });
    expect(state.calls.some(call => call.table === 'assist_visits')).toBe(false);
  });
  it('does not request names without staff access and retains the responsibility ID', async () => {
    const result = await load({ effectivePermissions: permissions.filter(key => key !== 'office.employees.view') });
    expect(result).toMatchObject({ ok: true, data: { clients: [{ primaryEmployeeId: 'employee-1', primaryEmployeeName: null, warnings: [] }] } });
    expect(state.calls.some(call => call.table === 'employees')).toBe(false);
  });
  it('returns visible core errors rather than filling a partial record with missing-field warnings', async () => {
    const original = state.resolve.getMockImplementation()!;
    state.resolve.mockImplementation((call: Call) => call.table === 'client_insurance_profiles' ? { data: null, error: { message: 'offline' } } : original(call));
    expect((await load()).ok).toBe(false);
  });
  it('keeps client records when visit or execution reads fail but marks all planning unknown', async () => {
    const original = state.resolve.getMockImplementation()!;
    state.resolve.mockImplementation((call: Call) => call.table === 'assist_visit_execution_state' ? { data: null, error: { message: 'offline' } } : original(call));
    expect(await load()).toMatchObject({ ok: true, data: { visitsAvailable: false, clients: [{ planningStatus: 'unknown', sevenDayVisitCount: null }] } });
  });
  it('loads still-running visits even when their planned end was several days ago', async () => {
    const original = state.resolve.getMockImplementation()!;
    state.resolve.mockImplementation((call: Call) => call.table === 'assist_visits' ? { error: null, data: call.ops.some(([method]) => method === 'or') ? [visit({ planned_start_at: '2026-10-14T08:00:00Z', planned_end_at: '2026-10-14T09:00:00Z', execution_status: 'in_progress' })] : [] } : original(call));
    const result = await load(); expect(result).toMatchObject({ ok: true, data: { clients: [{ nextVisit: { status: 'active' } }] } });
    const ongoing = state.calls.find(call => call.table === 'assist_visits' && call.ops.some(([method]) => method === 'or'))!;
    expect(ongoing.ops).toContainEqual(['is', ['actual_end_at', null]]); expect(ongoing.ops).toContainEqual(['is', ['finished_at', null]]);
    expect(ongoing.ops.some(([method]) => method === 'gte')).toBe(false);
  });
  it('paginates assignments beyond the server row limit with deterministic ordering', async () => {
    const original = state.resolve.getMockImplementation()!;
    state.resolve.mockImplementation((call: Call) => {
      if (call.table !== 'client_module_assignments') return original(call);
      const offset = call.ops.find(([method]) => method === 'range')?.[1][0];
      return { error: null, data: offset === 0 ? Array.from({ length: 500 }, (_, index) => assignment({ id: `relation-${index}`, client_id: `client-${index}` })) : [assignment({ id: 'last', client_id: 'client-500' })] };
    });
    expect((await load()).ok).toBe(true);
    const calls = state.calls.filter(call => call.table === 'client_module_assignments');
    expect(calls).toHaveLength(2); expect(calls[1].ops).toContainEqual(['range', [500, 999]]);
    expect(state.calls.filter(call => call.table === 'clients')).toHaveLength(6);
  });
  it('paginates concrete and recurring visits independently rather than using the first API page', async () => {
    const original = state.resolve.getMockImplementation()!;
    state.resolve.mockImplementation((call: Call) => {
      if (call.table !== 'assist_visits' || call.ops.some(([method]) => method === 'neq')) return original(call);
      const offset = call.ops.find(([method]) => method === 'range')?.[1][0];
      return { error: null, data: offset === 0 ? Array.from({ length: 500 }, (_, index) => visit({ id: `visit-${index}` })) : [visit({ id: 'last-visit' })] };
    });
    const result = await load();
    expect(result.ok && result.data.clients[0].upcomingVisits).toHaveLength(502);
    expect(state.calls.some(call => call.table === 'assist_visits' && call.ops.some(([method, args]) => method === 'range' && args[0] === 500))).toBe(true);
  });
  it('requires exact valid current time and does not fabricate demo data when the connection is absent', async () => {
    expect((await load({ now: new Date('invalid') })).ok).toBe(false);
    state.client = null; expect((await load()).ok).toBe(false); expect(state.calls).toEqual([]);
  });
});
