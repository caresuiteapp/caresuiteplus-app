import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ from: vi.fn(), permission: vi.fn(), guard: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: h.from }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: h.guard }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: h.permission }));
import { fetchPortalTimeTrackingSettings } from '@/lib/timeTracking/timeTrackingSettingsService';
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks(); h.permission.mockReturnValue(null); h.guard.mockReturnValue(null); h.from.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { module_enabled: false, require_privacy_consent: false }, error: null });
});
describe('persisted employee time-tracking start settings', () => {
  it('preserves disabled module and disabled consent from the real tenant row', async () => {
    expect(await fetchPortalTimeTrackingSettings('tenant-a', 'employee_portal')).toEqual({ ok: true, data: { moduleEnabled: false, requirePrivacyConsent: false } });
    expect(h.from).toHaveBeenCalledWith('tenant_time_tracking_settings');
    expect(query.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(query.select).toHaveBeenCalledWith('module_enabled,require_privacy_consent');
  });
  it('reports an absent or RLS-hidden row instead of inventing enabled defaults', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await fetchPortalTimeTrackingSettings('tenant-a', 'employee_portal');
    expect(result.ok).toBe(false); expect(!result.ok && result.error).toContain('nicht hinterlegt');
  });
  it('reports failed reads instead of replacing persisted settings with a local catalog', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Settings unavailable' } });
    expect((await fetchPortalTimeTrackingSettings('tenant-a', 'employee_portal')).ok).toBe(false);
  });
  it('checks permission before accessing a tenant table', async () => {
    h.permission.mockReturnValue({ ok: false, error: 'Keine Berechtigung' });
    expect(await fetchPortalTimeTrackingSettings('tenant-a', 'client_portal')).toEqual({ ok: false, error: 'Keine Berechtigung' });
    expect(h.from).not.toHaveBeenCalled();
  });
});
