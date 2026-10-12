import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), account: vi.fn(), load: vi.fn(), profile: vi.fn(), project: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getUser: h.getUser }, rpc: h.rpc,
  from: () => ({ select: () => ({ eq: () => ({ in: () => ({ eq: () => ({
    maybeSingle: h.account,
  }) }) }) }) }),
}) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/office/employeePersonnelFileLiveLoader', () => ({ loadEmployeePersonnelFileLive: h.load }));
vi.mock('@/lib/portal/employeeProfileLiveService', () => ({ fetchLiveEmployeePortalProfile: h.profile }));
vi.mock('@/lib/portal/employeePortalPersonnelProjection', () => ({ projectEmployeePersonnelForPortal: h.project }));
import { fetchEmployeePortalPersonnelView } from '@/lib/portal/employeePortalPersonnelService';
import { fetchLiveEmployeePortalPersonnelView } from '@/lib/portal/employeePortalPersonnelLiveService';
import { fetchPortalEmployeeIdForAuthUser } from '@/lib/portal/resolvePortalEmployeeLink';
beforeEach(() => {
  vi.clearAllMocks();
  h.getUser.mockResolvedValue({ data: { user: { id: 'verified-auth-user' } }, error: null });
  h.rpc.mockImplementation(async (name: string) => ({ data: name === 'current_tenant_id' ? 'tenant-a' : 'employee-a', error: null }));
  h.account.mockResolvedValue({ data: { employee_id: 'employee-a' }, error: null });
  h.load.mockResolvedValue({ ok: true, data: { employeeId: 'employee-a', tenantId: 'tenant-a', documents: [] } });
  h.profile.mockResolvedValue({ ok: true, data: { employeeId: 'employee-a' } });
  h.project.mockImplementation((file) => ({ employeeId: file.employeeId, sections: [] }));
});
describe('employee personnel verified identity scope', () => {
  it.each([null, 'client_portal', 'family_portal', 'business_admin'] as const)('denies the %s role before loading an employee personal file', async (role) => {
    const result = await fetchEmployeePortalPersonnelView('caller', role, { tenantId: 'tenant-a', employeeId: 'employee-a' });
    expect(result.ok).toBe(false);
    expect(h.load).not.toHaveBeenCalled();
  });
  it.each([
    ['tenant-a', 'employee-other'], ['tenant-other', 'employee-a'],
  ])('denies caller-selected personnel scope %s/%s before the private loader', async (tenant, employee) => {
    const result = await fetchLiveEmployeePortalPersonnelView(tenant, employee);
    expect(result.ok).toBe(false);
    expect(h.load).not.toHaveBeenCalled();
  });
  it('does not substitute demo personnel for a missing live tenant', async () => {
    expect((await fetchEmployeePortalPersonnelView('caller', 'employee_portal', { employeeId: 'employee-a' })).ok).toBe(false);
    expect(h.load).not.toHaveBeenCalled();
  });
  it('loads only the employee linked to the verified current tenant and user', async () => {
    const result = await fetchLiveEmployeePortalPersonnelView('tenant-a', 'employee-a');
    expect(result.ok).toBe(true);
    expect(h.getUser).toHaveBeenCalledOnce();
    expect(h.rpc).toHaveBeenCalledWith('current_tenant_id');
    expect(h.rpc).toHaveBeenCalledWith('resolve_current_employee_id');
    expect(h.load).toHaveBeenCalledWith('tenant-a', 'employee-a');
  });
  it('does not treat a verified current employee as belonging to a different tenant', async () => {
    expect(await fetchPortalEmployeeIdForAuthUser('tenant-other')).toBeNull();
  });
  it.each(['caregiver', 'nurse'] as const)('uses the verified profile RPC fallback for a legacy %s without a portal account', async (roleKey) => {
    h.account.mockResolvedValue({ data: null, error: null });
    h.getUser.mockResolvedValue({ data: { user: { id: 'verified-auth-user', app_metadata: { role_key: roleKey } } }, error: null });
    h.rpc.mockImplementation(async (name: string) => ({
      data: name === 'current_tenant_id' ? 'tenant-a' : name === 'resolve_current_employee_id' ? 'employee-a' : null,
      error: null,
    }));
    expect((await fetchEmployeePortalPersonnelView('caller', roleKey, { tenantId: 'tenant-a', employeeId: 'employee-a' })).ok).toBe(true);
    expect(h.load).toHaveBeenCalledWith('tenant-a', 'employee-a');
    expect(h.rpc).not.toHaveBeenCalledWith('current_employee_id');
  });
  it.each([
    { data: { user: null }, error: null },
    { data: { user: null }, error: { message: 'invalid session' } },
  ])('does not load a personnel file without a confirmed auth user', async (auth) => {
    h.getUser.mockResolvedValue(auth);
    expect((await fetchLiveEmployeePortalPersonnelView('tenant-a', 'employee-a')).ok).toBe(false);
    expect(h.load).not.toHaveBeenCalled();
  });
  it('keeps permission lookup failures from falling back to a caller employee id', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    expect((await fetchLiveEmployeePortalPersonnelView('tenant-a', 'employee-a')).ok).toBe(false);
    expect(h.load).not.toHaveBeenCalled();
  });
});
