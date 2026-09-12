import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ count: 421, failAt: -1, ranges: [] as number[][], filters: [] as unknown[][] }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: () => ({ select: () => {
  const query = {
    eq: (...values: unknown[]) => { state.filters.push(values); return query; },
    is: (...values: unknown[]) => { state.filters.push(values); return query; },
    order: () => query,
    range: async (from: number, to: number) => {
      state.ranges.push([from, to]);
      if (from === state.failAt) return { data: null, error: { message: 'read failed' } };
      return { data: Array.from({ length: Math.max(0, Math.min(to + 1, state.count) - from) }, (_, index) => ({ id: from + index })), error: null };
    },
  };
  return query;
} }) }) }));
import { platformSelectWhere } from '@/lib/platformConsole/platformSupabaseClient';
beforeEach(() => { state.count = 421; state.failAt = -1; state.ranges = []; state.filters = []; });
describe('Console list completeness', () => {
  it('reads all pages and preserves explicit null filters', async () => {
    const result = await platformSelectWhere('platform_invoices', '*', { orderBy: 'created_at', eq: { tenant_id: null } });
    expect(result.data).toHaveLength(421);
    expect(state.ranges).toEqual([[0,199],[200,399],[400,599]]);
    expect(state.filters[0]).toEqual(['tenant_id', null]);
  });
  it('respects an explicit limit across page boundaries', async () => {
    const result = await platformSelectWhere('platform_invoices', '*', { orderBy: 'created_at', limit: 201 });
    expect(result.data).toHaveLength(201);
    expect(state.ranges).toEqual([[0,199],[200,200]]);
  });
  it('never presents a partial retrieval as a complete list', async () => {
    state.failAt = 200;
    const result = await platformSelectWhere('platform_invoices', '*', { orderBy: 'created_at' });
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('read failed');
  });
});
