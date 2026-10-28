import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  fetchTenantBrandingLogoUrl,
  saveTenantBrandingProfile,
  setCachedTenantBrandingLogoUrl,
} from '@/lib/tenant/tenantBrandingService';
import {
  resetTenantCenterStore,
  seedTenantCenterForTest,
} from '@/lib/tenant/tenantCenterService';
import { EMPTY_TENANT_LOGO } from '@/lib/tenant/tenantLogoService';
import * as liveServiceGuard from '@/lib/services/liveServiceGuard';
import * as tenantLogoService from '@/lib/tenant/tenantLogoService';


const access = vi.hoisted(() => ({ os: 'android', load: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { get OS() { return access.os; } } }));
vi.mock('@/lib/tenant/companyAccessService', () => ({ loadCompanyAccess: (...args: unknown[]) => access.load(...args) }));

describe('saveTenantBrandingProfile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    access.os = 'android'; access.load.mockReset(); access.load.mockResolvedValue({ ok: true, data: { permissions: ['business.tenant.manage'], scopeLimited: false } });
    resetTenantCenterStore();
  });

  it('returns error when there are no logo changes', async () => {
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(true);
    const snapshot = seedTenantCenterForTest(DEMO_TENANT_ID);

    const result = await saveTenantBrandingProfile(
      DEMO_TENANT_ID,
      snapshot.branding,
      { ...EMPTY_TENANT_LOGO, displayUri: snapshot.branding.logoUrl || null },
      'business_admin',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Keine Logo-Änderungen/);
    }
  });

  it('confirms native logo persistence before updating the cached profile', async () => {
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(true);
    vi.spyOn(tenantLogoService, 'resolveTenantLogoUrlForSave').mockResolvedValue({ ok: true, data: 'https://example.com/native-logo.png' });
    const persist = vi.spyOn(tenantLogoService, 'persistTenantLogoUrl').mockResolvedValue({ ok: true, data: undefined });
    const snapshot = seedTenantCenterForTest(DEMO_TENANT_ID);
    const pending = {
      localUri: 'blob:demo-logo',
      fileName: 'logo.png',
      mimeType: 'image/png' as const,
      sizeBytes: 128,
      contentBase64: 'abc',
    };

    const result = await saveTenantBrandingProfile(
      DEMO_TENANT_ID,
      snapshot.branding,
      { displayUri: pending.localUri, pending, removed: false },
      'business_admin',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.logoUrl).toBe('https://example.com/native-logo.png');
    }

    expect(persist).toHaveBeenCalledWith(DEMO_TENANT_ID, 'https://example.com/native-logo.png');
    expect(await fetchTenantBrandingLogoUrl(DEMO_TENANT_ID)).toBe('https://example.com/native-logo.png');
  });

  it('returns upload errors in live mode instead of false success', async () => {
    access.os = 'web';
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(true);
    vi.spyOn(tenantLogoService, 'resolveTenantLogoUrlForSave').mockResolvedValue({
      ok: false,
      error: 'Logo-Upload fehlgeschlagen.',
    });

    const snapshot = seedTenantCenterForTest(DEMO_TENANT_ID);
    const result = await saveTenantBrandingProfile(
      DEMO_TENANT_ID,
      snapshot.branding,
      {
        displayUri: 'blob:new-logo',
        pending: {
          localUri: 'blob:new-logo',
          fileName: 'logo.png',
          mimeType: 'image/png',
          sizeBytes: 128,
          contentBase64: 'abc',
        },
        removed: false,
      },
      'business_admin',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Upload fehlgeschlagen/);
    }
  });

  it('notifies logo subscribers when cache updates after save', async () => {
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(true);
    vi.spyOn(tenantLogoService, 'resolveTenantLogoUrlForSave').mockResolvedValue({ ok: true, data: 'https://example.com/notify-logo.png' });
    vi.spyOn(tenantLogoService, 'persistTenantLogoUrl').mockResolvedValue({ ok: true, data: undefined });
    const snapshot = seedTenantCenterForTest(DEMO_TENANT_ID);
    const listener = vi.fn();
    const { subscribeToTenantBrandingLogoChanges } = await import('@/lib/tenant/tenantBrandingService');
    const unsubscribe = subscribeToTenantBrandingLogoChanges(listener);

    const result = await saveTenantBrandingProfile(
      DEMO_TENANT_ID,
      { ...snapshot.branding, logoUrl: '' },
      {
        displayUri: 'blob:notify-logo',
        pending: {
          localUri: 'blob:notify-logo',
          fileName: 'logo.png',
          mimeType: 'image/png',
          sizeBytes: 128,
          contentBase64: 'abc',
        },
        removed: false,
      },
      'business_admin',
    );

    expect(result.ok).toBe(true);
    expect(listener).toHaveBeenCalledWith(DEMO_TENANT_ID, 'https://example.com/notify-logo.png');
    unsubscribe();
  });
  it.each(['web', 'android', 'ios'])('blocks %s logo changes without a live connection before upload', async os => {
    access.os = os;
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(false);
    const upload = vi.spyOn(tenantLogoService, 'resolveTenantLogoUrlForSave');
    const persist = vi.spyOn(tenantLogoService, 'persistTenantLogoUrl');
    expect(await saveTenantBrandingProfile(DEMO_TENANT_ID, seedTenantCenterForTest(DEMO_TENANT_ID).branding, { ...EMPTY_TENANT_LOGO, removed: true }, 'business_admin')).toMatchObject({ ok: false, error: expect.stringContaining('aktive Datenverbindung') });
    expect(upload).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
  it('does not update the cache or notify subscribers when native persistence fails', async () => {
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(true);
    vi.spyOn(tenantLogoService, 'resolveTenantLogoUrlForSave').mockResolvedValue({ ok: true, data: 'https://example.com/rejected.png' });
    vi.spyOn(tenantLogoService, 'persistTenantLogoUrl').mockResolvedValue({ ok: false, error: 'Speichern fehlgeschlagen.' });
    setCachedTenantBrandingLogoUrl(DEMO_TENANT_ID, 'https://example.com/confirmed.png');
    const listener = vi.fn();
    const { subscribeToTenantBrandingLogoChanges } = await import('@/lib/tenant/tenantBrandingService');
    const unsubscribe = subscribeToTenantBrandingLogoChanges(listener);
    try {
      expect((await saveTenantBrandingProfile(DEMO_TENANT_ID, seedTenantCenterForTest(DEMO_TENANT_ID).branding, { ...EMPTY_TENANT_LOGO, removed: true }, 'business_admin')).ok).toBe(false);
      expect(await fetchTenantBrandingLogoUrl(DEMO_TENANT_ID)).toBe('https://example.com/confirmed.png');
      expect(listener).not.toHaveBeenCalled();
    } finally { unsubscribe(); }
  });
  it('honors an authoritative Web grant even when the role alone lacks company management', async () => {
    access.os = 'web'; vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(true);
    vi.spyOn(tenantLogoService, 'resolveTenantLogoUrlForSave').mockResolvedValue({ ok: true, data: null });
    const persist = vi.spyOn(tenantLogoService, 'persistTenantLogoUrl').mockResolvedValue({ ok: true, data: undefined });
    const branding = { ...seedTenantCenterForTest(DEMO_TENANT_ID).branding, logoUrl: 'https://example.com/logo.png' };
    expect((await saveTenantBrandingProfile(DEMO_TENANT_ID, branding, { ...EMPTY_TENANT_LOGO, removed: true }, 'dispatch')).ok).toBe(true);
    expect(persist).toHaveBeenCalledWith(DEMO_TENANT_ID, null);
  });
  it('blocks scope-limited Web branding before touching storage', async () => {
    access.os = 'web'; vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(true);
    access.load.mockResolvedValue({ ok: true, data: { permissions: ['business.tenant.manage'], scopeLimited: true } });
    const resolve = vi.spyOn(tenantLogoService, 'resolveTenantLogoUrlForSave');
    expect((await saveTenantBrandingProfile(DEMO_TENANT_ID, seedTenantCenterForTest(DEMO_TENANT_ID).branding, { ...EMPTY_TENANT_LOGO, removed: true }, 'business_admin')).ok).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });

});

describe('fetchTenantBrandingLogoUrl cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached logo without hitting the database', async () => {
    setCachedTenantBrandingLogoUrl('tenant-cache-test', 'https://example.com/logo.png');
    const clientSpy = vi.spyOn(await import('@/lib/supabase/client'), 'getSupabaseClient');

    const logoUrl = await fetchTenantBrandingLogoUrl('tenant-cache-test');
    expect(logoUrl).toBe('https://example.com/logo.png');
    expect(clientSpy).not.toHaveBeenCalled();
  });
});
