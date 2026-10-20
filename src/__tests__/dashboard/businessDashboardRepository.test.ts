import { describe, expect, it } from 'vitest';
import {
  buildBusinessKpisFromMetrics,
  emptyBusinessDashboardMetrics,
  ZENTRALE_KPI_COUNT,
} from '@/lib/dashboard/businessDashboardMetrics';
import {
  ZENTRALE_KPIS_PER_MODULE,
  ZENTRALE_MODULE_OVERVIEW_KPI_COUNT,
  buildZentraleModuleOverviewRows,
} from '@/lib/dashboard/zentraleModuleOverview';

describe('business dashboard metrics', () => {
  it('buildBusinessKpisFromMetrics liefert 16 Live-Kennzahlen für Helferhasen+', () => {
    const kpis = buildBusinessKpisFromMetrics({
      ...emptyBusinessDashboardMetrics(),
      activeClients: 1,
      totalClients: 1,
      openTasks: 2,
      overdueTasks: 1,
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
    });

    expect(kpis).toHaveLength(ZENTRALE_KPI_COUNT);
    expect(kpis.find((kpi) => kpi.id === 'kpi-clients-active')?.value).toBe(1);
    expect(kpis.find((kpi) => kpi.id === 'kpi-clients-active')?.subValue).toBe('1 gesamt');
    expect(kpis.find((kpi) => kpi.id === 'kpi-tasks')?.value).toBe(2);
    expect(kpis.find((kpi) => kpi.id === 'kpi-tasks')?.trendValue).toBe('1 überfällig');
    expect(kpis.find((kpi) => kpi.id === 'kpi-modules')?.value).toBe(3);
    expect(kpis.find((kpi) => kpi.id === 'kpi-modules')?.subValue).toBe('von 6');
  });

  it('buildZentraleModuleOverviewRows liefert 6 Module mit je 5 KPIs', () => {
    const metrics = {
      ...emptyBusinessDashboardMetrics(),
      activeClients: 1,
      totalClients: 1,
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
    };

    const rows = buildZentraleModuleOverviewRows(metrics);

    expect(rows).toHaveLength(6);
    expect(rows.reduce((sum, row) => sum + row.kpis.length, 0)).toBe(ZENTRALE_MODULE_OVERVIEW_KPI_COUNT);
    for (const row of rows) {
      expect(row.kpis).toHaveLength(ZENTRALE_KPIS_PER_MODULE);
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.kpis.every((kpi) => kpi.accentColor === row.accentColor)).toBe(true);
    }
    expect(rows.map((row) => row.moduleKey)).toEqual([
      'office',
      'assist',
      'pflege',
      'stationaer',
      'beratung',
      'akademie',
    ]);
    expect(rows.every((row) => row.kpis.every((kpi) => kpi.icon.startsWith('mkpi')))).toBe(true);
  });

  it('nutzt leere Platzhalter wenn Tabellen noch nicht verfügbar sind', () => {
    const kpis = buildBusinessKpisFromMetrics(emptyBusinessDashboardMetrics());

    expect(kpis).toHaveLength(ZENTRALE_KPI_COUNT);
    expect(kpis.find((kpi) => kpi.id === 'kpi-clients-active')?.subValue).toBe(
      'Klient:innen nicht verfügbar',
    );
    expect(kpis.find((kpi) => kpi.id === 'kpi-assignments')?.subValue).toBe(
      'Einsätze nicht verfügbar',
    );
    expect(kpis.find((kpi) => kpi.id === 'kpi-tasks')?.subValue).toBe('Aufgaben nicht verfügbar');
    expect(kpis.find((kpi) => kpi.id === 'kpi-modules')?.subValue).toBe('Module nicht verfügbar');
  });
});
