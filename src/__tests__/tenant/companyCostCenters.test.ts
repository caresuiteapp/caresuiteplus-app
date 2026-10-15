import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ rpc: vi.fn(), denied: false }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => h.denied ? { ok: false, error: 'Kein Zugriff' } : null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null, isLiveServiceMode: () => true }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: h.rpc }) }));
import { loadCompanyCostCenters, saveCompanyCostCenter, validateCompanyCostCenter } from '@/lib/tenant/companyCostCenters.web';
const T = '11111111-1111-4111-8111-111111111111'; const C = '22222222-2222-4222-8222-222222222222';
const scope = { tenantId: T, roleKey: 'business_admin' as const };
const saved = { id: C, tenant_id: T, code: 'VERW', name: 'Verwaltung', organization_id: null, is_active: true, updated_at: '2026-10-15T12:00:00Z' };
beforeEach(() => { h.rpc.mockReset(); h.denied = false; });
describe('live company cost centers', () => {
  it('reads actual tenant rows and paginates without demo fallback', async () => {
    h.rpc.mockResolvedValueOnce({ data: { costCenters: Array.from({ length: 200 }, () => saved), organizations: [] }, error: null }).mockResolvedValueOnce({ data: { costCenters: [], organizations: [] }, error: null });
    const result = await loadCompanyCostCenters(scope); expect(result.ok).toBe(true); if (result.ok) expect(result.data.costCenters.length).toBe(200);
    expect(h.rpc).toHaveBeenLastCalledWith('company_cost_centers_read', { p_tenant_id: T, p_offset: 200 });
  });
  it('passes optimistic concurrency and normalizes the company code', async () => {
    h.rpc.mockResolvedValue({ data: saved, error: null });
    expect((await saveCompanyCostCenter(scope, { id: C, expectedUpdatedAt: 'previous', code: ' verw ', name: ' Verwaltung ', organizationId: null, isActive: true })).ok).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith('company_cost_center_save', expect.objectContaining({ p_id: C, p_expected_updated_at: 'previous', p_code: 'VERW', p_tenant_id: T }));
  });
  it('requires reload after a stale or unconfirmed mutation and rejects foreign returned records', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '40001' } });
    expect(await saveCompanyCostCenter(scope, { code: 'VERW', name: 'Verwaltung', organizationId: null, isActive: true })).toMatchObject({ ok: false, reloadRequired: true });
    h.rpc.mockResolvedValue({ data: { ...saved, tenant_id: 'foreign' }, error: null });
    expect((await saveCompanyCostCenter(scope, { code: 'VERW', name: 'Verwaltung', organizationId: null, isActive: true })).ok).toBe(false);
  });
  it('validates before RPC and denies scoped-out frontend permissions before access', async () => {
    expect(validateCompanyCostCenter({ code: 'BAD CODE', name: 'Name', organizationId: null, isActive: true })).toBeTruthy();
    expect((await saveCompanyCostCenter(scope, { code: '', name: 'Name', organizationId: null, isActive: true })).ok).toBe(false); expect(h.rpc).not.toHaveBeenCalled();
    h.denied = true; expect((await loadCompanyCostCenters(scope)).ok).toBe(false); expect(h.rpc).not.toHaveBeenCalled();
  });
});
