import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/types/permissions';
import { assertOffboardingCanComplete, checkOffboardingInventory } from '@/lib/inventory/inventoryOffboardingService';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'web' }, mode: 'supabase', blocked: false,
  permissions: ['inventory.offboarding', 'office.employees.view'] as PermissionKey[],
  check: vi.fn(), demoAssignments: vi.fn(), demoItems: vi.fn(), runtime: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => mocks.mode }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => mocks.blocked ? { ok: false, error: 'Mandant gesperrt' } : null }));
vi.mock('@/lib/supabase/permissionRepository', () => ({ fetchRuntimePermissions: mocks.runtime }));
vi.mock('@/lib/inventory/companyInventoryService.web', () => ({ checkCompanyInventoryOffboarding: mocks.check }));
vi.mock('@/lib/inventory/inventoryRepository.demo', () => ({ inventoryDemoRepository: { listAssignmentsForEmployee: mocks.demoAssignments, listItems: mocks.demoItems } }));

beforeEach(() => {
  vi.clearAllMocks(); mocks.platform.OS = 'web'; mocks.mode = 'supabase'; mocks.blocked = false;
  mocks.permissions = ['inventory.offboarding', 'office.employees.view'];
  mocks.runtime.mockImplementation(async () => mocks.permissions);
  mocks.check.mockResolvedValue({ ok: true, data: { employeeId: 'employee-1', canCompleteOffboarding: false, openAssignments: [{ id: 'real-assignment' }], returnTasksSuggested: [], portalLockPrepared: false, deviceAccessDeactivatePrepared: false } });
  mocks.demoAssignments.mockReturnValue({ ok: true, data: [] }); mocks.demoItems.mockReturnValue({ ok: true, data: [] });
});

describe('existing offboarding inventory check on web', () => {
  it('delegates live web checks with runtime rights and never reads demo inventory', async () => {
    const result = await checkOffboardingInventory('tenant-1', 'employee-1', 'business_admin');
    expect(result.ok && result.data.canCompleteOffboarding).toBe(false);
    expect(mocks.check).toHaveBeenCalledWith({ tenantId: 'tenant-1', actorRoleKey: 'business_admin', actorProfileId: undefined, effectivePermissions: mocks.permissions }, 'employee-1');
    expect(mocks.demoAssignments).not.toHaveBeenCalled(); expect(mocks.demoItems).not.toHaveBeenCalled();
  });
  it('preserves explicitly removed rights instead of restoring static admin grants', async () => {
    mocks.check.mockResolvedValue({ ok: false, error: 'Keine Berechtigung' });
    const result = await checkOffboardingInventory('tenant-1', 'employee-1', 'business_admin', { effectivePermissions: [] });
    expect(result.ok).toBe(false);
    expect(mocks.check.mock.calls[0][0].effectivePermissions).toEqual([]);
    expect(mocks.runtime).not.toHaveBeenCalled(); expect(mocks.demoAssignments).not.toHaveBeenCalled();
  });
  it('does not approve completion or fall back on demo when the live check fails', async () => {
    mocks.check.mockResolvedValue({ ok: false, error: 'Inventar nicht erreichbar' });
    expect(await assertOffboardingCanComplete('tenant-1', 'employee-1', 'business_admin')).toEqual({ ok: false, error: 'Inventar nicht erreichbar' });
    expect(mocks.demoAssignments).not.toHaveBeenCalled();
  });
  it('blocks a foreign tenant before fetching rights or checking inventory', async () => {
    mocks.blocked = true;
    expect((await checkOffboardingInventory('tenant-foreign', 'employee-1', 'business_admin')).ok).toBe(false);
    expect(mocks.runtime).not.toHaveBeenCalled(); expect(mocks.check).not.toHaveBeenCalled();
  });
  it.each(['android', 'ios'])('retains the existing %s behavior', async platform => {
    mocks.platform.OS = platform;
    const result = await checkOffboardingInventory('tenant-1', 'employee-1', 'business_admin');
    expect(result.ok && result.data.canCompleteOffboarding).toBe(true);
    expect(mocks.demoAssignments).toHaveBeenCalledWith('tenant-1', 'employee-1');
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.runtime).not.toHaveBeenCalled();
  });
  it('keeps the explicitly selected demo environment separate from live web', async () => {
    mocks.mode = 'demo';
    expect((await checkOffboardingInventory('tenant-1', 'employee-1', 'business_admin')).ok).toBe(true);
    expect(mocks.demoAssignments).toHaveBeenCalled(); expect(mocks.check).not.toHaveBeenCalled();
  });
});
