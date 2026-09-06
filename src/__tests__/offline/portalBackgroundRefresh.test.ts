import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({
  portal: null as Record<string, unknown> | null,
  epoch: 0,
  aligned: true,
  list: vi.fn(),
  details: vi.fn(),
  session: vi.fn(),
}));
vi.mock('@/lib/auth/portalSessionStore', () => ({
  loadPortalSession: async () => f.portal,
  getActivePortalSession: () => f.portal,
}));
vi.mock('@/lib/auth/portalSupabaseAuth', () => ({
  isPortalSupabaseSessionAligned: () => f.aligned,
}));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: { getSession: f.session } }),
}));
vi.mock('@/lib/offline/idb', () => ({ offlineCacheEpoch: () => f.epoch }));
vi.mock('@/lib/offline/assignmentCacheService', () => ({
  loadPortalAppointmentsWithCache: f.list,
}));
vi.mock('@/lib/offline/assignmentDetailPrefetch', () => ({
  prefetchAssignmentDetailCaches: f.details,
  selectPrefetchAssignmentCandidates: (items: unknown[]) => items,
}));
vi.mock('@/lib/portal/appointmentService', () => ({ fetchPortalClientAppointmentDetail: vi.fn() }));
vi.mock('@/lib/offline/clientAppointmentCache', () => ({ writeClientAppointmentCache: vi.fn() }));
import { refreshPortalDeviceCache } from '@/lib/offline/refreshPortalDeviceCache';
beforeEach(() => {
  vi.clearAllMocks();
  f.epoch = 0;
  f.aligned = true;
  f.portal = { accountId: 'a', tenantId: 't', roleKey: 'employee_portal', employeeId: 'e' };
  f.session.mockResolvedValue({ data: { session: {} }, error: null });
  f.list.mockResolvedValue({ ok: true, data: [], fromCache: false });
});
describe('OS background refresh uses only the active authenticated read scope', () => {
  it('does no server work when signed out or password change is still required', async () => {
    f.portal = null;
    expect(await refreshPortalDeviceCache()).toBe(true);
    f.portal = { mustChangePassword: true };
    expect(await refreshPortalDeviceCache()).toBe(true);
    expect(f.session).not.toHaveBeenCalled();
    expect(f.list).not.toHaveBeenCalled();
  });
  it('rejects a mismatched authentication session without repairing it in the background', async () => {
    f.aligned = false;
    expect(await refreshPortalDeviceCache()).toBe(false);
    expect(f.list).not.toHaveBeenCalled();
  });
  it('scopes the list and caps background detail work at two visits', async () => {
    expect(await refreshPortalDeviceCache()).toBe(true);
    expect(f.list).toHaveBeenCalledWith('a', 'employee_portal', 't', 'e', null, {
      skipDetailPrefetch: true,
    });
    expect(f.details).toHaveBeenCalledWith('a', 'employee_portal', 't', 'e', [], { limit: 2 });
  });
  it('stops prefetch if logout happens while the list is being fetched', async () => {
    f.list.mockImplementationOnce(async () => {
      f.epoch++;
      f.portal = null;
      return { ok: true, data: [], fromCache: false };
    });
    await refreshPortalDeviceCache();
    expect(f.details).not.toHaveBeenCalled();
  });
});
