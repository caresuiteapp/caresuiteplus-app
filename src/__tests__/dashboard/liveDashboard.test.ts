import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { emptyBusinessDashboardMetrics } from '@/lib/dashboard/businessDashboardMetrics';
import { fetchDashboardSnapshot } from '@/lib/dashboard/dashboardService';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import { emptyOfficeDashboardMetrics } from '@/lib/office/officeDashboardMetrics';
import { officeDashboardSupabaseRepository } from '@/lib/services/repositories/officeDashboardRepository.supabase';
import { officeAuditLogSupabaseRepository } from '@/lib/services/repositories/officeAuditLogRepository.supabase';
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

  it('returns live business snapshot with real KPIs in supabase mode', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(officeDashboardSupabaseRepository, 'fetchBusinessMetrics').mockResolvedValue({
      ok: true,
      data: {
        ...emptyBusinessDashboardMetrics(),
        activeClients: 1,
        totalClients: 1,
        activeModules: 3,
        totalModules: 6,
        tableAvailability: {
          clients: true,
          assignments: true,
          employees: true,
          invoices: true,
          tasks: true,
          messages: true,
          modules: true,
          portalUsers: true,
          documents: true,
          portalRequests: true,
          serviceRecords: true,
          budgets: true,
          appointments: true,
        },
      },
    });
    vi.spyOn(officeDashboardSupabaseRepository, 'fetchRecentTimelineEvents').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'timeline-1',
          title: 'Aufnahme abgeschlossen',
          subtitle: 'Heinz-Peter Reinhardt',
          icon: '📋',
          status: 'abgeschlossen',
          created_at: '2026-06-17T10:00:00.000Z',
          event_type: 'sonstige',
        },
      ],
    });
    vi.spyOn(officeAuditLogSupabaseRepository, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });

    const result = await fetchDashboardSnapshot(LIVE_TENANT_ID, 'business_admin', 'business');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantName).toBe('Helferhasen+');
      expect(result.data.tenantId).toBe(LIVE_TENANT_ID);
      const clientsKpi = result.data.kpis.find((kpi) => kpi.id === 'kpi-clients-active');
      expect(clientsKpi?.value).toBe(1);
      expect(result.data.kpis.some((kpi) => String(kpi.subValue).includes('Demo'))).toBe(false);
      expect(result.data.activities.length).toBeGreaterThan(0);
    }
  });

  it('returns live office snapshot with real KPIs in supabase mode', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(officeDashboardSupabaseRepository, 'fetchMetrics').mockResolvedValue({
      ok: true,
      data: {
        ...emptyOfficeDashboardMetrics(),
        activeClients: 1,
        totalClients: 1,
        tableAvailability: {
          clients: true,
          employees: true,
          invoices: true,
          assignments: true,
          tasks: true,
          messages: true,
          modules: true,
          portalUsers: true,
          documents: true,
          portalRequests: true,
          serviceRecords: true,
          budgets: true,
          appointments: true,
        },
      },
    });
    vi.spyOn(officeDashboardSupabaseRepository, 'fetchRecentTimelineEvents').mockResolvedValue({
      ok: true,
      data: [],
    });
    vi.spyOn(officeAuditLogSupabaseRepository, 'list').mockResolvedValue({
      ok: true,
      data: [],
    });

    const result = await fetchOfficeDashboard(LIVE_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantName).toBe('Helferhasen+');
      const clientsKpi = result.data.kpis.find((kpi) => kpi.id === 'office-kpi-clients-active');
      expect(clientsKpi?.value).toBe(1);
      expect(result.data.kpis.some((kpi) => String(kpi.subValue).includes('Demo'))).toBe(false);
    }
  });
});
