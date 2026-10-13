import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ profile: vi.fn(), timesheet: vi.fn(), demoProfile: vi.fn(), demoTimesheet: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/portal/employeeProfileLiveService', () => ({ fetchLiveEmployeePortalProfile: h.profile, fetchLiveEmployeeTimesheet: h.timesheet }));
vi.mock('@/data/demo/portalEmployee', () => ({ getDemoEmployeeProfile: h.demoProfile, getDemoTimesheetEntries: h.demoTimesheet }));
import { fetchEmployeePortalProfile, fetchEmployeeTimesheet } from '@/lib/portal/employeeProfileService';
beforeEach(() => { vi.clearAllMocks(); h.profile.mockResolvedValue({ ok: true, data: { id: 'employee-a' } }); h.timesheet.mockResolvedValue({ ok: true, data: [] }); });
describe('live employee profile services never substitute demo records', () => {
  it.each([{ tenantId: null, employeeId: 'employee-a' }, { tenantId: 'tenant-a', employeeId: null }, undefined])('rejects incomplete live context %j', async (context) => {
    expect((await fetchEmployeePortalProfile('profile-a', 'employee_portal', context)).ok).toBe(false);
    expect((await fetchEmployeeTimesheet('profile-a', 'employee_portal', context)).ok).toBe(false);
    expect(h.demoProfile).not.toHaveBeenCalled(); expect(h.demoTimesheet).not.toHaveBeenCalled(); expect(h.profile).not.toHaveBeenCalled();
  });
  it('loads only the linked live employee with a complete scope', async () => {
    await fetchEmployeePortalProfile('profile-a', 'employee_portal', { tenantId: 'tenant-a', employeeId: 'employee-a' });
    expect(h.profile).toHaveBeenCalledWith('tenant-a', 'employee-a'); expect(h.demoProfile).not.toHaveBeenCalled();
  });
});
