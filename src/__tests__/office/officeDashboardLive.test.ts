import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { ZENTRALE_KPI_COUNT, buildBusinessKpisFromMetrics } from '@/lib/dashboard/businessDashboardMetrics';
import { buildOfficeAreaShortcutsFromMetrics } from '@/lib/office/officeAreaShortcuts';
import { fetchOfficeDashboard } from '@/lib/office/officeDashboardService';
import {
  buildOfficeKpisFromMetrics,
  emptyOfficeDashboardMetrics,
  mergeDashboardActivities,
} from '@/lib/office/officeDashboardMetrics';
import * as tenantDisplayName from '@/lib/tenant/tenantDisplayName';
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
    vi.spyOn(tenantDisplayName, 'fetchTenantDisplayName').mockResolvedValue('Helferhasen+');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('buildOfficeKpisFromMetrics liefert 16 Live-KPIs', () => {
    const kpis = buildOfficeKpisFromMetrics({
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

    expect(kpis).toHaveLength(ZENTRALE_KPI_COUNT);
    expect(kpis.find((kpi) => kpi.id === 'office-kpi-clients-active')?.value).toBe(1);
    expect(kpis.find((kpi) => kpi.id === 'office-kpi-clients-active')?.subValue).toBe('1 gesamt');
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

  it('fetchOfficeDashboard liefert Live-KPIs aus Supabase-Repository', async () => {
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
      expect(result.data.kpis).toHaveLength(ZENTRALE_KPI_COUNT);
      const clientsKpi = result.data.kpis.find((kpi) => kpi.id === 'office-kpi-clients-active');
      expect(clientsKpi?.value).toBe(1);
      expect(result.data.kpis.some((kpi) => String(kpi.subValue).includes('Demo'))).toBe(false);
      expect(result.data.areaShortcuts?.find((a) => a.id === 'clients')?.count).toBe(1);
      expect(result.data.areaShortcuts?.find((a) => a.id === 'clients')?.count).not.toBe(20);
    }
  });

  it('BusinessDashboardScreen zeigt nur Hero und KPI-Grid', () => {
    const screen = readFileSync(
      resolve(process.cwd(), 'src/screens/BusinessDashboardScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain('ZentraleDashboardHero');
    expect(screen).toContain('Kennzahlen Übersicht');
    expect(screen).not.toContain('Letzte Aktivitäten');
    expect(screen).not.toContain('Schnellzugriff');
    expect(screen).not.toContain('Abmelden');
  });

  it('OfficeDashboardView zeigt nur Hero und KPI-Grid', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/dashboard/OfficeDashboardView.tsx'),
      'utf8',
    );
    expect(source).toContain('ZentraleDashboardHero');
    expect(source).not.toContain('Letzte Aktivitäten');
    expect(source).not.toContain('Schnellaktionen');
    expect(source).not.toContain('Schnellzugriff');
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
      expect(result.data.kpis.length).toBeGreaterThan(0);
    }
  });
});
