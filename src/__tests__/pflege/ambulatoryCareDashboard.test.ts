import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCareOperationalStats, type CareDashboardScope } from '@/lib/pflege/careDashboardOperationalService';
import { buildPflegeWorkspaceKpis } from '@/lib/pflege/pflegeDashboardWorkspace';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';

type CountResponse = { count: number | null; error: unknown };
const mocks = vi.hoisted(() => ({
  guard: vi.fn(), mode: vi.fn(), db: {},
  results: new Map<string, CountResponse | Promise<CountResponse>>(),
  filters: [] as unknown[][],
}));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: mocks.guard }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: mocks.mode }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocks.db }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    const filters: unknown[][] = [];
    const method = (operator: string) => (...args: unknown[]) => {
      filters.push([operator, ...args]); mocks.filters.push([table, operator, ...args]); return query;
    };
    const query = { select: method('select'), eq: method('eq'), neq: method('neq'), in: method('in'), lte: method('lte'),
      then: (resolve: (response: CountResponse) => void) => {
        const foundStatus = filters.find(([operator, key, value]) => operator === 'eq' && key === 'status' && value === 'in_progress');
        const result = mocks.results.get(foundStatus ? `${table}:running` : table) ?? { count: 3, error: null };
        return Promise.resolve(result).then(resolve);
      } };
    return query;
  },
}));
const scope: CareDashboardScope = {
  tenantId: '10000000-0000-0000-0000-000000000001',
  actorId: '10000000-0000-0000-0000-000000000002',
  isCurrent: () => true, can: () => true,
};

beforeEach(() => {
  mocks.results.clear(); mocks.filters.length = 0; mocks.guard.mockReturnValue(null); mocks.mode.mockReturnValue('supabase');
});

describe('Ambulante Startseite: gezählte Live-Daten', () => {
  it('counts through unpaginated HEAD responses scoped to both joined parents and the Berlin date', async () => {
    mocks.results.set('care_tour_stops', { count: 2501, error: null });
    mocks.results.set('care_tour_stops:running', { count: 1, error: null });
    const result = await fetchCareOperationalStats(scope); if (!result.ok) throw Error(result.error);
    expect(result.data.visitsToday).toBe(2501);
    expect(result.data.runningNow).toBe(1);
    expect(result.data.openDocumentationCount).toBe(3);
    expect(result.data.unavailableKpiIds).toContain('pflege-ws-kpi-client-assignment');
    expect(mocks.filters).toEqual(expect.arrayContaining([
      ['care_tour_stops', 'select', 'id,care_tours!inner(id)', { count: 'exact', head: true }],
      ['care_tour_stops', 'eq', 'tenant_id', scope.tenantId], ['care_tour_stops', 'eq', 'care_tours.tenant_id', scope.tenantId],
      ['care_tour_stops', 'eq', 'care_tours.tour_date', berlinCalendarDate()], ['care_tour_stops', 'neq', 'care_tours.status', 'cancelled'],
      ['care_plans', 'in', 'status', ['draft', 'active', 'paused', 'completed']],
      ['care_plan_items', 'eq', 'care_plans.tenant_id', scope.tenantId], ['care_plan_items', 'eq', 'care_plans.status', 'active'],
      ['care_plan_items', 'eq', 'care_plans.clients.tenant_id', scope.tenantId],
      ['care_plan_items', 'lte', 'next_evaluation_date', berlinCalendarDate()], ['care_assessments', 'eq', 'subject_type', 'client'],
    ]));
  });

  it('distinguishes uncomputed schedules and a missing count from confirmed zero', async () => {
    mocks.results.set('clinical_handovers', { count: 0, error: null });
    mocks.results.set('care_assessments', { count: null, error: null });
    const result = await fetchCareOperationalStats(scope); if (!result.ok) throw Error(result.error);
    const kpis = buildPflegeWorkspaceKpis(result.data);
    expect(kpis.find(k => k.id === 'pflege-ws-kpi-medication')?.value).toBe('—');
    expect(kpis.find(k => k.id === 'pflege-ws-kpi-due-vitals')?.value).toBe('—');
    expect(kpis.find(k => k.id === 'pflege-ws-kpi-sis')?.value).toBe('—');
    expect(kpis.find(k => k.id === 'pflege-ws-kpi-handovers')?.value).toBe(0);
    expect(result.data.failedKpiIds).toEqual(['pflege-ws-kpi-sis']);
  });

  it('never dispatches denied queries or requires plans to return a clinical count', async () => {
    const result = await fetchCareOperationalStats({ ...scope, can: permission => !['pflege.wounds.view', 'pflege.plans.view'].includes(permission) });
    if (!result.ok) throw Error(result.error);
    expect(result.data.unavailableKpiIds).toContain('pflege-ws-kpi-wounds');
    expect(result.data.unavailableKpiIds).toContain('pflege-ws-kpi-visits-today');
    expect(result.data.openDocumentationCount).toBe(3);
    expect(result.data.failedKpiIds).toEqual([]);
    expect(mocks.filters.some(([table]) => ['clinical_wound_cases', 'care_tour_stops', 'care_plans', 'care_plan_items'].includes(String(table)))).toBe(false);
  });

  it('shows failed sources as unavailable without dropping unrelated values', async () => {
    mocks.results.set('clinical_handovers', { count: 0, error: { code: '42P01' } });
    const result = await fetchCareOperationalStats(scope); if (!result.ok) throw Error(result.error);
    expect(result.data.failedKpiIds).toEqual(['pflege-ws-kpi-handovers']);
    expect(result.data.unavailableKpiIds).toContain('pflege-ws-kpi-handovers');
    expect(result.data.openDocumentationCount).toBe(3);
  });

  it('discards a delayed response when scope is lost and stops before reads for foreign tenants', async () => {
    let release!: (result: CountResponse) => void;
    mocks.results.set('clinical_handovers', new Promise(resolve => { release = resolve; }));
    let alive = true;
    const pending = fetchCareOperationalStats({ ...scope, isCurrent: () => alive });
    alive = false;
    release({ count: 10, error: null });
    expect((await pending).ok).toBe(false);
    mocks.guard.mockReturnValue({ ok: false, error: 'Kein Mandantenzugriff' });
    mocks.filters.length = 0;
    expect((await fetchCareOperationalStats(scope)).ok).toBe(false);
    expect(mocks.filters).toHaveLength(0);
  });
});
