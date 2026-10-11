import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: h.from }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/wfm/wfmWorkSessionRepository', () => ({ resolveEmployeeIdForUser: async () => ({ ok: true, data: 'employee' }) }));
import { listEmployeeVisitTimes } from '@/lib/wfm/wfmPortalTimesService';
let tables: Record<string, Record<string, unknown>[]>, failure: { table: string; from: number } | null;
const calls: { table: string; eq: unknown[][]; ids?: string[]; range: number[]; cutoff?: string }[] = [];
function builder(table: string) {
  const filters: unknown[][] = []; let ids: string[] | undefined, cutoff: string | undefined;
  const chain = {
    select: vi.fn().mockReturnThis(), eq: vi.fn((...args) => { filters.push(args); return chain; }),
    in: vi.fn((_key, value) => { ids = value; return chain; }), gte: vi.fn((_key, value) => { cutoff = value; return chain; }), order: vi.fn().mockReturnThis(),
    range: vi.fn(async (from, to) => {
      calls.push({ table, eq: filters, ids, range: [from, to], cutoff });
      if (failure?.table === table && failure.from === from) return { data: null, error: { message: 'Abfrage unterbrochen' } };
      const rows = (tables[table] ?? []).filter(row => !ids || ids.includes(String(row.visit_id)));
      return { data: rows.slice(from, to + 1), error: null };
    }),
  }; return chain;
}
beforeEach(() => { vi.clearAllMocks(); calls.length = 0; failure = null; tables = { assist_visits: [], assist_time_events: [], assist_driving_log: [] }; h.from.mockImplementation(builder); });
describe('employee trips and visit times stay complete', () => {
  it('shows an independent employee trip even when no visit exists', async () => {
    tables.assist_driving_log = [{ id: 'independent-trip', purpose: 'Dienstliche Fahrt', started_at: new Date().toISOString(), distance_km: 3 }];
    const result = await listEmployeeVisitTimes('tenant', 'user', 'employee_portal');
    expect(result.ok && result.data.drivingLogs.map(row => row.id)).toEqual(['independent-trip']);
    expect(h.from).not.toHaveBeenCalledWith('assist_time_events');
    expect(calls.find(call => call.table === 'assist_driving_log')?.eq).toContainEqual(['employee_id', 'employee']);
  });
  it('reads all visits, bounds event URLs, and preserves driving rows beyond the old 100-row cut', async () => {
    tables.assist_visits = Array.from({ length: 501 }, (_, i) => ({ id: `visit-${i}`, title: `Einsatz ${i}`, clients: null }));
    tables.assist_time_events = tables.assist_visits.map((v, i) => ({ id: `event-${i}`, visit_id: v.id, event_type: 'service_end', occurred_at: new Date().toISOString(), duration_seconds: null }));
    tables.assist_driving_log = Array.from({ length: 501 }, (_, i) => ({ id: `trip-${i}`, started_at: new Date().toISOString(), status: 'completed' }));
    const result = await listEmployeeVisitTimes('tenant', 'user', 'employee_portal', { days: 60 });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.data.visitSummaries).toHaveLength(501); expect(result.data.drivingLogs).toHaveLength(501);
    expect(calls.filter(c => c.table === 'assist_time_events').every(c => c.ids!.length <= 100)).toBe(true);
    expect(calls.filter(c => c.table === 'assist_visits').map(c => c.range)).toEqual([[0,499],[500,999]]);
    expect(calls.filter(c => c.table === 'assist_driving_log').map(c => c.range)).toEqual([[0,499],[500,999]]);
    expect(calls.filter(c => c.table === 'assist_time_events').every(c => Boolean(c.cutoff))).toBe(true);
  });
  it('reads a second event page instead of losing milestones after 500 records', async () => {
    tables.assist_visits = [{ id: 'visit', title: 'Einsatz', clients: null }];
    tables.assist_time_events = Array.from({ length: 501 }, (_, i) => ({ id: `event-${i}`, visit_id: 'visit', event_type: i === 500 ? 'service_start' : 'service_end', occurred_at: new Date().toISOString() }));
    const result = await listEmployeeVisitTimes('tenant', 'user', 'employee_portal');
    expect(result.ok && result.data.visitSummaries[0].timelineText).toContain('Einsatz begonnen');
    expect(calls.filter(c => c.table === 'assist_time_events').map(c => c.range)).toEqual([[0,499],[500,999]]);
  });
  it('fails the whole read when a later page fails instead of claiming partial completion', async () => {
    tables.assist_driving_log = Array.from({ length: 501 }, (_, i) => ({ id: `trip-${i}` })); failure = { table: 'assist_driving_log', from: 500 };
    const result = await listEmployeeVisitTimes('tenant', 'user', 'employee_portal');
    expect(result.ok).toBe(false); expect(!result.ok && result.error).toContain('Abfrage unterbrochen');
  });
});
