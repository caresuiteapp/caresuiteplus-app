import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
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

  it('buildOfficeKpisFromMetrics zeigt aktive Klient:innen', () => {
    const kpis = buildOfficeKpisFromMetrics({
      ...emptyOfficeDashboardMetrics(),
      activeClients: 1,
      totalClients: 1,
      tableAvailability: {
        clients: true,
        employees: true,
        invoices: true,
        appointments: true,
      },
    });

    const clientsKpi = kpis.find((kpi) => kpi.id === 'office-kpi-clients');
    expect(clientsKpi?.value).toBe(1);
    expect(clientsKpi?.subValue).toBe('1 gesamt');
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
      const clientsKpi = result.data.kpis.find((kpi) => kpi.id === 'office-kpi-clients');
      expect(clientsKpi?.value).toBe(1);
      expect(result.data.activities.length).toBeGreaterThan(0);
      expect(result.data.kpis.some((kpi) => String(kpi.subValue).includes('Demo'))).toBe(false);
      expect(result.data.areaShortcuts?.find((a) => a.id === 'clients')?.count).toBe(1);
      expect(result.data.areaShortcuts?.find((a) => a.id === 'clients')?.count).not.toBe(20);
    }
  });

  it('OfficeDashboardView nutzt snapshot.areaShortcuts statt Demo-Konstante', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/dashboard/OfficeDashboardView.tsx'),
      'utf8',
    );
    expect(source).toContain('snapshot.areaShortcuts');
    expect(source).not.toContain('OFFICE_AREA_SHORTCUTS');
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
      totalInvoices: 0,
      totalAppointments: 0,
      tableAvailability: {
        clients: true,
        employees: true,
        invoices: true,
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
      expect(result.data.kpis.some((kpi) => Number(kpi.value) > 0)).toBe(true);
      expect(result.data.activities.length).toBeGreaterThan(0);
    }
  });
});
