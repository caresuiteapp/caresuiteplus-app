import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types/permissions';
import { assistBerlinTimestamp, type AssistWorkspaceRow } from '@/lib/assist/assistClientsWorkspaceModel.web';
import { buildAssistTourPlanning, getAssistReplacementCandidates, type AssistTourPlanningSource } from '@/lib/assist/assistTourPlanningModel.web';

type Call = { table: string; ops: [string, unknown[]][] };
const state = vi.hoisted(() => ({ calls: [] as Call[], resolve: vi.fn(), client: {} as object | null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.client }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_: unknown, table: string) => chain(table) }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (id: string) => id === 'tenant-1' ? null : { ok: false, error: 'Kein Zugriff.' } }));
function chain(table: string) {
  const call: Call = { table, ops: [] }; state.calls.push(call);
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'lte', 'gte', 'gt', 'lt', 'neq', 'order', 'range', 'is']) query[method] = (...args: unknown[]) => { call.ops.push([method, args]); return query; };
  query.then = (yes: (result: unknown) => void, no: (error: unknown) => void) => Promise.resolve().then(() => state.resolve(call)).then(yes, no);
  return query;
}
import { fetchAssistTourPlanning } from '@/lib/assist/assistTourPlanningService.web';
const date = '2026-10-18', now = new Date('2026-10-18T10:00:00Z');
const employee = (changes: AssistWorkspaceRow = {}) => ({ id: 'e1', tenant_id: 'tenant-1', first_name: 'Anne', last_name: 'Beispiel', status: 'active', role_title: 'Alltagsbegleiter', entry_date: '2026-01-01', ...changes });
const client = (changes: AssistWorkspaceRow = {}) => ({ id: 'c1', tenant_id: 'tenant-1', first_name: 'Erika', last_name: 'Beispiel', street: 'Testweg', house_number: '1', postal_code: '44623', city: 'Herne', ...changes });
const visit = (changes: AssistWorkspaceRow = {}) => ({ id: 'v1', tenant_id: 'tenant-1', client_id: 'c1', employee_id: 'e1', title: 'Begleitung', assignment_date: date, planned_start_at: '2026-10-18T08:00:00Z', planned_end_at: '2026-10-18T09:00:00Z', planning_status: 'scheduled', execution_status: 'pending', canonical_status: 'planned', recurrence_json: { pattern: 'none' }, ...changes });
const qualification = (changes: AssistWorkspaceRow = {}) => ({ id: 'q1', tenant_id: 'tenant-1', employee_id: 'e1', qualification_type: 'first_aid', title: 'Erste Hilfe', status: 'valid', verified_at: '2026-01-01T10:00:00Z', valid_until: '2027-01-01', ...changes });
const plan = (employeeId = 'e1', slots = [{ id: 's1', date, kind: 'available', startTime: '08:00', endTime: '18:00', label: '' }]) => ({ tenant_id: 'tenant-1', employee_id: employeeId, month: '2026-10-01', slots });
const source = (changes: Partial<AssistTourPlanningSource> = {}): AssistTourPlanningSource => ({ tenantId: 'tenant-1', date, now, visits: [visit()], clients: [client()], employees: [employee()], legacyAssignments: [], executionStates: [], plans: [plan()], absences: [], qualifications: [qualification()], checks: { employees: 'ready', availability: 'ready', absences: 'ready', qualifications: 'ready' }, ...changes });
const permissions: PermissionKey[] = ['assist.access', 'assist.assignments.view', 'assist.assignments.manage', 'office.employees.view', 'office.employees.absences.view'];
const load = (changes: Partial<Parameters<typeof fetchAssistTourPlanning>[0]> = {}) => fetchAssistTourPlanning({ tenantId: 'tenant-1', roleKey: 'business_admin', effectivePermissions: permissions, date, now, ...changes });

beforeEach(() => {
  state.calls = []; state.client = {}; state.resolve.mockReset();
  state.resolve.mockImplementation((call: Call) => ({ error: null, data: call.table === 'assist_visits' ? [visit()] : call.table === 'clients' ? [client()] : call.table === 'employees' ? [employee()] : call.table === 'employee_qualifications' ? [qualification()] : call.table === 'calendar_employee_month_plans' ? [plan()] : [] }));
});

