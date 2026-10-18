import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readOfficeSessions, readOfficeEvents, readOfficeReviews, readOfficeReviewActions, readOfficeEmployees, readOfficeAbsences } from '@/lib/wfm/wfmOfficeTimekeepingReads';

const state = vi.hoisted(() => ({ pages: vi.fn(), filters: [] as [string, unknown][] }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: (table: string) => {
  const chain = {
    select: () => chain, order: () => chain,
    eq: (field: string, value: unknown) => { state.filters.push([field, value]); return chain; },
    in: () => chain, gte: () => chain, lte: () => chain,
    range: (from: number, to: number) => state.pages(table, from, to),
  };
  return chain;
} }) }));

beforeEach(() => { state.pages.mockReset(); state.filters.length = 0; });

describe('complete Office Web workforce reads', () => {
  it('loads the page beyond the first 500 sessions and binds every query to the tenant', async () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({ id: `session-${index}`, tenant_id: 'tenant-live', employee_id: 'employee', work_date: '2026-08-24', status: 'ended', work_mode: 'office', gross_minutes: 60, pause_minutes: 0, net_minutes: 60 }));
    state.pages.mockImplementation(async (_table: string, from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    const result = await readOfficeSessions('tenant-live', '2026-08-24');
    expect(result.ok && result.data.length).toBe(501);
    expect(state.pages).toHaveBeenNthCalledWith(2, 'workforce_work_sessions', 500, 999);
    expect(state.filters.filter(([field, value]) => field === 'tenant_id' && value === 'tenant-live')).toHaveLength(2);
  });

  it('rejects a later failed page without exposing partial totals', async () => {
    state.pages.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null });
    state.pages.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied' } });
    expect((await readOfficeEmployees('tenant-live')).ok).toBe(false);
  });

  it.each([
    { label: 'sessions', read: () => readOfficeSessions('tenant-live', '2026-08-24') },
    { label: 'events', read: () => readOfficeEvents('tenant-live', 'session') },
    { label: 'reviews', read: () => readOfficeReviews('tenant-live', '2026-08-24', '2026-08-24') },
    { label: 'actions', read: () => readOfficeReviewActions('tenant-live', ['review']) },
    { label: 'absences', read: () => readOfficeAbsences('tenant-live', 'business_admin', '2026-08-24', '2026-08-24') },
  ])('reports a missing $label table as an error, never an empty success', async ({ read }) => {
    state.pages.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation does not exist' } });
    expect((await read()).ok).toBe(false);
  });

  it('rejects a malformed successful response', async () => {
    state.pages.mockResolvedValue({ data: null, error: null });
    expect((await readOfficeEmployees('tenant-live')).ok).toBe(false);
  });
});
