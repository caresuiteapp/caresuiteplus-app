import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ client: {} as object | null, table: vi.fn(), permission: vi.fn(), guard: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.client }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: state.table }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: state.permission }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: state.guard }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (error: { message: string }) => error.message }));
import { loadOfficeWorktimeSettings, saveOfficeWorktimeSettings } from '@/lib/wfm/wfmOfficeSettings.web';

const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), upsert: vi.fn().mockReturnThis(), maybeSingle: vi.fn(), single: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks(); state.client = {}; state.permission.mockReturnValue(null); state.guard.mockReturnValue(null); state.table.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { module_enabled: false, require_privacy_consent: false }, error: null });
  query.single.mockResolvedValue({ data: { module_enabled: false, require_privacy_consent: true }, error: null });
});

describe('Office web settings persistence', () => {
  it('reads the persisted disabled state for the selected tenant without inventing demo defaults', async () => {
    expect(await loadOfficeWorktimeSettings('tenant-a', null)).toEqual({ ok: true, data: { moduleEnabled: false, requirePrivacyConsent: false } });
    expect(state.table).toHaveBeenCalledWith(state.client, 'tenant_time_tracking_settings');
    expect(query.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it('returns an absent configuration explicitly without creating one on read', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await loadOfficeWorktimeSettings('tenant-a', null)).toEqual({ ok: true, data: null });
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it('preserves read failures rather than showing enabled defaults', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Zugriff verweigert' } });
    expect(await loadOfficeWorktimeSettings('tenant-a', null)).toEqual({ ok: false, error: 'Zugriff verweigert' });
  });
  it.each([{ data: {} }, { data: { module_enabled: 'false', require_privacy_consent: true } }, { data: { module_enabled: true } }])('rejects malformed saved settings: $data', async ({ data }) => {
    query.maybeSingle.mockResolvedValue({ data, error: null });
    expect((await loadOfficeWorktimeSettings('tenant-a', null)).ok).toBe(false);
  });
  it('writes only the supported booleans and tenant identity, then returns the server-confirmed state', async () => {
    expect(await saveOfficeWorktimeSettings('tenant-a', null, { moduleEnabled: false, requirePrivacyConsent: true })).toEqual({ ok: true, data: { moduleEnabled: false, requirePrivacyConsent: true } });
    expect(query.upsert).toHaveBeenCalledWith({ tenant_id: 'tenant-a', module_enabled: false, require_privacy_consent: true, updated_at: expect.any(String) }, { onConflict: 'tenant_id' });
    expect(query.select).toHaveBeenCalledWith('module_enabled,require_privacy_consent');
    expect(query.single).toHaveBeenCalledTimes(1);
  });
  it('does not report success when the write or its confirmation fails', async () => {
    query.single.mockResolvedValue({ data: null, error: { message: 'Speicherung gesperrt' } });
    expect(await saveOfficeWorktimeSettings('tenant-a', null, { moduleEnabled: false, requirePrivacyConsent: true })).toEqual({ ok: false, error: 'Speicherung gesperrt' });
    query.single.mockResolvedValue({ data: null, error: null });
    expect((await saveOfficeWorktimeSettings('tenant-a', null, { moduleEnabled: false, requirePrivacyConsent: true })).ok).toBe(false);
  });
  it('checks permissions and tenant validity before reading or writing', async () => {
    state.permission.mockReturnValue({ ok: false, error: 'Keine Berechtigung' });
    expect((await loadOfficeWorktimeSettings('tenant-a', null)).ok).toBe(false);
    expect((await saveOfficeWorktimeSettings('tenant-a', null, { moduleEnabled: true, requirePrivacyConsent: true })).ok).toBe(false);
    state.permission.mockReturnValue(null); state.guard.mockReturnValue({ ok: false, error: 'Kein Mandant' });
    expect((await saveOfficeWorktimeSettings('', null, { moduleEnabled: true, requirePrivacyConsent: true })).ok).toBe(false);
    expect(state.table).not.toHaveBeenCalled();
  });
  it('fails closed without a database connection or with invalid input', async () => {
    state.client = null;
    expect((await loadOfficeWorktimeSettings('tenant-a', null)).ok).toBe(false);
    expect((await saveOfficeWorktimeSettings('tenant-a', null, { moduleEnabled: true, requirePrivacyConsent: true })).ok).toBe(false);
    state.client = {};
    expect((await saveOfficeWorktimeSettings('tenant-a', null, { moduleEnabled: 'yes', requirePrivacyConsent: true } as never)).ok).toBe(false);
    expect(state.table).not.toHaveBeenCalled();
  });
});