describe('saved day tours and lifecycle', () => {
  it('shows real saved times and groups by actual employee, with a separate unassigned group', () => {
    const result = buildAssistTourPlanning(source({ visits: [visit(), visit({ id: 'v2', employee_id: null, planned_start_at: '2026-10-18T10:00:00Z', planned_end_at: '2026-10-18T11:30:00Z' })] }));
    expect(result.visits[0]).toMatchObject({ clientName: 'Erika Beispiel', address: 'Testweg 1, 44623 Herne', employeeName: 'Anne Beispiel', status: 'planned', issues: [] });
    expect(result.tours.map(tour => [tour.employeeId, tour.workMinutes])).toEqual([[null, 90], ['e1', 60]]);
  });
  it('includes completed and follow-up visits, and never offers them for reassignment', () => {
    for (const [status, expected] of [['completed', 'completed'], ['documentation_open', 'follow_up'], ['signature_pending', 'follow_up'], ['started', 'active'], ['cancelled', 'cancelled']] as const) {
      const result = buildAssistTourPlanning(source({ visits: [visit({ canonical_status: status })] }));
      expect(result.visits[0]).toMatchObject({ status: expected, canReassign: false });
    }
  });
  it('uses execution evidence and independent legacy status over stale planning', () => {
    expect(buildAssistTourPlanning(source({ executionStates: [{ tenant_id: 'tenant-1', visit_id: 'v1', assignment_status: 'dokumentation_offen', service_ended_at: '2026-10-18T08:55:00Z' }] })).visits[0].status).toBe('follow_up');
    expect(buildAssistTourPlanning(source({ visits: [visit({ legacy_assignment_id: 'a1' })], legacyAssignments: [{ tenant_id: 'tenant-1', id: 'a1', status: 'cancelled' }] })).visits[0].status).toBe('cancelled');
  });
  it('keeps ended execution in follow-up while documentation or signature is open', () => {
    for (const canonical_status of ['finished', 'documentation_open', 'signature_open', 'planned']) {
      const result = buildAssistTourPlanning(source({ visits: [visit({ canonical_status, execution_status: 'completed', actual_end_at: '2026-10-18T09:00:00Z' })] }));
      expect(result.visits[0]).toMatchObject({ status: 'follow_up', statusLabel: 'Nacharbeit offen', canReassign: false });
    }
    expect(buildAssistTourPlanning(source({ visits: [visit({ canonical_status: 'completed', execution_status: 'completed', actual_end_at: '2026-10-18T09:00:00Z', documentation_status: 'complete', proof_status: 'signed' })] })).visits[0].status).toBe('completed');
  });
  it('never offers plans with recorded travel, documentation, signature or actual times for replacement', () => {
    for (const changes of [{ on_the_way_at: '2026-10-18T07:45:00Z' }, { actual_start_at: '2026-10-18T08:00:00Z' }, { documentation_status: 'complete' }, { proof_status: 'signed' }, { proof_status: 'rejected' }, { billing_status: 'invoiced' }, { planning_status: 'draft' }]) {
      const result = buildAssistTourPlanning(source({ visits: [visit(changes)] }));
      expect(result.visits[0].canReassign).toBe(false); expect(getAssistReplacementCandidates(result, 'v1')).toEqual([]);
    }
  });
  it('does not infer an unknown or missing employee to be unassigned', () => {
    const result = buildAssistTourPlanning(source({ employees: [], checks: { employees: 'unknown', availability: 'ready', absences: 'ready', qualifications: 'ready' } }));
    expect(result.visits[0]).toMatchObject({ employeeId: 'e1', employeeName: null });
    expect(result.visits[0].issues.map(item => item.code)).toContain('employee_unknown');
    expect(result.visits[0].issues.map(item => item.code)).not.toContain('unassigned');
  });
  it('ignores foreign-tenant rows in every input source', () => {
    const result = buildAssistTourPlanning(source({ visits: [visit(), visit({ id: 'foreign', tenant_id: 'tenant-2' })], employees: [employee(), employee({ id: 'foreign', tenant_id: 'tenant-2' })], absences: [{ tenant_id: 'tenant-2', employee_id: 'e1', status: 'approved', starts_at: '2026-10-18T00:00:00Z', ends_at: '2026-10-19T00:00:00Z' }] }));
    expect(result.visits).toHaveLength(1); expect(result.employees).toHaveLength(1); expect(result.absences).toEqual([]); expect(result.visits[0].issues).toEqual([]);
  });
  it('clips overnight work totals to the Berlin day and excludes a visit ending exactly at midnight', () => {
    const result = buildAssistTourPlanning(source({ visits: [visit({ planned_start_at: '2026-10-17T21:00:00Z', planned_end_at: '2026-10-18T01:00:00Z' }), visit({ id: 'ended', planned_start_at: '2026-10-17T20:00:00Z', planned_end_at: '2026-10-17T22:00:00Z' })] }));
    expect(result.visits).toHaveLength(1); expect(result.tours[0].workMinutes).toBe(180);
  });
  it('shows missing address and unknown status explicitly', () => {
    const result = buildAssistTourPlanning(source({ clients: [client({ city: null })], visits: [visit({ canonical_status: 'unexpected', planning_status: 'unexpected' })] }));
    expect(result.visits[0]).toMatchObject({ address: null, status: 'unknown', canReassign: false });
    expect(result.visits[0].issues.map(item => item.code)).toEqual(expect.arrayContaining(['missing_address', 'status_unknown']));
  });
  it('rejects invalid date and visit times rather than rendering invented durations', () => {
    expect(() => buildAssistTourPlanning(source({ date: '2026-02-30' }))).toThrow();
    expect(() => buildAssistTourPlanning(source({ visits: [visit({ planned_end_at: 'invalid' })] }))).toThrow();
  });
});

