import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  fetchTenantBrandingLogoUrl,
  saveTenantBrandingProfile,
  setCachedTenantBrandingLogoUrl,
} from '@/lib/tenant/tenantBrandingService';
import {
  fetchTenantCenter,
  resetTenantCenterStore,
  seedTenantCenterForTest,
} from '@/lib/tenant/tenantCenterService';
import { EMPTY_TENANT_LOGO } from '@/lib/tenant/tenantLogoService';
import * as liveServiceGuard from '@/lib/services/liveServiceGuard';
import * as tenantLogoService from '@/lib/tenant/tenantLogoService';

describe('saveTenantBrandingProfile', () => {
  beforeEach(() => {
    resetTenantCenterStore();
    vi.restoreAllMocks();
  });

  it('returns error when there are no logo changes', async () => {
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(false);
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

  it('persists demo logo changes in the tenant center store', async () => {
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(false);
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
      expect(result.data.logoUrl).toBe('blob:demo-logo');
    }

    const loaded = await fetchTenantCenter(DEMO_TENANT_ID, 'business_admin');
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.data.branding.logoUrl).toBe('blob:demo-logo');
    }
  });

  it('returns upload errors in live mode instead of false success', async () => {
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
    vi.spyOn(liveServiceGuard, 'isLiveServiceMode').mockReturnValue(false);
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
    expect(listener).toHaveBeenCalledWith(DEMO_TENANT_ID, 'blob:notify-logo');
    unsubscribe();
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
