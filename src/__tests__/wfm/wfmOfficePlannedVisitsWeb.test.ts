import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistWorkspaceRow } from '@/lib/assist/assistClientsWorkspaceModel.web';

type Call = { table: string; filters: [string, ...unknown[]][]; range: number[] };
const state = vi.hoisted(() => ({ resolve: vi.fn(), calls: [] as Call[], client: {} as object | null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (tenant: string) => tenant ? null : { ok: false, error: 'Mandant fehlt' } }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.client }));
vi.mock('@/lib/wfm/wfmOfficePlannedVisitRepository.ts', () => ({ listPlannedVisitsForPeriod: vi.fn(), fetchActiveEmployeeIds: vi.fn(), mapCanonicalVisitToPlannedVisit: vi.fn(), resetWfmOfficePlannedVisitDemoStore: vi.fn(), seedWfmOfficePlannedVisits: vi.fn() }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_db: unknown, table: string) => {
  const call: Call = { table, filters: [], range: [] };
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'gte', 'lte', 'lt', 'neq', 'is', 'in', 'order']) query[method] = (...args: unknown[]) => { call.filters.push([method, ...args]); return query; };
  query.range = (from: number, to: number) => { call.range = [from, to]; state.calls.push(call); return Promise.resolve(state.resolve(call)); };
  return query;
} }));
import { listPlannedVisitsForPeriod, projectWorktimePlannedVisits } from '@/lib/wfm/wfmOfficePlannedVisitRepository.web';
const visit = (changes: AssistWorkspaceRow = {}): AssistWorkspaceRow => ({ id: 'v1', tenant_id: 'tenant-a', client_id: 'c1', employee_id: 'e1', legacy_assignment_id: null, assignment_date: '2026-10-18', planned_start_at: '2026-10-18T08:00:00Z', planned_end_at: '2026-10-18T09:00:00Z', planning_status: 'confirmed', canonical_status: 'confirmed', title: 'Betreuung', recurrence_json: { pattern: 'none' }, ...changes });
const project = (changes: Partial<Parameters<typeof projectWorktimePlannedVisits>[0]> = {}) => projectWorktimePlannedVisits({ tenantId: 'tenant-a', fromDate: '2026-10-18', toDate: '2026-10-18', visits: [visit()], clients: [], assignments: [], execution: [], ...changes });
beforeEach(() => { state.calls = []; state.client = {}; state.resolve.mockReset().mockReturnValue({ data: [], error: null }); });