describe('series identity and Berlin time', () => {
  const master = () => visit({ id: 'master', assignment_date: '2026-01-01', planned_start_at: '2026-01-01T09:00:00Z', planned_end_at: '2026-01-01T10:00:00Z', canonical_status: 'completed', actual_end_at: '2026-01-01T10:00:00Z', recurrence_json: { pattern: 'daily' } });
  it('expands series beyond the old 52-occurrence limit without copying master completion', () => {
    const result = buildAssistTourPlanning(source({ visits: [master()] }));
    expect(result.visits).toHaveLength(1);
    expect(result.visits[0]).toMatchObject({ id: 'master::2026-10-18', scheduledStart: '2026-10-18T08:00:00.000Z', status: 'confirmed', isVirtual: true });
  });
  it('keeps the Berlin clock after the DST switch', () => {
    expect(buildAssistTourPlanning(source({ date: '2026-10-25', visits: [master()] })).visits[0].scheduledStart).toBe('2026-10-25T09:00:00.000Z');
  });
  it('does not resurrect detached, materialized or moved occurrences', () => {
    for (const rule of [{ detachedOccurrenceDates: [date] }, { materializedOccurrences: { [date]: 'child' } }]) {
      expect(buildAssistTourPlanning(source({ visits: [{ ...master(), recurrence_json: { pattern: 'daily', ...rule } }] })).visits).toEqual([]);
    }
    const moved = visit({ id: 'child', planned_start_at: '2026-10-19T08:00:00Z', planned_end_at: '2026-10-19T09:00:00Z', recurrence_json: { pattern: 'none', parentSeriesId: 'master', sourceOccurrenceDate: date } });
    expect(buildAssistTourPlanning(source({ visits: [master(), moved] })).visits).toEqual([]);
  });
  it('shows physical cancellation once and gives it precedence over a duplicate planned child', () => {
    const child = visit({ id: 'child', canonical_status: 'cancelled', recurrence_json: { pattern: 'none', parentSeriesId: 'master', sourceOccurrenceDate: date } });
    const result = buildAssistTourPlanning(source({ visits: [master(), child, { ...child, id: 'duplicate', canonical_status: 'planned' }] }));
    expect(result.visits).toHaveLength(1); expect(result.visits[0]).toMatchObject({ id: 'child', status: 'cancelled' });
  });
  it('neutralizes copied series status only without occurrence-specific evidence', () => {
    const child = visit({ canonical_status: 'completed', recurrence_json: { pattern: 'none', parentSeriesId: 'master', sourceOccurrenceDate: date } });
    expect(buildAssistTourPlanning(source({ visits: [child] })).visits[0].status).toBe('confirmed');
    expect(buildAssistTourPlanning(source({ visits: [{ ...child, actual_end_at: '2026-10-18T09:00:00Z' }] })).visits[0].status).toBe('completed');
  });
  it('respects finite occurrence counts and monthly month-end rules', () => {
    expect(buildAssistTourPlanning(source({ visits: [{ ...master(), recurrence_json: { pattern: 'daily', occurrenceCount: 10 } }] })).visits).toEqual([]);
    const monthly = visit({ assignment_date: '2027-01-31', planned_start_at: '2027-01-31T09:00:00Z', planned_end_at: '2027-01-31T10:00:00Z', recurrence_json: { pattern: 'monthly' } });
    expect(buildAssistTourPlanning(source({ date: '2027-02-28', visits: [monthly] })).visits[0].scheduledStart).toBe('2027-02-28T09:00:00.000Z');
  });
});

