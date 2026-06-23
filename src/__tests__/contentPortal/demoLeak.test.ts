import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEMO_SUPABASE_UUID,
  E2E_TEST_TENANT_ID,
  INTERNAL_TEST_TENANT_IDS,
  isDemoSupabaseTenantId,
  isInternalTestTenantId,
  LIVE_PROTECTED_TENANT_IDS,
} from '@/data/constants/demoGuard';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  assertDemoDataNotInProduction,
  isDemoDataTenant,
  resetTenantEnvironmentSettingsStore,
} from '@/lib/environment';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const root = path.join(__dirname, '..', '..', '..');

function stubLiveProductionEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  vi.stubEnv('EXPO_PUBLIC_ENVIRONMENT_MODE', 'production');
}

describe('content portal demo leak guards', () => {
  beforeEach(() => {
    resetTenantEnvironmentSettingsStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defines DEMO_SUPABASE_UUID constant', () => {
    expect(DEMO_SUPABASE_UUID).toBe('a0000000-0000-4000-8000-000000000001');
    expect(isDemoSupabaseTenantId(DEMO_SUPABASE_UUID)).toBe(true);
  });

  it('liveServiceGuard wires environment guards', () => {
    const source = readFileSync(path.join(root, 'src/lib/services/liveServiceGuard.ts'), 'utf8');
    expect(source).toContain('assertDemoDataNotInProduction');
    expect(source).toContain('assertTenantAllowedForMode');
  });

  it('blocks demo tenant and supabase demo UUID in production', () => {
    stubLiveProductionEnv();
    expect(assertDemoDataNotInProduction(DEMO_TENANT_ID).ok).toBe(false);
    expect(assertDemoDataNotInProduction(DEMO_SUPABASE_UUID).ok).toBe(false);
    expect(guardServiceTenant(DEMO_SUPABASE_UUID)?.error).toMatch(/Demo/i);
  });

  it('internal test tenants are not classified as demo data', () => {
    stubLiveProductionEnv();
    for (const tenantId of INTERNAL_TEST_TENANT_IDS) {
      expect(isInternalTestTenantId(tenantId)).toBe(true);
      expect(isDemoDataTenant(tenantId)).toBe(false);
      expect(assertDemoDataNotInProduction(tenantId).ok).toBe(true);
    }
    expect(isInternalTestTenantId('3d6220dd-1111-2222-3333-444444444444')).toBe(true);
  });

  it('live protected tenant is never demo classified', () => {
    stubLiveProductionEnv();
    for (const tenantId of LIVE_PROTECTED_TENANT_IDS) {
      expect(isDemoDataTenant(tenantId)).toBe(false);
      expect(guardServiceTenant(tenantId)).toBeNull();
    }
  });

  it('E2E tenant matches known test id', () => {
    expect(E2E_TEST_TENANT_ID).toBe('a4ba83bd-65db-46cf-8cf7-61492cc78315');
  });
});
