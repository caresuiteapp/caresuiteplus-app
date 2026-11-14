import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ db: { from: vi.fn() }, tenant: vi.fn(), role: vi.fn(), range: vi.fn(), eq: vi.fn(), order: vi.fn(), select: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mock.db }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: mock.tenant }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: mock.role }));
import { fetchCareOperationsQueue } from '@/lib/pflege/ambulatoryOperationsService';

const tenant = '11111111-1111-4111-8111-111111111111';
const first = '55555555-5555-4555-8555-555555555555';
const foreign = '66666666-6666-4666-8666-666666666666';
const row = { tenant_id: tenant, id: '44444444-4444-4444-8444-444444444444', client_id: first, status: 'open', updated_at: '2026-11-14T10:00:00Z', title: 'Aufgabe' };
const chain = { select: mock.select, eq: mock.eq, order: mock.order, range: mock.range };

beforeEach(() => {
  vi.clearAllMocks();
  mock.tenant.mockReturnValue(null); mock.role.mockReturnValue(null);
  mock.db.from.mockReturnValue(chain); mock.select.mockReturnValue(chain); mock.eq.mockReturnValue(chain); mock.order.mockReturnValue(chain);
});

describe('scoped operations reads', () => {
  it('queries only the requested case, tenant and work queue, then preserves only that kind', async () => {
    mock.range.mockResolvedValue({ data: [row], error: null, count: 1 });
    const result = await fetchCareOperationsQueue(tenant, 'business_admin', 'tasks', first, () => true);
    expect(mock.db.from.mock.calls).toEqual([['care_operations_tasks']]);
    expect(mock.eq.mock.calls).toEqual([['tenant_id', tenant], ['client_id', first]]);
    expect(mock.select).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(result).toMatchObject({ ok: true, data: { admissions: [], tariffs: [], tasks: [{ id: row.id, clientId: first }] } });
  });

  it('rejects returned rows for another case and count truncation', async () => {
    mock.range.mockResolvedValue({ data: [{ ...row, client_id: foreign }], error: null, count: 1 });
    await expect(fetchCareOperationsQueue(tenant, 'business_admin', 'tasks', first, () => true)).resolves.toMatchObject({ ok: false });
    mock.range.mockResolvedValue({ data: [row], error: null, count: 2 });
    await expect(fetchCareOperationsQueue(tenant, 'business_admin', 'tasks', first, () => true)).resolves.toMatchObject({ ok: false });
  });

  it('starts no protected select if the scope is invalid and never returns a result after losing that scope', async () => {
    await expect(fetchCareOperationsQueue(tenant, 'business_admin', 'tasks', first, () => false)).resolves.toMatchObject({ ok: false });
    expect(mock.db.from).not.toHaveBeenCalled();
    let valid = true;
    mock.range.mockImplementation(async () => { valid = false; return { data: [row], error: null, count: 1 }; });
    await expect(fetchCareOperationsQueue(tenant, 'business_admin', 'tasks', first, () => valid)).resolves.toMatchObject({ ok: false });
  });
});