describe('replacement checks fail closed on unknown data', () => {
  const replacement = (changes: Partial<AssistTourPlanningSource> = {}) => buildAssistTourPlanning(source({ employees: [employee(), employee({ id: 'e2', first_name: 'Berta' })], plans: [plan(), plan('e2')], qualifications: [qualification(), qualification({ id: 'q2', employee_id: 'e2' })], ...changes }));
  it('identifies a time-compatible colleague without offering the currently assigned person', () => {
    expect(getAssistReplacementCandidates(replacement(), 'v1')).toEqual([{ employeeId: 'e2', name: 'Berta Beispiel', status: 'available', issues: [] }]);
  });
  it.each(['availability', 'absences', 'qualifications'] as const)('keeps unread %s unknown', key => {
    const snapshot = replacement(); snapshot.checks[key] = 'unknown';
    if (key === 'qualifications') snapshot.employees[1].qualificationStatus = 'unknown';
    expect(getAssistReplacementCandidates(snapshot, 'v1')[0].status).toBe('unknown');
  });
  it('does not call an empty availability declaration free', () => {
    expect(getAssistReplacementCandidates(replacement({ plans: [plan()] }), 'v1')[0]).toMatchObject({ status: 'unknown', issues: expect.arrayContaining([expect.objectContaining({ code: 'availability_unknown' })]) });
  });
  it('blocks requested and approved absences, including inclusive all-day ranges', () => {
    for (const status of ['requested', 'approved']) {
      const snapshot = replacement({ absences: [{ tenant_id: 'tenant-1', employee_id: 'e2', status, starts_at: '2026-10-18T00:00:00Z', ends_at: '2026-10-18T00:00:00Z', all_day: true }] });
      expect(getAssistReplacementCandidates(snapshot, 'v1')[0].status).toBe('blocked');
    }
  });
  it('does not block rejected or cancelled absences', () => {
    const snapshot = replacement({ absences: [{ tenant_id: 'tenant-1', employee_id: 'e2', status: 'rejected', starts_at: '2026-10-18T00:00:00Z', ends_at: '2026-10-19T00:00:00Z' }] });
    expect(getAssistReplacementCandidates(snapshot, 'v1')[0].status).toBe('available');
  });
  it('detects actual overlap but permits exact adjacency and ignores cancelled plans', () => {
    for (const [start, status, expected] of [['2026-10-18T08:30:00Z', 'planned', 'blocked'], ['2026-10-18T09:00:00Z', 'planned', 'available'], ['2026-10-18T08:30:00Z', 'cancelled', 'available']]) {
      const snapshot = replacement({ visits: [visit(), visit({ id: 'other', client_id: 'c2', employee_id: 'e2', planned_start_at: start, planned_end_at: '2026-10-18T10:00:00Z', canonical_status: status })] });
      expect(getAssistReplacementCandidates(snapshot, 'v1')[0].status).toBe(expected);
    }
  });
  it('detects outside availability and explicit blocked windows', () => {
    const slots = [{ id: 'available', date, kind: 'available', startTime: '08:00', endTime: '18:00', label: '' }, { id: 'blocked', date, kind: 'blocked', startTime: '10:00', endTime: '11:00', label: '' }];
    expect(getAssistReplacementCandidates(replacement({ plans: [plan(), plan('e2', slots)] }), 'v1')[0].status).toBe('blocked');
    expect(getAssistReplacementCandidates(replacement({ plans: [plan(), plan('e2', [{ ...slots[0], endTime: '09:00' }])] }), 'v1')[0].status).toBe('blocked');
  });
  it('checks qualification type, verification and expiry instead of accepting any document', () => {
    for (const changes of [{ qualification_type: 'driving_license' }, { valid_until: '2026-10-17' }, { verified_at: null }, { status: 'pending_review' }]) {
      const snapshot = replacement({ qualifications: [qualification(), qualification({ employee_id: 'e2', ...changes })] });
      expect(getAssistReplacementCandidates(snapshot, 'v1')[0].status).toBe('unknown');
    }
  });
  it('requires all configured qualifications for the employee role', () => {
    const snapshot = replacement({ employees: [employee(), employee({ id: 'e2', role_title: 'Betreuungskraft' })] });
    expect(getAssistReplacementCandidates(snapshot, 'v1')[0].status).toBe('unknown');
  });
  it('does not invent qualification requirements for absent or unconfigured role titles', () => {
    for (const role_title of [null, 'Nicht konfigurierte Tätigkeit']) {
      const snapshot = replacement({ employees: [employee(), employee({ id: 'e2', role_title })] });
      expect(snapshot.employees.find(row => row.id === 'e2')?.qualificationStatus).toBe('unknown');
      expect(getAssistReplacementCandidates(snapshot, 'v1')[0].status).toBe('unknown');
    }
  });
  it('blocks inactive, not-yet-employed and departed people', () => {
    for (const changes of [{ status: 'gesperrt' }, { entry_date: '2026-11-01' }, { exit_date: '2026-10-17' }]) expect(getAssistReplacementCandidates(replacement({ employees: [employee(), employee({ id: 'e2', ...changes })] }), 'v1')[0].status).toBe('blocked');
  });
  it('keeps unrecognized employment data unknown rather than calling the person active or inactive', () => {
    const candidate = getAssistReplacementCandidates(replacement({ employees: [employee(), employee({ id: 'e2', status: 'unexpected' })] }), 'v1')[0];
    expect(candidate.status).toBe('unknown'); expect(candidate.issues.map(item => item.code)).toContain('employee_status_unknown');
  });
  it('marks malformed month slots unknown and handles 24:00 and adjacent windows', () => {
    const invalid = replacement({ plans: [plan(), { tenant_id: 'tenant-1', employee_id: 'e2', slots: null }] });
    expect(invalid.checks.availability).toBe('unknown');
    const slots = [{ id: 'a', date, kind: 'available', startTime: '00:00', endTime: '10:30', label: '' }, { id: 'b', date, kind: 'available', startTime: '10:30', endTime: '24:00', label: '' }];
    expect(getAssistReplacementCandidates(replacement({ plans: [plan(), plan('e2', slots)] }), 'v1')[0].status).toBe('available');
  });
});

