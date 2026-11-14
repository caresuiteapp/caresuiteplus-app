import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLiveCareMeasures, reviewLiveCareMeasure } from '@/lib/pflege/careQualityR2LiveService';

type Row = Record<string, unknown>;
const mocks = vi.hoisted(() => ({
  db: { rpc: vi.fn() },
  guard: vi.fn(),
  mode: vi.fn(),
  read: vi.fn(),
}));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: mocks.guard }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: mocks.mode }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocks.db }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: () => 'Datenbankfehler' }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (db: unknown, table: string) => {
    const filters: unknown[][] = [];
    let selected: unknown;
    const query = {
      select: (...args: unknown[]) => { selected = args; return query; },
      eq: (...args: unknown[]) => { filters.push(['eq', ...args]); return query; },
      neq: (...args: unknown[]) => { filters.push(['neq', ...args]); return query; },
      order: (...args: unknown[]) => { filters.push(['order', ...args]); return query; },
      range: (from: number, to: number) => mocks.read({ db, table, filters, selected, from, to }),
    };
    return query;
  },
}));
const uuid = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const tenantId = uuid(1);
const planId = uuid(2);
const clientId = uuid(3);
const client = { id: clientId, tenant_id: tenantId, first_name: 'Ada', last_name: 'Test' };
const plan = { id: planId, tenant_id: tenantId, client_id: clientId, title: 'Pflegeplan', status: 'aktiv', client, updated_at: '2026-11-13T07:00:00Z' };
const row = (index = 0, overrides: Row = {}): Row => ({
  id: uuid(index + 11), tenant_id: tenantId, care_plan_id: planId, title: 'Mobilität', status: 'active',
  intervention: null, frequency: '', responsible_role: null, next_evaluation_date: '2026-11-14',
  updated_at: '2026-11-13T08:00:00.120934+00:00', plan, ...overrides,
});
const read = (options?: Parameters<typeof fetchLiveCareMeasures>[2]) => fetchLiveCareMeasures(tenantId, 'nurse', options);
function pages(rows: Row[]) {
  mocks.read.mockImplementation(async ({ from, to }) => ({ data: rows.slice(from, to + 1), error: null, count: rows.length }));
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T23:30:00Z')); // 14.11. in Berlin.
  mocks.mode.mockReturnValue('supabase'); mocks.guard.mockReturnValue(null); mocks.read.mockReset();
  mocks.db.rpc.mockReset();
});

describe('Maßnahmenevaluation mit ursprünglichem Datenbezug', () => {
  const actorId = uuid(4);
  const payload = { decision: 'continue', observedEffect: 'Originalbeobachtung', professionalRationale: 'Testbegründung' };
  const receipt = { id: uuid(5), tenant_id: tenantId, client_id: clientId, care_plan_id: planId, care_plan_item_id: uuid(11),
    reviewer_profile_id: actorId, decision: payload.decision, observed_effect: payload.observedEffect, professional_rationale: payload.professionalRationale };
  async function original() {
    pages([row()]);
    const result = await read();
    if (!result.ok) throw Error(result.error);
    return result.data[0];
  }
  it('blocks a stale item before dispatch and requires a matching original RPC receipt after dispatch', async () => {
    const expected = await original();
    const scope = { expected, actorId, permissions: ['pflege.plans.view', 'pflege.measures.review'] as const, isCurrent: () => true };
    pages([row(0, { updated_at: '2026-11-14T08:00:00Z' })]);
    expect((await reviewLiveCareMeasure(tenantId, 'nurse', expected.id, payload, scope)).ok).toBe(false);
    expect(mocks.db.rpc).not.toHaveBeenCalled();
    pages([row()]);
    mocks.db.rpc.mockResolvedValueOnce({ data: { ...receipt, reviewer_profile_id: uuid(999) }, error: null });
    expect(await reviewLiveCareMeasure(tenantId, 'nurse', expected.id, payload, scope)).toMatchObject({ ok: false, uncertain: true });
    mocks.db.rpc.mockResolvedValueOnce({ data: receipt, error: null });
    expect(await reviewLiveCareMeasure(tenantId, 'nurse', expected.id, payload, scope)).toEqual({ ok: true, data: { id: receipt.id } });
    expect(mocks.db.rpc.mock.calls[1]).toEqual(['review_care_plan_measure', { p_item_id: expected.id, p_payload: payload }]);
  });

  it('does not dispatch after the current review permission is lost during preflight', async () => {
    const expected = await original();
    let current = true;
    mocks.read.mockImplementationOnce(async () => { current = false; return { data: [row()], error: null, count: 1 }; });
    const scope = { expected, actorId, permissions: ['pflege.plans.view', 'pflege.measures.review'] as const, isCurrent: () => current };
    expect((await reviewLiveCareMeasure(tenantId, 'nurse', expected.id, payload, scope)).ok).toBe(false);
    expect(mocks.db.rpc).not.toHaveBeenCalled();
  });
});
afterEach(() => vi.useRealTimers());