describe('Web Arbeitszeit canonical planning', () => {
  it('assigns a visit to its Berlin date and preserves genuine midnight duration', () => {
    expect(project({ visits: [visit({ planned_start_at: '2026-10-17T22:10:00Z', planned_end_at: '2026-10-17T23:10:00Z' })] })[0]).toMatchObject({ workDate: '2026-10-18', plannedDurationMinutes: 60 });
  });
  it('expands old series beyond 52 dates and resets virtual actual times across DST', () => {
    const master = visit({ assignment_date: '2026-01-01', planned_start_at: '2026-01-01T09:00:00Z', planned_end_at: '2026-01-01T10:00:00Z', actual_start_at: '2026-01-01T09:00:00Z', actual_end_at: '2026-01-01T10:00:00Z', recurrence_json: { pattern: 'daily' } });
    const rows = project({ fromDate: '2026-10-24', toDate: '2026-10-25', visits: [master] });
    expect(rows.map(row => row.plannedStartAt)).toEqual(['2026-10-24T08:00:00.000Z', '2026-10-25T09:00:00.000Z']);
    expect(rows.every(row => row.assignmentActualStartAt === null && row.assignmentActualEndAt === null)).toBe(true);
  });
  it('does not recreate detached or moved occurrences and ignores cancelled rows', () => {
    const master = visit({ assignment_date: '2026-01-01', planned_start_at: '2026-01-01T09:00:00Z', planned_end_at: '2026-01-01T10:00:00Z', recurrence_json: { pattern: 'daily' } });
    const moved = visit({ id: 'child', planned_start_at: '2026-10-19T08:00:00Z', planned_end_at: '2026-10-19T09:00:00Z', recurrence_json: { pattern: 'none', parentSeriesId: 'v1', sourceOccurrenceDate: '2026-10-18' } });
    expect(project({ visits: [master, moved] })).toEqual([]);
    expect(project({ visits: [visit({ canonical_status: 'cancelled' })] })).toEqual([]);
  });
  it('uses saved occurrence execution and never copies the parent legacy actual time', () => {
    const parent = visit({ id: 'parent', legacy_assignment_id: 'a1', assignment_date: '2026-10-17', planned_start_at: '2026-10-17T08:00:00Z', planned_end_at: '2026-10-17T09:00:00Z' });
    const child = visit({ legacy_assignment_id: 'a1', recurrence_json: { pattern: 'none', parentSeriesId: 'parent', sourceOccurrenceDate: '2026-10-18' } });
    const assignments = [{ id: 'a1', tenant_id: 'tenant-a', actual_start_at: '2026-10-17T08:00:00Z', actual_end_at: '2026-10-17T09:00:00Z' }];
    expect(project({ visits: [parent, child], assignments })[0].assignmentActualStartAt).toBeNull();
    expect(project({ visits: [child], assignments })[0].assignmentActualStartAt).toBeNull();
    const execution = [{ visit_id: 'v1', tenant_id: 'tenant-a', service_started_at: '2026-10-18T08:02:00Z', service_ended_at: '2026-10-18T09:05:00Z' }];
    expect(project({ visits: [parent, child], assignments, execution })[0]).toMatchObject({ assignmentActualStartAt: '2026-10-18T08:02:00Z', assignmentActualEndAt: '2026-10-18T09:05:00Z' });
  });
  it('keeps tenant boundaries for visits, labels and actual records', () => {
    const rows = project({ visits: [visit(), visit({ id: 'foreign', tenant_id: 'tenant-b' })], clients: [{ id: 'c1', tenant_id: 'tenant-b', first_name: 'Fremd' }], execution: [{ visit_id: 'v1', tenant_id: 'tenant-b', service_started_at: '2026-10-18T08:00:00Z' }] });
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ clientLabel: null, assignmentActualStartAt: null });
  });
  it('paginates canonical rows and fails the entire load if a later page fails', async () => {
    state.resolve.mockImplementation((call: Call) => {
      if (call.table !== 'assist_visits' || call.filters.some(filter => filter[0] === 'neq' || filter[1] === 'recurrence_json->>sourceOccurrenceDate')) return { data: [], error: null };
      if (call.range[0] === 0) return { data: Array.from({ length: 200 }, (_, i) => visit({ id: `v${i}` })), error: null };
      return { data: null, error: { message: 'network failed', code: '500' } };
    });
    expect((await listPlannedVisitsForPeriod('tenant-a', '2026-10-18', '2026-10-18')).ok).toBe(false);
    expect(state.calls.some(call => call.range[0] === 200)).toBe(true);
    expect(state.calls.every(call => call.filters.some(filter => filter[0] === 'eq' && filter[1] === 'tenant_id' && filter[2] === 'tenant-a'))).toBe(true);
  });
  it('never presents a failed canonical lookup as an empty legacy success', async () => {
    state.resolve.mockReturnValue({ data: null, error: { code: '42P01', message: 'missing relation' } });
    expect((await listPlannedVisitsForPeriod('tenant-a', '2026-10-18', '2026-10-18')).ok).toBe(false);
    expect(state.calls.every(call => call.table === 'assist_visits')).toBe(true);
  });
  it('rejects invalid periods and missing connections before reading', async () => {
    expect((await listPlannedVisitsForPeriod('tenant-a', '2026-02-30', '2026-03-01')).ok).toBe(false);
    state.client = null;
    expect((await listPlannedVisitsForPeriod('tenant-a', '2026-10-18', '2026-10-18')).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });
});
