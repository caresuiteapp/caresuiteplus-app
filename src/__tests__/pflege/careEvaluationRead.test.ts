import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCarePlanEvaluations } from '@/lib/pflege/careQualityLiveService';
import type { PermissionKey } from '@/types/permissions';

const mocked = vi.hoisted(() => ({ sdk: {}, from: vi.fn() }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocked.sdk }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: mocked.from }));

const tenant = '10000000-0000-0000-0000-000000000001';
const person = '10000000-0000-0000-0000-000000000002';
const plan = '10000000-0000-0000-0000-000000000003';
const other = '10000000-0000-0000-0000-000000000004';
const effectivePermissions: PermissionKey[] = ['pflege.evaluations.view'];
const access = { carePlanId: plan, permissionContext: { effectivePermissions }, isCurrent: () => true };
const rows = Array.from({ length: 501 }, (_, i) => ({
  id: `evaluation-${i}`, tenant_id: tenant, client_id: person, care_plan_id: plan,
  outcome: 'effective', observed_effect: 'Beobachtet', professional_conclusion: 'Bewertet',
  evaluated_at: '2026-11-01T11:00:00+01:00', requires_plan_update: false,
}));

function install(records: typeof rows, afterPage?: () => void) {
  const queries: Array<{ table: string; operation: string; args: unknown[] }> = [];
  mocked.from.mockImplementation((_sdk: unknown, table: string) => {
    const chain = {
      select: (...args: unknown[]) => { queries.push({ table, operation: 'select', args }); return chain; },
      eq: (...args: unknown[]) => { queries.push({ table, operation: 'eq', args }); return chain; },
      order: (...args: unknown[]) => { queries.push({ table, operation: 'order', args }); return chain; },
      range: async (from: number, to: number) => { queries.push({ table, operation: 'range', args: [from, to] }); afterPage?.(); return { data: records.slice(from, to + 1), error: null, count: records.length }; },
      in: (...args: unknown[]) => {
        queries.push({ table, operation: 'in', args });
        return Promise.resolve({ error: null, data: table === 'clients' ? [{ id: person, tenant_id: tenant, first_name: 'Fall', last_name: 'A' }] : [{ id: plan, client_id: person, tenant_id: tenant, title: 'Pflegeplan A' }] });
      },
    };
    return chain;
  });
  return queries;
}

beforeEach(() => mocked.from.mockReset());

describe('counted and case-bound evaluation reads', () => {
  it('binds both tenant and plan on each page and resolves page 2', async () => {
    const queries = install(rows);
    const result = await fetchCarePlanEvaluations(tenant, 'nurse', access);
    expect(result.ok && result.data).toHaveLength(501);
    expect(queries.filter(q => q.table === 'care_plan_evaluations' && q.operation === 'range').map(q => q.args)).toEqual([[0, 499], [500, 999]]);
    expect(queries.filter(q => q.operation === 'eq' && q.table === 'care_plan_evaluations').map(q => q.args)).toEqual([
      ['tenant_id', tenant], ['care_plan_id', plan], ['tenant_id', tenant], ['care_plan_id', plan],
    ]);
  });
  it('rejects a foreign plan returned by the service rather than displaying it', async () => {
    install([{ ...rows[0], care_plan_id: other }]);
    expect((await fetchCarePlanEvaluations(tenant, 'nurse', access)).ok).toBe(false);
    expect(mocked.from).toHaveBeenCalledTimes(1);
  });
  it('stops after access loss before reference fetches or a second page', async () => {
    let current = true;
    install(rows, () => { current = false; });
    expect((await fetchCarePlanEvaluations(tenant, 'nurse', { ...access, isCurrent: () => current })).ok).toBe(false);
    expect(mocked.from).toHaveBeenCalledTimes(1);
  });
});
