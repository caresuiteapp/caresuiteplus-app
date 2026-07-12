import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { ZENTRALE_KPI_COUNT, buildBusinessKpisFromMetrics } from '@/lib/dashboard/businessDashboardMetrics';
import {
  ZENTRALE_KPIS_PER_MODULE,
  ZENTRALE_MODULE_OVERVIEW_KPI_COUNT,
  buildZentraleModuleOverviewRows,
} from '@/lib/dashboard/zentraleModuleOverview';
import { buildOfficeAreaShortcutsFromMetrics } from '@/lib/office/officeAreaShortcuts';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import {
  OFFICE_WORKSPACE_KPI_COUNT,
  buildOfficeWorkspaceKpis,
} from '@/lib/office/officeDashboardWorkspace';
import {
  emptyOfficeDashboardMetrics,
  mergeDashboardActivities,
} from '@/lib/office/officeDashboardMetrics';
import * as tenantDisplayName from '@/lib/tenant/tenantDisplayName';
import * as tenantModuleSettingsHydration from '@/lib/tenant/tenantModuleSettingsHydration';
import {
  resetTenantModuleSettingsCache,
  setTenantModuleSettingsCache,
} from '@/lib/tenant/tenantModuleSettingsCache';
import { officeDashboardSupabaseRepository } from '@/lib/services/repositories/officeDashboardRepository.supabase';
import { officeAuditLogSupabaseRepository } from '@/lib/services/repositories/officeAuditLogRepository.supabase';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const LIVE_TENANT_ID = '56180c22-b894-4fab-b55e-a563c94dd6e7';

