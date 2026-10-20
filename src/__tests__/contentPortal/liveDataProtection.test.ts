import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEMO_SUPABASE_UUID,
  E2E_TEST_TENANT_ID,
  LIVE_PROTECTED_TENANT_IDS,
} from '@/data/constants/demoGuard';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  assertDemoDataNotInProduction,
  assertTenantAllowedForMode,
  getMode,
  resetEnvironmentAuditStore,
  resetTenantEnvironmentSettingsStore,
} from '@/lib/environment';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fetchDashboardSnapshot } from '@/lib/dashboard/dashboardService';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';

const root = path.join(__dirname, '..', '..', '..');
const LIVE_TENANT = LIVE_PROTECTED_TENANT_IDS[0];

function stubLiveProductionEnv() {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  vi.stubEnv('EXPO_PUBLIC_ENVIRONMENT_MODE', 'production');
}

describe('content portal live data protection', () => {
  beforeEach(() => {
    resetEnvironmentAuditStore();
    resetTenantEnvironmentSettingsStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks DEMO_SUPABASE_UUID in production via guardServiceTenant', () => {
    stubLiveProductionEnv();
    expect(assertDemoDataNotInProduction(DEMO_SUPABASE_UUID).ok).toBe(false);
    expect(guardServiceTenant(DEMO_SUPABASE_UUID)?.error).toContain('Demo');
  });

  it('allows live protected tenant in production', () => {
    stubLiveProductionEnv();
    expect(assertTenantAllowedForMode(LIVE_TENANT).ok).toBe(true);
    expect(guardServiceTenant(LIVE_TENANT)).toBeNull();
  });

  it('treats E2E test tenant as internal_test not demo leak', () => {
    stubLiveProductionEnv();
    expect(getMode(E2E_TEST_TENANT_ID)).toBe('internal_test');
    expect(assertDemoDataNotInProduction(E2E_TEST_TENANT_ID).ok).toBe(true);
    expect(guardServiceTenant(E2E_TEST_TENANT_ID)).toBeNull();
  });

  it('dashboard services gate tenant before live fetch', () => {
    const dashboard = readFileSync(path.join(root, 'src/lib/dashboard/dashboardService.ts'), 'utf8');
    const office = readFileSync(path.join(root, 'src/lib/office/officeDashboardService.ts'), 'utf8');
    expect(dashboard).toContain('guardServiceTenant');
    expect(office).toContain('guardServiceTenant');
    expect(dashboard).toMatch(/getServiceMode\(\) === 'supabase'/);
    expect(office).toMatch(/getServiceMode\(\) === 'supabase'/);
  });

  it('does not call demo builders on supabase path', async () => {
    stubLiveProductionEnv();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');

    const dashboardResult = await fetchDashboardSnapshot(LIVE_TENANT, 'business_admin', 'business');
    if (dashboardResult.ok) {
      expect(dashboardResult.data.tenantId).toBe(LIVE_TENANT);
      expect(dashboardResult.data.tenantId).not.toBe(DEMO_TENANT_ID);
    }

    const officeResult = await fetchOfficeDashboard(LIVE_TENANT, 'business_admin');
    if (officeResult.ok) {
      expect(officeResult.data.tenantId).toBe(LIVE_TENANT);
    }
  });
});
