import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchTenantNotificationSettings, saveTenantNotificationSettings, TENANT_PUSH_SETTING_KEYS,
} from '@/lib/tenant/tenantNotificationSettingsService';

const h = vi.hoisted(() => ({
  live: true, configured: true, deniedTenant: false,
  response: { data: null as Record<string, unknown> | null, error: null as { message: string; code: string } | null },
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), upsert: vi.fn(),
}));
vi.mock('@/lib/services/liveServiceGuard', () => ({
  isLiveServiceMode: () => h.live,
  guardServiceTenant: () => h.deniedTenant ? { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' } : null,
}));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => {
    if (!h.configured) return null;
    const builder = {
      select: (...args: unknown[]) => { h.select(...args); return builder; },
      eq: (...args: unknown[]) => { h.eq(...args); return builder; },
      upsert: (...args: unknown[]) => { h.upsert(...args); return builder; },
      maybeSingle: async () => h.response,
      single: async () => h.response,
    };
    return { from: (...args: unknown[]) => { h.from(...args); return builder; } };
  },
}));
const row = {
  push_notifications_enabled: false, notify_assignment_changes: true,
  notify_new_message: true, notify_signature_required: false, notify_service_record_ready: true,
};
beforeEach(() => {
  vi.clearAllMocks(); h.live = true; h.configured = true; h.deniedTenant = false;
  h.response = { data: { ...row }, error: null };
});

describe('tenant push settings service', () => {
  it('reads the current tenant without enabling anything or writing during loading', async () => {
    const result = await fetchTenantNotificationSettings('tenant-one', 'business_admin');
    expect(h.from).toHaveBeenCalledWith('tenant_notification_settings');
    expect(h.eq).toHaveBeenCalledWith('tenant_id', 'tenant-one');
    expect(h.select).toHaveBeenCalledWith(TENANT_PUSH_SETTING_KEYS.join(','));
    expect(h.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: { ...row, tenantId: 'tenant-one', exists: true } });
  });

  it('presents missing or null settings as disabled without fabricating a saved activation', async () => {
    h.response.data = null;
    const result = await fetchTenantNotificationSettings('tenant-new', 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.exists).toBe(false);
      for (const key of TENANT_PUSH_SETTING_KEYS) expect(result.data[key]).toBe(false);
    }
    expect(h.upsert).not.toHaveBeenCalled();
    h.response.data = { ...row, push_notifications_enabled: null };
    const nullable = await fetchTenantNotificationSettings('tenant-one', 'business_admin');
    if (nullable.ok) expect(nullable.data.push_notifications_enabled).toBe(false);
  });

  it('writes only explicitly changed push fields and confirms the returned saved row', async () => {
    h.response.data = { ...row, push_notifications_enabled: true };
    const result = await saveTenantNotificationSettings('tenant-one', { push_notifications_enabled: true }, 'business_admin');
    expect(h.upsert).toHaveBeenCalledWith(
      { tenant_id: 'tenant-one', push_notifications_enabled: true },
      { onConflict: 'tenant_id', defaultToNull: false },
    );
    const payload = h.upsert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('notify_new_message');
    expect(payload).not.toHaveProperty('email_notifications_enabled');
    expect(payload).not.toHaveProperty('sms_notifications_enabled');
    expect(payload).not.toHaveProperty('in_app_notifications_enabled');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.push_notifications_enabled).toBe(true);
  });

  it('preserves RLS failure as an error rather than reporting successful activation', async () => {
    h.response = { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
    const result = await saveTenantNotificationSettings('tenant-one', { push_notifications_enabled: true }, 'business_admin');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('refuses unauthorized roles and blocked tenant scopes before querying', async () => {
    expect((await fetchTenantNotificationSettings('tenant-one', 'employee_portal')).ok).toBe(false);
    expect((await saveTenantNotificationSettings('tenant-one', { push_notifications_enabled: true }, 'client_portal')).ok).toBe(false);
    h.deniedTenant = true;
    expect((await saveTenantNotificationSettings('foreign-tenant', { push_notifications_enabled: true }, 'business_admin')).ok).toBe(false);
    expect(h.from).not.toHaveBeenCalled();
  });

  it('rejects injected settings, empty patches and non-boolean values before any write', async () => {
    const extra = { push_notifications_enabled: true, email_notifications_enabled: true };
    const wrong = { push_notifications_enabled: 'true' } as unknown as { push_notifications_enabled: boolean };
    for (const patch of [{}, extra, wrong]) {
      expect((await saveTenantNotificationSettings('tenant-one', patch, 'business_admin')).ok).toBe(false);
    }
    expect(h.from).not.toHaveBeenCalled();
  });

  it('fails clearly when the live connection or returned saved row is missing', async () => {
    h.configured = false;
    expect((await fetchTenantNotificationSettings('tenant-one', 'business_admin')).ok).toBe(false);
    expect((await saveTenantNotificationSettings('tenant-one', { push_notifications_enabled: true }, 'business_admin')).ok).toBe(false);
    h.configured = true; h.response.data = null;
    expect((await saveTenantNotificationSettings('tenant-one', { push_notifications_enabled: true }, 'business_admin')).ok).toBe(false);
  });

  it('keeps explicit demo changes isolated per tenant without touching Supabase', async () => {
    h.live = false;
    await saveTenantNotificationSettings('tenant-demo-one', { push_notifications_enabled: true, notify_new_message: true }, 'business_admin');
    const one = await fetchTenantNotificationSettings('tenant-demo-one', 'business_admin');
    const two = await fetchTenantNotificationSettings('tenant-demo-two', 'business_admin');
    if (one.ok) expect(one.data.push_notifications_enabled).toBe(true);
    if (two.ok) expect(two.data.push_notifications_enabled).toBe(false);
    expect(h.from).not.toHaveBeenCalled();
  });
});
