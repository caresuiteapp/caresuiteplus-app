import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ profile: vi.fn(), plans: vi.fn(), permission: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: f.permission }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/portal/clientProfileLiveService', () => ({ fetchLiveClientPortalProfile: f.profile, fetchLiveClientCarePlanSummaries: f.plans }));
import { fetchClientPortalProfile, fetchClientCarePlanSummaries } from '@/lib/portal/clientProfileService';
beforeEach(() => { vi.clearAllMocks(); f.permission.mockReturnValue(null); f.profile.mockResolvedValue({ ok: true, data: { profile: { clientId: 'client-a' } } }); f.plans.mockResolvedValue({ ok: true, data: [] }); });
const base = { profileId: 'account-a', tenantId: 'tenant-a', clientId: 'client-a' };
describe('full client profile service boundary', () => {
  it('rejects family demographic and clinical reads before live services even when static role permissions allow them', async () => {
    expect((await fetchClientPortalProfile({ ...base, roleKey: 'family_portal' })).ok).toBe(false);
    expect((await fetchClientCarePlanSummaries({ ...base, roleKey: 'family_portal' })).ok).toBe(false);
    expect(f.profile).not.toHaveBeenCalled(); expect(f.plans).not.toHaveBeenCalled();
  });
  it('retains the client own-profile and care-plan path with exact tenant and client arguments', async () => {
    expect((await fetchClientPortalProfile({ ...base, roleKey: 'client_portal' })).ok).toBe(true);
    expect((await fetchClientCarePlanSummaries({ ...base, roleKey: 'client_portal' })).ok).toBe(true);
    expect(f.profile).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a');
    expect(f.plans).toHaveBeenCalledExactlyOnceWith('tenant-a', 'client-a');
  });
});