describe('Lesebestand für Maßnahmen', () => {
  it('returns every exact counted row with real workflow states, original fields and a Berlin date', async () => {
    const states = ['active', 'paused', 'completed', 'cancelled'];
    const rows = Array.from({ length: 1001 }, (_, i) => row(i, { status: states[i % states.length], description: 'Freitext', timing: 'abends' }));
    pages(rows);
    const result = await read();
    if (!result.ok) throw Error(result.error);
    expect(result.data).toHaveLength(1001);
    expect(result.data.map(item => item.id)).toEqual(rows.map(item => item.id));
    expect(result.data.slice(0, 4).map(({ status, overdue }) => [status, overdue])).toEqual([
      ['active', true], ['paused', false], ['completed', false], ['cancelled', false],
    ]);
    expect(result.data[0]).toMatchObject({ carePlanId: planId, clientId, clientName: 'Ada Test', planStatus: 'aktiv',
      updatedAt: rows[0].updated_at, nextEvaluationAt: '2026-11-14', intervention: '', frequency: '', responsibleRole: '' });
    expect(mocks.read.mock.calls.map(([call]) => [call.from, call.to])).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it('binds the row, plan and client scopes to validated filters and every embedded tenant', async () => {
    const item = row();
    pages([item]);
    expect((await read({ planId, clientId, itemId: String(item.id) })).ok).toBe(true);
    expect(mocks.read.mock.calls[0][0]).toMatchObject({
      db: mocks.db, table: 'care_plan_items',
      selected: [expect.stringContaining('plan:care_plans!care_plan_items_care_plan_id_fkey!inner'), { count: 'exact' }],
      filters: expect.arrayContaining([
        ['eq', 'tenant_id', tenantId], ['eq', 'plan.tenant_id', tenantId], ['eq', 'plan.client.tenant_id', tenantId],
        ['neq', 'plan.status', 'archived'],
        ['eq', 'care_plan_id', planId], ['eq', 'plan.client_id', clientId], ['eq', 'id', item.id],
        ['order', 'id', { ascending: true }],
      ]),
    });
    mocks.read.mockClear();
    expect((await read({ planId: 'invalid' })).ok).toBe(false);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('rejects mismatching relationships or archived parents instead of widening a returned dataset', async () => {
    for (const overrides of [
      { tenant_id: uuid(2500) },
      { plan: { ...plan, tenant_id: uuid(2500) } },
      { plan: { ...plan, client: { ...client, id: uuid(2500) } } },
      { plan: { ...plan, client: { ...client, tenant_id: uuid(2500) } } },
      { plan: { ...plan, status: 'archived' } },
      { plan: null },
      { next_evaluation_date: '2026-02-31' },
    ]) {
      pages([row(0, overrides)]);
      expect((await read()).ok).toBe(false);
    }
    pages([row(0), row(1)]);
    expect((await read({ itemId: uuid(11) })).ok).toBe(false);
    pages([row(0, { plan: { ...plan, status: 'archiviert' } })]);
    expect(await read()).toEqual({ ok: true, data: [] });
    expect(mocks.read.mock.lastCall?.[0].filters).not.toContainEqual(['neq', 'plan.status', 'archiviert']);
  });

  it('does not imply an evaluation is due for a non-active plan or a blank date', async () => {
    pages([row(0, { plan: { ...plan, status: 'entwurf' } })]);
    const draft = await read();
    if (!draft.ok) throw Error(draft.error);
    expect(draft.data[0].overdue).toBe(false);
    pages([row(0, { next_evaluation_date: null })]);
    const noDate = await read();
    if (!noDate.ok) throw Error(noDate.error);
    expect(noDate.data[0]).toMatchObject({ nextEvaluationAt: null, overdue: false });
  });

  it('rejects count drift, truncation and changed plan projections across pages as incomplete', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => row(i));
    mocks.read.mockImplementation(async ({ from, to }) => ({ data: rows.slice(from, to + 1), error: null, count: from ? 502 : 501 }));
    expect((await read()).ok).toBe(false);
    mocks.read.mockImplementation(async () => ({ data: [], error: null, count: 40 }));
    expect((await read()).ok).toBe(false);
    rows[500] = row(500, { plan: { ...plan, title: 'geändert', updated_at: '2026-11-14T09:00:00Z' } });
    pages(rows);
    expect((await read()).ok).toBe(false);
  });

  it('does not dispatch on a revoked current scope or missing effective plan right; rejects late data after scope loss', async () => {
    pages([row()]);
    expect((await read({ isCurrent: () => false })).ok).toBe(false);
    expect((await read({ permissions: [] })).ok).toBe(false);
    expect(mocks.read).not.toHaveBeenCalled();
    let current = true;
    let finish!: (response: unknown) => void;
    mocks.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = read({ permissions: ['pflege.plans.view'], isCurrent: () => current });
    expect(mocks.read).toHaveBeenCalledTimes(1);
    current = false;
    finish({ data: [row()], count: 1, error: null });
    expect((await pending).ok).toBe(false);
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });
});
