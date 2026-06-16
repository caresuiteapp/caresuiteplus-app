import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { fetchDashboardSnapshot } from '@/lib/dashboard/dashboardService';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import * as tenantDisplayName from '@/lib/tenant/tenantDisplayName';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const LIVE_TENANT_ID = '56180c22-b894-4fab-b55e-a563c94dd6e7';

describe('live dashboard snapshots', () => {
  beforeEach(() => {
    vi.spyOn(tenantDisplayName, 'fetchTenantDisplayName').mockResolvedValue('Helferhasen+');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns demo data only in demo mode', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');

    const result = await fetchDashboardSnapshot(DEMO_TENANT_ID, 'business_admin', 'business');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantName).toBe('CareSuite+ Demo');
      expect(result.data.kpis.some((kpi) => String(kpi.subValue).includes('Demo-Mandanten'))).toBe(true);
      expect(result.data.activities.length).toBeGreaterThan(0);
    }
  });

  it('returns empty live snapshot with real tenant name in supabase mode', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const result = await fetchDashboardSnapshot(LIVE_TENANT_ID, 'business_admin', 'business');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantName).toBe('Helferhasen+');
      expect(result.data.tenantId).toBe(LIVE_TENANT_ID);
      expect(result.data.kpis.every((kpi) => kpi.value === 0 || kpi.value === '0')).toBe(true);
      expect(result.data.kpis.some((kpi) => String(kpi.subValue).includes('Demo'))).toBe(false);
      expect(result.data.activities).toEqual([]);
    }
  });

  it('returns empty office snapshot in supabase mode', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const result = await fetchOfficeDashboard(LIVE_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantName).toBe('Helferhasen+');
      expect(result.data.activities).toEqual([]);
      expect(result.data.kpis.every((kpi) => kpi.value === 0)).toBe(true);
    }
  });
});
