import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDefaultTenantCalendarSettings } from '@/types/modules/calendarEvent';
const f = vi.hoisted(() => ({ permission: vi.fn(), guard: vi.fn(), read: vi.fn(), write: vi.fn(), storageRead: vi.fn(), storageWrite: vi.fn(), client: {} as object | null, live: true }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: f.storageRead, setItem: f.storageWrite } }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: f.permission }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: f.guard, isLiveServiceMode: () => f.live }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => f.client }));
vi.mock('@/lib/supabase/errors', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/supabase/errors')>(),
  toGermanSupabaseError: (error: { message: string }) => error.message,
}));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  let payload: unknown;
  const chain = { select: () => chain, eq: () => chain, maybeSingle: () => f.read(), upsert: (value: unknown) => { payload = value; return chain; }, single: () => f.write(payload) };
  return chain;
} }));
import { fetchTenantCalendarSettings, saveTenantCalendarSettings, subscribeTenantCalendarSettings, toTenantCalendarSettingsForm } from '@/lib/office/tenantCalendarSettingsService.web';
const form = () => toTenantCalendarSettingsForm(buildDefaultTenantCalendarSettings('tenant-a'));
beforeEach(() => { vi.clearAllMocks(); f.client = {}; f.live = true; f.permission.mockReturnValue(null); f.guard.mockReturnValue(null); f.read.mockResolvedValue({ data: null, error: null }); f.write.mockImplementation(async (data) => ({ data, error: null })); });
describe('Web calendar settings persistence', () => {
  it('requires tenant-management permission instead of allowing every calendar reader to save', async () => {
    f.permission.mockReturnValue({ ok: false, error: 'Nur Leserechte' });
    expect((await saveTenantCalendarSettings('tenant-a', form(), 'dispatch')).ok).toBe(false);
    expect(f.permission).toHaveBeenCalledWith('dispatch', 'business.tenant.manage'); expect(f.write).not.toHaveBeenCalled();
  });
  it('does not publish or cache failed server writes', async () => {
    const listener = vi.fn(), unsubscribe = subscribeTenantCalendarSettings(listener);
    f.write.mockResolvedValue({ data: null, error: { message: 'RLS verweigert' } });
    expect(await saveTenantCalendarSettings('tenant-a', form(), 'business_admin')).toEqual({ ok: false, error: 'RLS verweigert' });
    expect(listener).not.toHaveBeenCalled(); expect(f.storageWrite).not.toHaveBeenCalled(); unsubscribe();
  });
  it.each(['PGRST205', '42P01'])('reports an unavailable calendar settings table while loading (%s)', async (code) => {
    f.read.mockResolvedValue({ data: null, error: { code, message: 'Missing tenant_calendar_settings' } });
    const result = await fetchTenantCalendarSettings('tenant-a', 'business_admin');
    expect(result).toEqual({ ok: false, error: 'Die Kalendereinstellungen sind derzeit nicht verfügbar. Bitte erneut laden.' });
    expect(f.write).not.toHaveBeenCalled();
    expect(f.storageRead).not.toHaveBeenCalled();
  });
  it('does not claim settings were saved when the central settings table is unavailable', async () => {
    const listener = vi.fn(), unsubscribe = subscribeTenantCalendarSettings(listener);
    f.write.mockResolvedValue({ data: null, error: { code: 'PGRST205', message: 'Missing tenant_calendar_settings' } });
    expect(await saveTenantCalendarSettings('tenant-a', form(), 'business_admin')).toEqual({
      ok: false, error: 'Die Kalendereinstellungen konnten nicht gespeichert werden. Bitte erneut versuchen.',
    });
    expect(listener).not.toHaveBeenCalled(); expect(f.storageWrite).not.toHaveBeenCalled(); unsubscribe();
  });
  it('requires a returned row from the intended tenant', async () => {
    f.write.mockResolvedValue({ data: null, error: null });
    expect((await saveTenantCalendarSettings('tenant-a', form(), 'business_admin')).ok).toBe(false);
    f.write.mockResolvedValue({ data: { tenant_id: 'tenant-b' }, error: null });
    expect((await saveTenantCalendarSettings('tenant-a', form(), 'business_admin')).ok).toBe(false);
  });
  it('publishes confirmed changes to all mounted calendar instances', async () => {
    const listener = vi.fn(), unsubscribe = subscribeTenantCalendarSettings(listener);
    const result = await saveTenantCalendarSettings('tenant-a', { ...form(), defaultView: 'agenda' }, 'business_admin');
    expect(result.ok && result.data.defaultView).toBe('agenda');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', defaultView: 'agenda' })); unsubscribe();
  });
  it('keeps live reads authoritative after saving and reports failed refreshes', async () => {
    await saveTenantCalendarSettings('tenant-a', { ...form(), defaultView: 'year' }, 'business_admin');
    f.read.mockResolvedValue({ data: { settings: { ...form(), defaultView: 'week' } }, error: null });
    const refreshed = await fetchTenantCalendarSettings('tenant-a', 'business_admin');
    expect(refreshed.ok && refreshed.data.defaultView).toBe('week');
    f.read.mockResolvedValue({ data: null, error: { message: 'Offline' } });
    expect(await fetchTenantCalendarSettings('tenant-a', 'business_admin')).toEqual({ ok: false, error: 'Offline' });
    expect(f.storageRead).not.toHaveBeenCalled();
  });
  it('rejects unavailable connections and thrown writes without reporting success', async () => {
    f.client = null; expect((await saveTenantCalendarSettings('tenant-a', form(), 'business_admin')).ok).toBe(false);
    f.client = {}; f.write.mockRejectedValue(new Error('Verbindung beendet'));
    expect(await saveTenantCalendarSettings('tenant-a', form(), 'business_admin')).toEqual({ ok: false, error: 'Verbindung beendet' });
  });
  it('normalizes list/agenda and invalid numbers without persisting NaN', async () => {
    const result = await saveTenantCalendarSettings('tenant-a', { ...form(), defaultView: 'list', maxCollapsedEvents: NaN, dayViewStartHour: Infinity }, 'business_admin');
    expect(result.ok && result.data).toMatchObject({ defaultView: 'list', maxCollapsedEvents: 3, dayViewStartHour: 6 });
  });
});
