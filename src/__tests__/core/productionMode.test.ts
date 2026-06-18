import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { fetchAppStartSnapshot } from '@/lib/landing/appStartService';
import {
  getTenantModules,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules/moduleAccessService';
import { hydrateTenantModulesFromSupabase } from '@/lib/modules/moduleAccessHydration';
import { resolveTenantIdForService } from '@/lib/tenant/tenantResolver';
import { assertLiveConfig, getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';

const fetchTenantModulesFromSupabase = vi.fn();

vi.mock('@/lib/modules/moduleAccessRepository.supabase', () => ({
  fetchTenantModulesFromSupabase: (...args: unknown[]) => fetchTenantModulesFromSupabase(...args),
}));

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function stubLiveEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
}

const LIVE_TENANT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('Production mode enforcement', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetModuleAccessStore();
    fetchTenantModulesFromSupabase.mockReset();
  });

  it('blockiert signInDemo im Live-Modus (AuthProvider-Guard)', () => {
    const source = readSrc('src/lib/auth/AuthProvider.tsx');
    expect(source).toContain('if (!isDemoMode())');
    expect(source).toContain('Demo-Anmeldung nur im Demo-Modus verfügbar');
  });

  it('demo auth route zeigt Hinweis statt Login wenn Demo deaktiviert', () => {
    const source = readSrc('app/auth/demo.tsx');
    expect(source).toContain('isDemoMode()');
    expect(source).toContain('DemoModeHintScreen');
    expect(source).toContain('DemoLoginScreen');
  });

  it('verwendet DEMO_TENANT_ID nicht als Live-Fallback ohne Profil', () => {
    stubLiveEnv();
    const result = resolveTenantIdForService(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Mandant');
    }
  });

  it('meldet fehlende Supabase-Konfiguration über assertLiveConfig statt stiller Demo-Umschaltung', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');

    expect(isDemoMode()).toBe(false);
    expect(getServiceMode()).toBe('demo');
    const config = assertLiveConfig();
    expect(config.ok).toBe(false);
    if (!config.ok) {
      expect(config.issues.some((issue) => issue.code === 'missing_url')).toBe(true);
      expect(config.issues.some((issue) => issue.code === 'missing_anon_key')).toBe(true);
    }
  });

  it('fetchAppStartSnapshot blendet Demo-Einstieg aus', async () => {
    const snapshot = await fetchAppStartSnapshot();
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(snapshot.data.some((entry) => entry.path.includes('demo'))).toBe(false);
    }
  });

  describe('hydrateTenantModulesFromSupabase', () => {
    beforeEach(() => {
      stubLiveEnv();
      resetModuleAccessStore();
    });

    it('ruft Supabase für Live-Mandant nicht mit DEMO_TENANT_ID auf', async () => {
      initializeModuleAccessStore(DEMO_TENANT_ID);
      const result = await hydrateTenantModulesFromSupabase(DEMO_TENANT_ID);
      expect(result.ok).toBe(true);
      expect(fetchTenantModulesFromSupabase).not.toHaveBeenCalled();
    });

    it('lädt Modulzugriff nach Session-Restore aus Supabase in den Store', async () => {
      fetchTenantModulesFromSupabase.mockResolvedValue({
        ok: true,
        data: [
          {
            id: 'tp-office',
            tenantId: LIVE_TENANT,
            productId: 'prod-office',
            productKey: 'office',
            isActive: true,
            activatedAt: '2026-01-01T00:00:00.000Z',
            accessSource: 'free_available',
            includedByModuleKey: null,
            isBaseIncluded: true,
            billingStatus: 'free_active',
            accessType: 'free',
            priceCents: 0,
            premiumReady: false,
          },
        ],
      });

      const result = await hydrateTenantModulesFromSupabase(LIVE_TENANT);
      expect(fetchTenantModulesFromSupabase).toHaveBeenCalledWith(LIVE_TENANT);
      expect(result.ok).toBe(true);

      const modules = getTenantModules(LIVE_TENANT);
      expect(modules.some((entry) => entry.productKey === 'office' && entry.isActive)).toBe(true);
    });
  });
});