describe('read-only scoped planning service', () => {
  it('blocks foreign tenant, portal, missing effective permission and invalid dates before queries', async () => {
    for (const changes of [{ tenantId: 'tenant-2' }, { roleKey: 'employee_portal' as const }, { effectivePermissions: ['assist.access'] as PermissionKey[] }, { date: '2026-02-30' }]) expect((await load(changes)).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });
  it('queries every table within tenant scope and reads displaced occurrence identities', async () => {
    const result = await load(); expect(result.ok).toBe(true);
    expect(state.calls.every(call => call.ops.some(([op, args]) => op === 'eq' && args[0] === 'tenant_id' && args[1] === 'tenant-1'))).toBe(true);
    expect(state.calls.some(call => call.table === 'assist_visits' && call.ops.some(([op, args]) => op === 'in' && args[0] === 'recurrence_json->>sourceOccurrenceDate'))).toBe(true);
    const employeeColumns = state.calls.find(call => call.table === 'employees')?.ops.find(([op]) => op === 'select')?.[1][0];
    expect(String(employeeColumns).split(',')).toContain('role_title');
    expect(String(employeeColumns).split(',')).not.toContain('job_title');
  });
  it('never queries unavailable personnel fields and reports checks unknown', async () => {
    const result = await load({ effectivePermissions: ['assist.access', 'assist.assignments.view'] });
    expect(result.ok && result.data.checks).toEqual({ employees: 'unknown', availability: 'unknown', absences: 'unknown', qualifications: 'unknown' });
    for (const table of ['employees', 'employee_qualifications', 'calendar_employee_month_plans', 'workforce_absences']) expect(state.calls.map(call => call.table)).not.toContain(table);
  });
  it('preserves tours but marks optional personnel read failures unknown', async () => {
    state.resolve.mockImplementation((call: Call) => ['employees', 'employee_qualifications', 'calendar_employee_month_plans', 'workforce_absences'].includes(call.table) ? { data: null, error: { message: 'read failed' } } : { error: null, data: call.table === 'assist_visits' ? [visit()] : call.table === 'clients' ? [client()] : [] });
    const result = await load(); expect(result.ok && result.data.visits).toHaveLength(1);
    expect(result.ok && result.data.checks).toEqual({ employees: 'unknown', availability: 'unknown', absences: 'unknown', qualifications: 'unknown' });
  });
  it('fails visibly for broken canonical or status reads, never a fake empty day', async () => {
    for (const table of ['assist_visits', 'assist_visit_execution_state']) {
      state.resolve.mockImplementation((call: Call) => call.table === table ? { data: null, error: { message: 'failure' } } : { error: null, data: call.table === 'assist_visits' ? [visit()] : [] });
      expect((await load()).ok).toBe(false);
    }
  });
  it.each([null, {}, ['invalid'], [null]].map(data => ({ data })))('rejects malformed canonical payload $data', async ({ data }) => {
    state.resolve.mockImplementation(() => ({ data, error: null })); expect((await load()).ok).toBe(false);
  });
  it('paginates canonical and optional data past 500 records without truncation', async () => {
    state.resolve.mockImplementation((call: Call) => {
      const from = call.ops.find(([op]) => op === 'range')?.[1][0] as number;
      if (call.table === 'assist_visits') return { error: null, data: from === 0 ? Array.from({ length: 500 }, (_, index) => visit({ id: `v${index}` })) : from === 500 ? [visit({ id: 'v500' })] : [] };
      return { error: null, data: call.table === 'clients' ? [client()] : call.table === 'employees' ? [employee()] : [] };
    });
    const result = await load(); expect(result.ok && result.data.visits).toHaveLength(501);
    expect(state.calls.filter(call => call.table === 'assist_visits' && call.ops.some(([op, args]) => op === 'range' && args[0] === 500))).toHaveLength(3);
  });
  it('queries correct DST day boundaries rather than fixed 24-hour UTC offsets', async () => {
    await load({ date: '2026-10-25' });
    const call = state.calls.find(item => item.table === 'assist_visits' && item.ops.some(([op]) => op === 'gt'));
    expect(call?.ops).toContainEqual(['gt', ['planned_end_at', assistBerlinTimestamp('2026-10-25')]]);
    expect(call?.ops).toContainEqual(['lt', ['planned_start_at', assistBerlinTimestamp('2026-10-26')]]);
  });
});