describe('office dashboard live metrics', () => {
  beforeEach(() => {
    resetTenantModuleSettingsCache();
    vi.spyOn(tenantDisplayName, 'fetchTenantDisplayName').mockResolvedValue('Helferhasen+');
    vi.spyOn(tenantModuleSettingsHydration, 'ensureTenantModuleSettingsLoaded').mockImplementation(
      async (tenantId) => {
        const modules = {
          assistEnabled: true,
          pflegeEnabled: true,
          stationaerEnabled: false,
          beratungEnabled: true,
        };
        setTenantModuleSettingsCache(tenantId, modules);
        return modules;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('buildOfficeWorkspaceKpis liefert 8 Office-KPIs', () => {
    const kpis = buildOfficeWorkspaceKpis({
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
    });

    expect(kpis).toHaveLength(OFFICE_WORKSPACE_KPI_COUNT);
    expect(kpis.find((kpi) => kpi.id === 'office-ws-kpi-clients-active')?.value).toBe(1);
    expect(kpis.find((kpi) => kpi.id === 'office-ws-kpi-billing')?.route).toBe('/office/billing-preparation');
  });

  it('buildBusinessKpisFromMetrics liefert 16 Live-KPIs', () => {
    const kpis = buildBusinessKpisFromMetrics({
      ...emptyOfficeDashboardMetrics(),
      activeClients: 2,
      totalClients: 3,
      tableAvailability: {
        ...emptyOfficeDashboardMetrics().tableAvailability,
        clients: true,
      },
    });

    expect(kpis).toHaveLength(ZENTRALE_KPI_COUNT);
    expect(kpis.find((kpi) => kpi.id === 'kpi-clients-active')?.value).toBe(2);
  });

  it('buildZentraleModuleOverviewRows liefert 6 Module mit je 5 KPIs', () => {
    const metrics = {
      ...emptyOfficeDashboardMetrics(),
      activeClients: 2,
      totalClients: 3,
      tableAvailability: {
        ...emptyOfficeDashboardMetrics().tableAvailability,
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
    };

    const rows = buildZentraleModuleOverviewRows(metrics, 'dark', 'office-kpi');

    expect(rows).toHaveLength(6);
    expect(rows.reduce((sum, row) => sum + row.kpis.length, 0)).toBe(ZENTRALE_MODULE_OVERVIEW_KPI_COUNT);
    for (const row of rows) {
      expect(row.kpis).toHaveLength(ZENTRALE_KPIS_PER_MODULE);
      expect(row.accentColor).toBeTruthy();
      expect(row.kpis.every((kpi) => kpi.accentColor === row.accentColor)).toBe(true);
    }
    expect(rows.find((row) => row.moduleKey === 'office')?.kpis[0]?.id).toBe('office-kpi-clients-active');
    expect(rows.find((row) => row.moduleKey === 'office')?.kpis[0]?.route).toBe('/office/clients');
    expect(rows.find((row) => row.moduleKey === 'office')?.kpis[0]?.icon).toBe('mkpiOfficeClients');
    expect(rows.find((row) => row.moduleKey === 'pflege')?.kpis[1]?.icon).toBe('mkpiPflegeBudget');
    expect(rows.find((row) => row.moduleKey === 'assist')?.kpis[0]?.route).toBe('/assist/assignments');
    expect(rows.every((row) => row.kpis.every((kpi) => kpi.icon.startsWith('mkpi')))).toBe(true);
    expect(rows.every((row) => row.kpis.every((kpi) => typeof kpi.route === 'string' && kpi.route.startsWith('/')))).toBe(
      true,
    );
  });

  it('mergeDashboardActivities kombiniert Audit und Timeline', () => {
    const activities = mergeDashboardActivities(
      [
        {
          id: 'audit:1',
          action: 'Klient:in angelegt',
          detail: 'Anlage über Assistent',
          actor: 'System',
          category: 'Klient',
          icon: '👥',
          timestamp: '2026-06-17T09:00:00.000Z',
        },
      ],
      [
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
    );

    expect(activities).toHaveLength(2);
    expect(activities[0]?.title).toBe('Aufnahme abgeschlossen');
    expect(activities[1]?.title).toBe('Klient:in angelegt');
  });

  it('fetchOfficeDashboard liefert Live-Office-KPIs ohne Modul-Übersicht', async () => {
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
      data: [
        {
          id: 'audit:1',
          action: 'Klient:in angelegt',
          detail: 'Anlage über Assistent',
          actor: 'System',
          category: 'Klient',
          icon: '👥',
          timestamp: '2026-06-17T09:00:00.000Z',
        },
      ],
    });

    const result = await fetchOfficeDashboard(LIVE_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantName).toBe('Helferhasen+');
      expect(result.data.kpis).toHaveLength(OFFICE_WORKSPACE_KPI_COUNT);
      expect(result.data.moduleOverviewRows).toBeUndefined();
      const clientsKpi = result.data.kpis.find((kpi) => kpi.id === 'office-ws-kpi-clients-active');
      expect(clientsKpi?.value).toBe(1);
      expect(result.data.heroSubtitle).toContain('Verwaltung');
      expect(result.data.kpis.some((kpi) => String(kpi.subValue).includes('Demo'))).toBe(false);
      expect(result.data.areaShortcuts?.find((a) => a.id === 'clients')?.count).toBe(1);
      expect(result.data.areaShortcuts?.find((a) => a.id === 'clients')?.count).not.toBe(20);
    }
  });

  it('BusinessDashboardScreen zeigt Modul-Übersicht oder KPI-Grid', () => {
    const screen = readFileSync(
      resolve(process.cwd(), 'src/screens/BusinessDashboardScreen.tsx'),
      'utf8',
    );
    expect(screen).not.toContain('ZentraleDashboardHero');
    expect(screen).toContain('Zentrale Dashboard');
    expect(screen).toContain('ModuleOverviewDashboard');
    expect(screen).toContain('loading && !data');
    expect(screen).toContain('silent: true');
    expect(screen).not.toContain('Letzte Aktivitäten');
    expect(screen).not.toContain('Schnellzugriff');
    expect(screen).not.toContain('Abmelden');
  });

  it('Dashboard-Hooks beenden hängende Ladezustände mit Timeout und finally', () => {
    const dashboardHook = readFileSync(
      resolve(process.cwd(), 'src/hooks/useDashboard.ts'),
      'utf8',
    );
    const officeHook = readFileSync(
      resolve(process.cwd(), 'src/hooks/useOfficeDashboard.ts'),
      'utf8',
    );
    const requestCache = readFileSync(
      resolve(process.cwd(), 'src/lib/office/officeDashboardRequestCache.ts'),
      'utf8',
    );

    expect(dashboardHook).toContain('withServiceQueryTimeout');
    expect(dashboardHook).toContain("'Dashboard'");
    expect(dashboardHook).toContain('finally');
    expect(dashboardHook).toContain('requestInFlightRef');
    expect(officeHook).toContain('finally');
    expect(requestCache).toContain('withServiceQueryTimeout');
    expect(requestCache).toContain("'Office-Dashboard'");
    expect(requestCache).toContain('inflight.delete(key)');
  });

  it('Gemeinsame Seitenabfragen laufen nicht dauerhaft im Ladezustand', () => {
    const queryHook = readFileSync(
      resolve(process.cwd(), 'src/hooks/core/useAsyncQuery.ts'),
      'utf8',
    );
    expect(queryHook).toContain('withServiceQueryTimeout(fetcher())');
    expect(queryHook).toContain('requestInFlightRef');
    expect(queryHook).toContain('finally');
    expect(queryHook).toContain('setRefreshing(false)');
  });

  it('OfficeDashboardView zeigt Office-Verwaltungszentrale', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/dashboard/OfficeDashboardView.tsx'),
      'utf8',
    );
    expect(source).not.toContain('ZentraleDashboardHero');
    expect(source).not.toContain('ModuleOverviewDashboard');
    expect(source).toContain('Heute im Office');
    expect(source).toContain('loading && !snapshot');
    expect(source).toContain('error && !snapshot');
    expect(source).toContain('Letzte Aktivitäten');
    expect(source).toContain('buildOfficeDashboardSections');
  });

  it('RightContextPanel ohne Demo-Fallback im Live-Modus', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/layout/platform/rightcontextpanel.tsx'),
      'utf8',
    );
    expect(source).toContain("getServiceMode() === 'supabase'");
    expect(source).not.toMatch(/:\s*\[\s*\{\s*title:\s*'Offene Aufgaben',\s*count:\s*2\s*\}/);
  });

  it('buildOfficeAreaShortcutsFromMetrics liefert Live-Zähler', () => {
    const shortcuts = buildOfficeAreaShortcutsFromMetrics({
      ...emptyOfficeDashboardMetrics(),
      totalClients: 2,
      totalEmployees: 1,
      openInvoices: 0,
      appointmentsThisWeek: 0,
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
    });

    expect(shortcuts.find((a) => a.id === 'clients')?.count).toBe(2);
    expect(shortcuts.find((a) => a.id === 'employees')?.count).toBe(1);
    expect(shortcuts.find((a) => a.id === 'clients')?.count).not.toBe(20);
  });

  it('fetchOfficeDashboard liefert Demo-Snapshot im Demo-Modus', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');

    const result = await fetchOfficeDashboard(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.kpis.length).toBe(OFFICE_WORKSPACE_KPI_COUNT);
    }
  });
});
